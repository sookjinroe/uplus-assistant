import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopGenerating?: () => void;
  isLoading: boolean;
  isStreamingContent: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onStopGenerating, 
  isLoading, 
  isStreamingContent,
  disabled 
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔍 handleSubmit called:', {
      isLoading,
      isStreamingContent,
      messageLength: message.trim().length,
      disabled,
      eventType: e.type,
      timestamp: new Date().toISOString()
    });
    
    if (message.trim() && !isLoading && !disabled) {
      console.log('✅ Sending message:', message.trim());
      onSendMessage(message);
      setMessage('');
    } else {
      console.log('❌ Message not sent - conditions not met:', {
        hasMessage: !!message.trim(),
        notLoading: !isLoading,
        notDisabled: !disabled
      });
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🛑 handleStop called:', {
      isLoading,
      isStreamingContent,
      hasStopFunction: !!onStopGenerating,
      timestamp: new Date().toISOString()
    });
    
    if (onStopGenerating && isStreamingContent) {
      console.log('✅ Stopping generation');
      onStopGenerating();
    } else {
      console.log('❌ Stop not executed - conditions not met:', {
        hasStopFunction: !!onStopGenerating,
        isStreamingContent
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('⌨️ Enter key pressed - triggering handleSubmit');
      handleSubmit(e);
    }
  };

  // Auto-resize textarea with dynamic scrollbar control
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Calculate new height (max 240px)
      const newHeight = Math.min(textarea.scrollHeight, 240);
      textarea.style.height = newHeight + 'px';
      
      // Control scrollbar visibility
      if (textarea.scrollHeight > 240) {
        // Content exceeds max height - show scrollbar
        textarea.style.overflowY = 'scroll';
      } else {
        // Content fits within max height - hide scrollbar
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [message]);

  // 입력 필드는 오직 error 상태일 때만 비활성화
  const isInputDisabled = disabled;

  // 상태 변화 로깅
  useEffect(() => {
    console.log('📊 ChatInput state changed:', {
      isLoading,
      isStreamingContent,
      isInputDisabled,
      messageLength: message.length,
      timestamp: new Date().toISOString()
    });
  }, [isLoading, isStreamingContent, isInputDisabled, message.length]);

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="relative flex items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            disabled={isInputDisabled}
            className={`w-full resize-none rounded-lg border border-border px-4 py-3 pr-16 focus:outline-none transition-colors shadow-sm ${
              isInputDisabled 
                ? 'opacity-50 cursor-default bg-gray-50' 
                : 'hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20'
            }`}
            rows={1}
            style={{ 
              minHeight: '48px', 
              maxHeight: '240px',
              overflowY: 'hidden' // 기본값을 hidden으로 설정
            }}
          />
          
          {/* Send/Stop button inside textarea */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              disabled={!isStreamingContent}
              className={`absolute right-3 bottom-3 rounded-lg p-2 focus:outline-none focus:ring-2 transition-colors ${
                isStreamingContent 
                  ? 'bg-error text-background hover:bg-error/90 focus:ring-error/20 cursor-pointer' 
                  : 'bg-gray-400 text-gray-200 cursor-default'
              }`}
              title={isStreamingContent ? "생성 중단" : "응답 준비 중..."}
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!message.trim() || isInputDisabled}
              className={`absolute right-3 bottom-3 bg-primary text-background rounded-lg p-2 focus:outline-none focus:ring-2 transition-colors ${
                (!message.trim() || isInputDisabled)
                  ? 'opacity-50 cursor-default'
                  : 'hover:bg-primary/90 focus:ring-primary/20 cursor-pointer'
              }`}
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};