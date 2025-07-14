import { useState, useCallback, useRef, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Message, ChatSession, ChatState, DbChatSession, DbChatMessage } from '../types/chat';
import { generateStreamingResponse } from '../utils/api';
import { supabase } from '../utils/supabase';

// 메시지 페이지네이션 설정
const MESSAGES_PER_PAGE = 50;
const INITIAL_MESSAGES_LOAD = 20;

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

  // 현재 세션의 AbortController만 관리
  const currentAbortControllerRef = useRef<AbortController | null>(null);

  // 데이터베이스 헬퍼 함수들
  const loadUserSessions = useCallback(async () => {
    if (!user) return;

    try {
      // 세션 목록 가져오기 (플레이그라운드 데이터 포함)
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

      // 각 세션의 최신 메시지만 가져오기 (성능 최적화)
      const sessionsWithMessages: ChatSession[] = await Promise.all(
        sessionsData.map(async (session: DbChatSession) => {
          const { data: messagesData, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', session.id)
            .order('created_at', { ascending: false })
            .limit(INITIAL_MESSAGES_LOAD + 1); // +1로 더 많은 메시지가 있는지 확인

          if (messagesError) throw messagesError;

          // 더 많은 메시지가 있는지 확인
          const hasMoreMessages = (messagesData || []).length > INITIAL_MESSAGES_LOAD;
          
          // 메시지를 시간순으로 정렬 (최신이 마지막)
          const messages: Message[] = (messagesData || [])
            .slice(0, INITIAL_MESSAGES_LOAD) // 실제로는 INITIAL_MESSAGES_LOAD 개수만 사용
            .reverse()
            .map((msg: DbChatMessage) => ({
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
            hasMoreMessages,
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at),
            playgroundMainPromptContent: session.playground_main_prompt_content || undefined,
            playgroundKnowledgeBaseSnapshot: session.playground_knowledge_base_snapshot || undefined,
          };
        })
      );

      // 마지막 메시지 시간 기준으로 정렬
      const sortedSessions = sessionsWithMessages.sort((a, b) => {
        // 각 세션의 마지막 메시지 시간 가져오기
        const lastMessageA = a.messages.length > 0 
          ? a.messages[a.messages.length - 1].timestamp 
          : a.createdAt;
        const lastMessageB = b.messages.length > 0 
          ? b.messages[b.messages.length - 1].timestamp 
          : b.createdAt;
        
        // 최신순 정렬 (내림차순)
        return lastMessageB.getTime() - lastMessageA.getTime();
      });

      setState(prev => ({ ...prev, sessions: sortedSessions }));
    } catch (error) {
      console.error('Error loading user sessions:', error);
      setState(prev => ({ 
        ...prev, 
        error: '채팅 기록을 불러오는 중 오류가 발생했습니다.' 
      }));
    }
  }, [user]);

  // 특정 세션의 추가 메시지 로드 (페이지네이션)
  const loadMoreMessages = useCallback(async () => {
    const currentSessionId = state.currentSessionId;
    const currentSessionData = state.sessions.find(s => s.id === currentSessionId);
    
    if (!user || !currentSessionId || !currentSessionData || currentSessionData.messages.length === 0) {
      return [];
    }

    const firstMessage = currentSessionData.messages[0];
    
    if (!user) return [];

    try {
      // 특정 메시지 이전의 메시지들을 가져오기
      const { data: beforeMessage } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('id', firstMessage.id)
        .single();

      if (!beforeMessage) return [];

      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', currentSessionId)
        .lt('created_at', beforeMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE + 1); // +1로 더 많은 메시지가 있는지 확인

      if (error) throw error;

      // 더 많은 메시지가 있는지 확인
      const moreAvailable = (messagesData || []).length > MESSAGES_PER_PAGE;
      
      // 메시지를 시간순으로 정렬 (최신이 마지막)
      const messages: Message[] = (messagesData || [])
        .slice(0, MESSAGES_PER_PAGE) // 실제로는 MESSAGES_PER_PAGE 개수만 사용
        .reverse()
        .map((msg: DbChatMessage) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(msg.created_at),
        }));

      // 현재 세션에 새로운 메시지들을 추가하고 hasMoreMessages 상태 업데이트
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(session =>
          session.id === currentSessionId
            ? { 
                ...session, 
                messages: [...messages, ...session.messages],
                hasMoreMessages: moreAvailable 
              }
            : session
        ),
      }));
      
      return messages;
    } catch (error) {
      console.error('Error loading more messages:', error);
      return [];
    }
  }, [user, state.currentSessionId, state.sessions]);

  // 특정 세션의 전체 메시지 로드 (필요시)
  const loadFullSessionMessages = useCallback(async (sessionId: string) => {
    if (!user) return;

    try {
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messages: Message[] = (messagesData || []).map((msg: DbChatMessage) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.created_at),
      }));

      // 해당 세션의 메시지를 전체로 업데이트
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(session =>
          session.id === sessionId
            ? { ...session, messages }
            : session
        ),
      }));
    } catch (error) {
      console.error('Error loading full session messages:', error);
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

  // Apply playground changes to session
  const applyPlaygroundChangesToSession = useCallback(async (
    mainPromptContent: string,
    knowledgeBaseSnapshot: Array<{
      id: string;
      name: string;
      content: string;
      order_index: number;
    }>
  ) => {
    if (!user) return;

    let sessionId = state.currentSessionId;
    
    try {
      // 현재 세션이 없거나 임시 ID인 경우 새 세션 생성
      if (!sessionId || !state.sessions.find(s => s.id === sessionId)) {
        sessionId = crypto.randomUUID();
        
        const { error: sessionError } = await supabase
          .from('chat_sessions')
          .insert({
            id: sessionId,
            user_id: user.id,
            title: 'NEW CHAT',
            playground_main_prompt_content: mainPromptContent,
            playground_knowledge_base_snapshot: knowledgeBaseSnapshot,
          });

        if (sessionError) throw sessionError;

        // 새 세션을 상태에 추가
        const newSession: ChatSession = {
          id: sessionId,
          userId: user.id,
          title: 'NEW CHAT',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          playgroundMainPromptContent: mainPromptContent,
          playgroundKnowledgeBaseSnapshot: knowledgeBaseSnapshot,
        };

        setState(prev => ({
          ...prev,
          sessions: [newSession, ...prev.sessions],
          currentSessionId: sessionId,
        }));
      } else {
        // 기존 세션 업데이트
        const { error: updateError } = await supabase
          .from('chat_sessions')
          .update({
            playground_main_prompt_content: mainPromptContent,
            playground_knowledge_base_snapshot: knowledgeBaseSnapshot,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        // 상태 업데이트
        setState(prev => ({
          ...prev,
          sessions: prev.sessions.map(session =>
            session.id === sessionId
              ? {
                  ...session,
                  playgroundMainPromptContent: mainPromptContent,
                  playgroundKnowledgeBaseSnapshot: knowledgeBaseSnapshot,
                  updatedAt: new Date(),
                }
              : session
          ),
        }));
      }

      console.log('✅ 플레이그라운드 설정이 세션에 적용되었습니다:', {
        sessionId,
        mainPromptLength: mainPromptContent.length,
        knowledgeBaseItems: knowledgeBaseSnapshot.length
      });
    } catch (error) {
      console.error('❌ 플레이그라운드 적용 실패:', error);
      throw error;
    }
  }, [user, state.currentSessionId, state.sessions]);

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
          hasMoreMessages: false, // 새 세션은 더 이상 메시지가 없음
          hasMoreMessages: false, // 새 세션은 더 이상 메시지가 없음
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
                      hasMoreMessages: session.hasMoreMessages || false, // 기존 상태 유지
                      hasMoreMessages: session.hasMoreMessages || false, // 기존 상태 유지
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
        // 세션을 데이터베이스에 저장 (제목은 새 세션일 때만 설정)
        const currentSession = state.sessions.find(s => s.id === sessionId);
        const isNewSession = !currentSession || currentSession.messages.length === 0;
        
        const { error: sessionError } = await supabase
          .from('chat_sessions')
          .upsert({
            id: sessionId,
            user_id: user.id,
            title: isNewSession ? 'System Prompt Debug' : currentSession?.title || 'System Prompt Debug',
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

        const systemPromptContent = `**현재 시스템 프롬프트:**\n\n\`\`\`\n시스템 프롬프트는 이제 Edge Function에서 동적으로 구성됩니다.\n세션별 플레이그라운드 설정이 있으면 해당 설정을 사용하고,\n없으면 전역 데이터베이스 설정을 사용합니다.\n\`\`\``;
        
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

        // UI 업데이트 및 세션 재정렬
        setState(prev => {
          const updatedSessions = prev.sessions.map(session =>
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
          );

          // 마지막 메시지 시간 기준으로 재정렬
          const sortedSessions = updatedSessions.sort((a, b) => {
            const lastMessageA = a.messages.length > 0 
              ? a.messages[a.messages.length - 1].timestamp 
              : a.createdAt;
            const lastMessageB = b.messages.length > 0 
              ? b.messages[b.messages.length - 1].timestamp 
              : b.createdAt;
            
            return lastMessageB.getTime() - lastMessageA.getTime();
          });

          return {
            ...prev,
            sessions: sortedSessions,
            isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
            isStreamingContent: false,
          };
        });
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
                    // 제목은 새 세션일 때만 설정 (기존 세션의 제목은 유지)
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
      // 현재 세션이 새 세션인지 확인
      const currentSession = state.sessions.find(s => s.id === sessionId);
      const isNewSession = !currentSession || currentSession.messages.length === 0;

      // 세션을 데이터베이스에 저장 - 항상 title을 포함
      const sessionData: any = {
        id: sessionId,
        user_id: user.id,
        title: isNewSession ? createTitleFromMessage(content) : (currentSession?.title || createTitleFromMessage(content)),
      };

      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .upsert(sessionData);

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
      const sessionForHistory = state.sessions.find(s => s.id === sessionId);
      
      // API로 전송할 메시지 구성 - 빈 어시스턴트 메시지 제외
      const existingMessages = sessionForHistory ? sessionForHistory.messages : [];
      const validMessages = existingMessages.filter(msg => 
        // 내용이 있는 메시지만 포함 (빈 어시스턴트 메시지 제외)
        msg.content.trim() !== '' && 
        // 방금 추가한 임시 어시스턴트 메시지 제외
        msg.id !== assistantMessage.id
      );
      
      const conversationHistory = [...validMessages, userMessage];
      
      const apiMessages = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log('📤 Claude API로 전송할 메시지:', {
        totalMessages: apiMessages.length,
        lastMessage: apiMessages[apiMessages.length - 1],
        hasEmptyContent: apiMessages.some(msg => !msg.content.trim())
      });

      // 세션별 플레이그라운드 설정 가져오기
      const playgroundMainPromptContent = sessionForHistory?.playgroundMainPromptContent;
      const playgroundKnowledgeBaseSnapshot = sessionForHistory?.playgroundKnowledgeBaseSnapshot;

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
          
          // 세션 완료 후 재정렬
          setState(prev => {
            const updatedSessions = prev.sessions.map(session =>
              session.id === sessionId
                ? { ...session, updatedAt: new Date() }
                : session
            );

            // 마지막 메시지 시간 기준으로 재정렬
            const sortedSessions = updatedSessions.sort((a, b) => {
              const lastMessageA = a.messages.length > 0 
                ? a.messages[a.messages.length - 1].timestamp 
                : a.createdAt;
              const lastMessageB = b.messages.length > 0 
                ? b.messages[b.messages.length - 1].timestamp 
                : b.createdAt;
              
              return lastMessageB.getTime() - lastMessageA.getTime();
            });

            return {
              ...prev,
              sessions: sortedSessions,
              isLoading: sessionId === prev.currentSessionId ? false : prev.isLoading,
              isStreamingContent: sessionId === prev.currentSessionId ? false : prev.isStreamingContent,
            };
          });
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
      }, abortController.signal, playgroundMainPromptContent, playgroundKnowledgeBaseSnapshot);
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
  }, [state.currentSessionId, state.sessions, createNewSession, user]);

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
    applyPlaygroundChangesToSession,
    loadMoreMessages,
  };
};