import React, { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { Message } from '../types/chat';
import { MessageSquare, AlertCircle, X } from 'lucide-react';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  isStreamingContent: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onStopGenerating?: () => void;
  onClearError?: () => void;
  hasHeader?: boolean;
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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col bg-light min-h-0 relative">
      {/* Messages area with proper scrolling and consistent background */}
      <div className={`flex-1 overflow-y-auto bg-light pb-24 ${hasHeader ? 'pt-20' : ''}`}>
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