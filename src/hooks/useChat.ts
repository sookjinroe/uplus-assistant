import { useState, useCallback, useRef, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Message, ChatSession, ChatState, DbChatSession, DbChatMessage, KnowledgeBaseItem } from '../types/chat';
import { generateStreamingResponse, fetchSystemPrompt } from '../utils/api';
import { supabase } from '../utils/supabase';

// 타이틀 생성 함수 (저장용 - 말줄임표 없음)
const createTitleFromMessage = (content: string): string => {
  // 50자로 제한 (저장시에는 말줄임표 없음)
  const maxLength = 50;
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength);
};

// 진행 중인 요청들을 관리하는 Map
const activeRequests = new Map<string, {
  abortController: AbortController;
  sessionId: string;
  messageId: string;
}>();

export const useChat = (user: User | null) => {
  const [state, setState] = useState<ChatState>({
    sessions: [],
    currentSessionId: null,
    isLoading: false,
    isStreamingContent: false,
    error: null,
  });

  // 시스템 프롬프트 캐시 상태
  const [systemPromptCache, setSystemPromptCache] = useState<{
    prompt: string | null;
    timestamp: number;
    isLoading: boolean;
  }>({
    prompt: null,
    timestamp: 0,
    isLoading: false,
  });

  // 현재 세션의 AbortController만 관리
  const currentAbortControllerRef = useRef<AbortController | null>(null);

  // 데이터베이스 헬퍼 함수들
  const loadUserSessions = useCallback(async () => {
    if (!user) return;

    try {
      // 세션 목록 가져오기 (playground 데이터 포함)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      if (!sessionsData || sessionsData.length === 0) {
        setState(prev => ({ ...prev, sessions: [] }));
        return;
      }

      // 각 세션의 메시지 가져오기
      const sessionsWithMessages: ChatSession[] = await Promise.all(
        sessionsData.map(async (session: DbChatSession) => {
          const { data: messagesData, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', session.id)
            .order('created_at', { ascending: true });

          if (messagesError) throw messagesError;

          const messages: Message[] = (messagesData || []).map((msg: DbChatMessage) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: new Date(msg.created_at),
          }));

          return {
            id: session.id,
            userId: session.user_id,
            title: session.title,
            messages,
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at),
            playgroundMainPromptContent: session.playground_main_prompt_content,
            playgroundKnowledgeBaseSnapshot: session.playground_knowledge_base_snapshot,
          };
        })
      );

      setState(prev => ({ ...prev, sessions: sessionsWithMessages }));
    } catch (error) {
      console.error('Error loading user sessions:', error);
      setState(prev => ({ 
        ...prev, 
        error: '채팅 기록을 불러오는 중 오류가 발생했습니다.' 
      }));
    }
  }, [user]);

  // 사용자가 변경되면 세션 로드
  useEffect(() => {
    if (user) {
      loadUserSessions();
    } else {
      setState({
        sessions: [],
        currentSessionId: null,
        isLoading: false,
        isStreamingContent: false,
        error: null,
      });
    }
  }, [user, loadUserSessions]);

  // 앱 초기화 시 시스템 프롬프트 미리 가져오기
  useEffect(() => {
    const preloadSystemPrompt = async () => {
      if (systemPromptCache.isLoading || systemPromptCache.prompt) {
        return;
      }

      console.log('🚀 앱 초기화: 시스템 프롬프트 미리 로딩 시작');
      
      setSystemPromptCache(prev => ({
        ...prev,
        isLoading: true,
      }));

      try {
        const prompt = await fetchSystemPrompt();
        setSystemPromptCache({
          prompt,
          timestamp: Date.now(),
          isLoading: false,
        });
        console.log('✅ 시스템 프롬프트 미리 로딩 완료:', {
          length: prompt.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ 시스템 프롬프트 미리 로딩 실패:', error);
        setSystemPromptCache(prev => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    const timeoutId = setTimeout(preloadSystemPrompt, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Apply playground changes to current session
  const applyPlaygroundChanges = useCallback(async (
    mainPrompt: string,
    knowledgeBase: KnowledgeBaseItem[]
  ) => {
    if (!user) {
      throw new Error('User must be authenticated to apply playground changes');
    }

    let sessionId = state.currentSessionId;
    let sessionTitle = 'Playground Session'; // 기본 제목

    // If no active session, create a new one
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setState(prev => ({
        ...prev,
        currentSessionId: sessionId,
      }));
    } else {
      // 기존 세션이 있는 경우, 해당 세션의 제목을 유지
      const existingSession = state.sessions.find(session => session.id === sessionId);
      if (existingSession) {
        sessionTitle = existingSession.title;
      }
    }

    try {
      console.log('🎮 플레이그라운드 변경사항 적용 시작:', {
        sessionId: sessionId,
        mainPromptLength: mainPrompt.length,
        knowledgeBaseItems: knowledgeBase.length,
        sessionTitle: sessionTitle
      });

      // Use upsert to create or update session in database
      const { error } = await supabase
        .from('chat_sessions')
        .upsert({
          id: sessionId,
          user_id: user.id,
          title: sessionTitle, // 기존 제목 유지 또는 기본 제목 사용
          playground_main_prompt_content: mainPrompt.trim() || null,
          playground_knowledge_base_snapshot: knowledgeBase.length > 0 ? knowledgeBase : null,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      // Update local state
      setState(prev => {
        const existingSession = prev.sessions.find(session => session.id === sessionId);
        
        if (existingSession) {
          // Update existing session
          return {
            ...prev,
            sessions: prev.sessions.map(session =>
              session.id === sessionId
                ? {
                    ...session,
                    playgroundMainPromptContent: mainPrompt.trim() || undefined,
                    playgroundKnowledgeBaseSnapshot: knowledgeBase.length > 0 ? knowledgeBase : undefined,
                    updatedAt: new Date(),
                  }
                : session
            ),
          };
        } else {
          // Add new session
          const newSession: ChatSession = {
            id: sessionId!,
            userId: user.id,
            title: sessionTitle,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            playgroundMainPromptContent: mainPrompt.trim() || undefined,
            playgroundKnowledgeBaseSnapshot: knowledgeBase.length > 0 ? knowledgeBase : undefined,
          };

          return {
            ...prev,
            sessions: [newSession, ...prev.sessions],
          };
        }
      });

      console.log('✅ 플레이그라운드 변경사항 적용 완료');
    } catch (error) {
      console.error('❌ 플레이그라운드 변경사항 적용 실패:', error);
      throw error;
    }
  }, [user, state.currentSessionId, state.sessions]);

  // Create a new chat session
  const createNewSession = useCallback(async () => {
    if (!user) return;

    const tempSessionId = crypto.randomUUID();
    
    setState(prev => ({
      ...prev,
      currentSessionId: tempSessionId,
    }));

    return tempSessionId;
  }, [user]);

  // Get current session
  const getCurrentSession = useCallback(() => {
    const existingSession = state.sessions.find(session => session.id === state.currentSessionId);
    if (existingSession) {
      return existingSession;
    }

    if (state.currentSessionId) {
      return {
        id: state.currentSessionId,
        userId: user?.id || '',
        title: 'New Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return undefined;
  }, [state.sessions, state.currentSessionId, user]);

  // Rename a session
  const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim() || !user) return;

    const limitedTitle = createTitleFromMessage(newTitle.trim());

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: limitedTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                title: limitedTitle,
                updatedAt: new Date(),
              }
            : session
        ),
      }));
    } catch (error) {
      console.error('Error renaming session:', error);
      setState(prev => ({ 
        ...prev, 
        error: '세션 이름 변경 중 오류가 발생했습니다.' 
      }));
    }
  }, [user]);

  // 현재 세션의 로딩 상태를 확인하는 함수
  const getCurrentSessionLoadingState = useCallback(() => {
    const currentSessionId = state.currentSessionId;
    if (!currentSessionId) return { isLoading: false, isStreamingContent: false };

    const hasActiveRequest = Array.from(activeRequests.values()).some(
      request => request.sessionId === currentSessionId
    );

    return {
      isLoading: hasActiveRequest,
      isStreamingContent: hasActiveRequest && state.isStreamingContent
    };
  }, [state.currentSessionId, state.isStreamingContent]);

  // Stop generation function
  const stopGenerating = useCallback(() => {
    const currentSessionId = state.currentSessionId;
    if (!currentSessionId) return;

    for (const [requestId, request] of activeRequests.entries()) {
      if (request.sessionId === currentSessionId) {
        try {
          request.abortController.abort();
          activeRequests.delete(requestId);
        } catch (error) {
          console.log('AbortController cleanup error:', error);
        }
      }
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      isStreamingContent: false,
    }));
  }, [state.currentSessionId]);

  // Helper function to check if an error is an abort error
  const isAbortError = (error: any): boolean => {
    return (
      (error instanceof DOMException && error.name === 'AbortError') ||
      error.name === 'AbortError' ||
      error.message === 'Request was aborted' ||
      error.message?.toLowerCase().includes('aborted')
    );
  };

  // 캐시된 시스템 프롬프트 가져오기 함수
  const getCachedSystemPrompt = useCallback(async (): Promise<string> => {
    const CACHE_TTL = 5 * 60 * 1000; // 5분
    const isCacheValid = systemPromptCache.prompt && 
      (Date.now() - systemPromptCache.timestamp) < CACHE_TTL;

    if (isCacheValid) {
      console.log('💾 캐시된 시스템 프롬프트 사용:', {
        cacheAge: Math.round((Date.now() - systemPromptCache.timestamp) / 1000),
        promptLength: systemPromptCache.prompt!.length
      });
      return systemPromptCache.prompt!;
    }

    console.log('🔄 시스템 프롬프트 새로 가져오기 (캐시 만료 또는 없음)');
    try {
      const prompt = await fetchSystemPrompt();
      setSystemPromptCache({
        prompt,
        timestamp: Date.now(),
        isLoading: false,
      });
      return prompt;
    } catch (error) {
      console.error('시스템 프롬프트 가져오기 실패:', error);
      if (systemPromptCache.prompt) {
        console.log('⚠️ 만료된 캐시 사용 (fallback)');
        return systemPromptCache.prompt;
      }
      throw error;
    }
  }, [systemPromptCache]);

  // Build system prompt from playground data
  const buildPlaygroundSystemPrompt = useCallback((
    mainPrompt: string,
    knowledgeBase: KnowledgeBaseItem[]
  ): string => {
    let fullSystemPrompt = mainPrompt;

    if (knowledgeBase.length > 0) {
      fullSystemPrompt += '\n\n---\n# Knowledge Base\n\n';
      
      for (const item of knowledgeBase) {
        fullSystemPrompt += `## ${item.name}\n${item.content}\n\n`;
      }
    }

    return fullSystemPrompt;
  }, []);

  // Send a message with streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !user) return;

    // 현재 세션의 진행 중인 요청만 중단
    const currentSessionId = state.currentSessionId;
    if (currentSessionId) {
      for (const [requestId, request] of activeRequests.entries()) {
        if (request.sessionId === currentSessionId) {
          try {
            request.abortController.abort();
            activeRequests.delete(requestId);
          } catch (error) {
            console.log('Previous request cleanup:', error);
          }
        }
      }
    }

    let sessionId = state.currentSessionId;
    
    // Create new session if none exists
    if (!sessionId) {
      sessionId = await createNewSession();
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    // 비밀 코드 확인
    if (content.trim() === '/show-system-prompt') {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: '',
        role: 'assistant',
        timestamp: new Date(),
      };

      // 임시로 UI에 메시지 추가
      setState(prev => {
        const existingSession = prev.sessions.find(s => s.id === sessionId);
        const sessionTitle = 'System Prompt Debug';
        
        const newSession: ChatSession = {
          id: sessionId!,
          userId: user.id,
          title: sessionTitle,
          messages: [userMessage, assistantMessage],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return {
          ...prev,
          sessions: existingSession 
            ? prev.sessions.map(session =>
                session.id === sessionId
                  ? {
                      ...session,
                      messages: [...session.messages, userMessage, assistantMessage],
                      title: session.messages.length === 0 ? sessionTitle : session.title,
                      updatedAt: new Date(),
                    }
                  : session
              )
            : [newSession, ...prev.sessions],
          error: null,
          isLoading: sessionId === prev.currentSessionId,
          isStreamingContent: false,
        };
      });

      try {
        // 세션을 데이터베이스에 저장
        const { error: sessionError } = await supabase
          .from('chat_sessions')
          .upsert({
            id: sessionId,
            user_id: user.id,
            title: 'System Prompt Debug',
          });

        if (sessionError) throw sessionError;

        // 사용자 메시지 저장
        const { error: userMsgError } = await supabase
          .from('chat_messages')
          .insert({
            id: userMessage.id,
            session_id: sessionId,
            content: userMessage.content,
            role: userMessage.role,
          });

        if (userMsgError) throw userMsgError;

        // 현재 세션의 플레이그라운드 데이터 확인
        const currentSession = state.sessions.find(s => s.id === sessionId);
        let systemPromptContent: string;

        if (currentSession?.playgroundMainPromptContent || currentSession?.playgroundKnowledgeBaseSnapshot) {
          console.log('🎮 플레이그라운드 시스템 프롬프트 표시');
          const playgroundPrompt = buildPlaygroundSystemPrompt(
            currentSession.playgroundMainPromptContent || '',
            currentSession.playgroundKnowledgeBaseSnapshot || []
          );
          systemPromptContent = `**현재 플레이그라운드 시스템 프롬프트:**\n\n\`\`\`\n${playgroundPrompt}\n\`\`\``;
        } else {
          console.log('📋 기본 시스템 프롬프트 표시');
          const systemPrompt = await getCachedSystemPrompt();
          systemPromptContent = `**현재 시스템 프롬프트:**\n\n\`\`\`\n${systemPrompt}\n\`\`\``;
        }
        
        // 어시스턴트 메시지 저장
        const { error: assistantMsgError } = await supabase
          .from('chat_messages')
          .insert({
            id: assistantMessage.id,
            session_id: sessionId,
            content: systemPromptContent,
            role: assistantMessage.role,
          });

        if (assistantMsgError) throw assistantMsgError;

        // UI 업데이트
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.map(session =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.map(msg =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: systemPromptContent }
                      : msg
                  ),
                  updatedAt: new Date(),
                }
              : session
          ),
          isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
          isStreamingContent: false,
        }));
      } catch (error) {
        console.error('Error saving system prompt debug:', error);
        setState(prev => ({
          ...prev,
          isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
          isStreamingContent: false,
          error: sessionId === prev.currentSessionId ? (error instanceof Error ? error.message : 'Failed to save system prompt') : prev.error,
        }));
      }
      return;
    }

    // 어시스턴트 메시지를 로딩 상태로 미리 생성
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      content: '',
      role: 'assistant',
      timestamp: new Date(),
    };

    // UI에 메시지 추가
    setState(prev => {
      const existingSession = prev.sessions.find(s => s.id === sessionId);
      const sessionTitle = createTitleFromMessage(content);
      
      const newSession: ChatSession = {
        id: sessionId!,
        userId: user.id,
        title: sessionTitle,
        messages: [userMessage, assistantMessage],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return {
        ...prev,
        sessions: existingSession 
          ? prev.sessions.map(session =>
              session.id === sessionId
                ? {
                    ...session,
                    messages: [...session.messages, userMessage, assistantMessage],
                    title: session.messages.length === 0 ? sessionTitle : session.title,
                    updatedAt: new Date(),
                  }
                : session
            )
          : [newSession, ...prev.sessions],
        error: null,
        isLoading: sessionId === prev.currentSessionId,
        isStreamingContent: false,
      };
    });

    // 새로운 AbortController 생성 및 등록
    const abortController = new AbortController();
    const requestId = crypto.randomUUID();
    
    activeRequests.set(requestId, {
      abortController,
      sessionId: sessionId!,
      messageId: assistantMessage.id
    });

    try {
      // 세션을 데이터베이스에 저장
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .upsert({
          id: sessionId,
          user_id: user.id,
          title: createTitleFromMessage(content),
        });

      if (sessionError) throw sessionError;

      // 사용자 메시지 저장
      const { error: userMsgError } = await supabase
        .from('chat_messages')
        .insert({
          id: userMessage.id,
          session_id: sessionId,
          content: userMessage.content,
          role: userMessage.role,
        });

      if (userMsgError) throw userMsgError;

      // 현재 세션의 대화 히스토리 구성
      const currentSession = state.sessions.find(s => s.id === sessionId);
      const conversationHistory = currentSession ? [...currentSession.messages, userMessage] : [userMessage];
      
      const apiMessages = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // 시스템 프롬프트 결정 (플레이그라운드 데이터 우선)
      let systemPrompt: string | undefined;
      
      if (currentSession?.playgroundMainPromptContent || currentSession?.playgroundKnowledgeBaseSnapshot) {
        console.log('🎮 플레이그라운드 시스템 프롬프트 사용:', {
          hasMainPrompt: !!currentSession.playgroundMainPromptContent,
          knowledgeBaseItems: currentSession.playgroundKnowledgeBaseSnapshot?.length || 0
        });
        
        systemPrompt = buildPlaygroundSystemPrompt(
          currentSession.playgroundMainPromptContent || '',
          currentSession.playgroundKnowledgeBaseSnapshot || []
        );
      }

      let assistantContent = '';

      await generateStreamingResponse(apiMessages, {
        onChunk: (chunk: string) => {
          if (activeRequests.has(requestId)) {
            assistantContent += chunk;
            setState(prev => ({
              ...prev,
              isStreamingContent: sessionId === prev.currentSessionId ? true : prev.isStreamingContent,
              sessions: prev.sessions.map(session =>
                session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: assistantContent }
                          : msg
                      ),
                      updatedAt: new Date(),
                    }
                  : session
              ),
            }));
          }
        },
        onComplete: async () => {
          activeRequests.delete(requestId);
          
          // 어시스턴트 메시지를 데이터베이스에 저장
          try {
            const { error: assistantMsgError } = await supabase
              .from('chat_messages')
              .insert({
                id: assistantMessage.id,
                session_id: sessionId,
                content: assistantContent,
                role: assistantMessage.role,
              });

            if (assistantMsgError) throw assistantMsgError;
          } catch (error) {
            console.error('Error saving assistant message:', error);
          }
          
          setState(prev => ({
            ...prev,
            isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
            isStreamingContent: sessionId === prev.currentSessionId ? false : prev.isStreamingContent,
          }));
        },
        onError: (error: Error) => {
          activeRequests.delete(requestId);
          
          if (isAbortError(error)) {
            setState(prev => ({
              ...prev,
              isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
              isStreamingContent: sessionId === prev.currentSessionId ? false : prev.isStreamingContent,
              error: null,
            }));
            return;
          }

          setState(prev => ({
            ...prev,
            isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
            isStreamingContent: sessionId === prev.currentSessionId ? false : prev.isStreamingContent,
            error: sessionId === prev.currentSessionId ? error.message : prev.error,
            sessions: prev.sessions.map(session =>
              session.id === sessionId
                ? {
                    ...session,
                    messages: session.messages.filter(msg => msg.id !== assistantMessage.id),
                  }
                : session
            ),
          }));
        }
      }, abortController.signal, systemPrompt);
    } catch (error) {
      activeRequests.delete(requestId);
      
      if (isAbortError(error)) {
        setState(prev => ({
          ...prev,
          isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
          isStreamingContent: sessionId === prev.currentSessionId ? false : prev.isStreamingContent,
          error: null,
        }));
        return;
      }

      console.error('Chat Error:', error);
      setState(prev => ({
        ...prev,
        isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
        isStreamingContent: sessionId === prev.currentSessionId ? false : prev.isStreamingContent,
        error: sessionId === prev.currentSessionId ? (error instanceof Error ? error.message : 'An error occurred while sending the message') : prev.error,
        sessions: prev.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.filter(msg => msg.id !== assistantMessage.id),
              }
            : session
        ),
      }));
    }
  }, [state.currentSessionId, state.sessions, createNewSession, getCachedSystemPrompt, buildPlaygroundSystemPrompt, user]);

  // Switch to a different session
  const switchSession = useCallback((sessionId: string) => {
    setState(prev => {
      const hasActiveRequestForNewSession = Array.from(activeRequests.values()).some(
        request => request.sessionId === sessionId
      );

      return {
        ...prev,
        currentSessionId: sessionId,
        error: null,
        isLoading: hasActiveRequestForNewSession,
        isStreamingContent: hasActiveRequestForNewSession && prev.isStreamingContent,
      };
    });
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;

    // 삭제할 세션의 모든 활성 요청 중단
    for (const [requestId, request] of activeRequests.entries()) {
      if (request.sessionId === sessionId) {
        try {
          request.abortController.abort();
          activeRequests.delete(requestId);
        } catch (error) {
          console.log('Request cleanup during session deletion:', error);
        }
      }
    }

    try {
      // 데이터베이스에서 세션 삭제 (메시지는 CASCADE로 자동 삭제)
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => {
        const newSessions = prev.sessions.filter(session => session.id !== sessionId);
        const newCurrentSessionId = prev.currentSessionId === sessionId 
          ? (newSessions.length > 0 ? newSessions[0].id : null)
          : prev.currentSessionId;

        const hasActiveRequestForNewSession = newCurrentSessionId ? 
          Array.from(activeRequests.values()).some(request => request.sessionId === newCurrentSessionId) : false;

        return {
          ...prev,
          sessions: newSessions,
          currentSessionId: newCurrentSessionId,
          error: null,
          isLoading: hasActiveRequestForNewSession,
          isStreamingContent: hasActiveRequestForNewSession && prev.isStreamingContent,
        };
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      setState(prev => ({ 
        ...prev, 
        error: '세션 삭제 중 오류가 발생했습니다.' 
      }));
    }
  }, [user]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // 현재 세션의 실제 로딩 상태 계산
  const currentLoadingState = getCurrentSessionLoadingState();

  return {
    sessions: state.sessions,
    currentSession: getCurrentSession(),
    isLoading: currentLoadingState.isLoading,
    isStreamingContent: currentLoadingState.isStreamingContent,
    error: state.error,
    sendMessage,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    clearError,
    stopGenerating,
    applyPlaygroundChanges,
  };
};