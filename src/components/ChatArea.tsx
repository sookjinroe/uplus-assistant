import React, { useEffect, useRef, useState } from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { Message } from '../types/chat';
import { MessageSquare, AlertCircle, X, ChevronUp } from 'lucide-react';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  isStreamingContent: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onStopGenerating?: () => void;
  onClearError?: () => void;
  hasHeader?: boolean;
  onLoadMoreMessages?: () => Promise<void>;
  hasMoreMessages?: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isLoading,
  isStreamingContent,
  error,
  onSendMessage,
  onStopGenerating,
  onClearError,
  hasHeader = false,
  onLoadMoreMessages,
  hasMoreMessages = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const lastScrollTop = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingProgrammatically = useRef(false);

  // 이전 메시지 로드 함수
  const handleLoadMoreMessagesClick = async () => {
    if (!onLoadMoreMessages || loadingMoreMessages || !hasMoreMessages) return;
    
    setLoadingMoreMessages(true);
    try {
      const container = scrollContainerRef.current;
      const scrollHeightBefore = container?.scrollHeight || 0;
      
      await onLoadMoreMessages();
      
      // 스크롤 위치 유지 (새로 로드된 메시지로 인한 스크롤 점프 방지)
      setTimeout(() => {
        if (container) {
          const scrollHeightAfter = container.scrollHeight;
          const scrollDiff = scrollHeightAfter - scrollHeightBefore;
          container.scrollTop = container.scrollTop + scrollDiff;
        }
      }, 50);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  // 스크롤 위치 감지
  const handleScroll = () => {
    // 프로그래밍적 스크롤인 경우 무시
    if (isScrollingProgrammatically.current) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100; // 100px 여유
    const isAtTop = scrollTop < 100; // 상단 100px 이내
    
    // 사용자가 위로 스크롤했는지 감지
    const scrolledUp = scrollTop < lastScrollTop.current - 5; // 5px 임계값
    lastScrollTop.current = scrollTop;

    // 상단 근처에서 더 많은 메시지 로드
    if (isAtTop && hasMoreMessages && !loadingMoreMessages) {
      handleLoadMoreMessagesClick();
    }

    if (scrolledUp && !isAtBottom) {
      // 사용자가 위로 스크롤했고 하단에 있지 않으면 자동 스크롤 중단
      setIsUserScrolling(true);
      setShouldAutoScroll(false);
      
      // 스트리밍 중일 때만 버튼 표시
      if (isStreamingContent) {
        setShowScrollButton(true);
      }
    } else if (isAtBottom) {
      // 하단에 도달하면 자동 스크롤 재개
      setIsUserScrolling(false);
      setShouldAutoScroll(true);
      setShowScrollButton(false);
    }

    // 스크롤 중단 감지를 위한 타이머 (더 긴 시간으로 설정)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      // 스크롤이 멈췄지만 여전히 하단에 있지 않으면 사용자 스크롤 상태 유지
      const container = scrollContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        if (!isAtBottom && isStreamingContent) {
          // 하단에 있지 않고 스트리밍 중이면 버튼 계속 표시
          setShowScrollButton(true);
        } else {
          setIsUserScrolling(false);
          setShowScrollButton(false);
        }
      }
    }, 500); // 500ms로 증가
  };

  // 프로그래밍적 스크롤 함수
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    isScrollingProgrammatically.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior });
    
    // 스크롤 완료 후 플래그 리셋
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, behavior === 'smooth' ? 1000 : 100);
  };

  // 메시지 변경 시 자동 스크롤 (조건부)
  useEffect(() => {
    if (shouldAutoScroll && !isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll, isUserScrolling]);

  // 새 메시지가 추가될 때 (사용자 메시지나 새 어시스턴트 메시지) 자동 스크롤 강제 실행
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      // 사용자 메시지가 추가되면 항상 스크롤
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
      setShowScrollButton(false);
      scrollToBottom();
    } else if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === '') {
      // 새 어시스턴트 메시지가 시작되면 항상 스크롤
      setShouldAutoScroll(true);
      setIsUserScrolling(false);
      setShowScrollButton(false);
      scrollToBottom();
    }
  }, [messages.length]);

  // 스트리밍이 끝나면 버튼 숨기기
  useEffect(() => {
    if (!isStreamingContent) {
      setShowScrollButton(false);
    }
  }, [isStreamingContent]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 새 메시지로 이동 버튼 클릭 핸들러
  const handleScrollToNewMessage = () => {
    setShouldAutoScroll(true);
    setIsUserScrolling(false);
    setShowScrollButton(false);
    scrollToBottom();
  };

  return (
    <div className="flex-1 flex flex-col bg-light min-h-0 relative">
      {/* Messages area with proper scrolling and consistent background */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto bg-light pb-24 ${hasHeader ? 'pt-20' : ''}`}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-secondary max-w-md mx-auto px-4">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-30" />
              <h2 className="text-xl font-semibold mb-2 text-text">대화를 시작하세요</h2>
              <p className="text-secondary mb-4">
                메시지를 입력하여 AI와 대화해보세요
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-full">
            <div className="max-w-2xl mx-auto py-4">
              {/* 이전 메시지 로드 버튼 */}
              {hasMoreMessages && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={handleLoadMoreMessagesClick}
                    disabled={loadingMoreMessages}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-secondary hover:text-text bg-background border border-border rounded-lg hover:bg-light transition-colors disabled:opacity-50"
                  >
                    {loadingMoreMessages ? (
                      <>
                        <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                        이전 메시지 로딩 중...
                      </>
                    ) : (
                      <>
                        <ChevronUp size={16} />
                        이전 메시지 보기
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {messages.map((message) => {
                // 마지막 어시스턴트 메시지이고 로딩 중이면 로딩 상태로 표시
                const isLastAssistantMessage = message.role === 'assistant' && 
                  message === messages[messages.length - 1];
                const showLoading = isLastAssistantMessage && isLoading;
                
                return (
                  <ChatBubble 
                    key={message.id} 
                    message={message} 
                    isLoading={showLoading}
                  />
                );
              })}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* 새 메시지로 이동 버튼 - 조건을 더 명확하게 */}
      {showScrollButton && isStreamingContent && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={handleScrollToNewMessage}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 transition-colors text-sm animate-fadeIn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            새 메시지로 이동
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute bottom-28 left-0 right-0 z-10 bg-error/10 border border-error/20 rounded-lg mx-4 p-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-error flex-shrink-0" />
              <p className="text-error">{error}</p>
            </div>
            {onClearError && (
              <button
                onClick={onClearError}
                className="text-error hover:text-error/80 transition-colors"
                title="오류 메시지 닫기"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating input area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent pt-6 pb-4 z-20">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            onSendMessage={onSendMessage}
            onStopGenerating={onStopGenerating}
            isLoading={isLoading}
            isStreamingContent={isStreamingContent}
            disabled={!!error}
          />
        </div>
      </div>
    </div>
  );
};