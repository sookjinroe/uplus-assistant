import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Message } from '../types/chat';
import { Clipboard, Check } from 'lucide-react';

interface ChatBubbleProps {
  message: Message;
  isLoading?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isLoading = false }) => {
  const isUser = message.role === 'user';
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <div 
      className="relative animate-fadeIn"
      onMouseEnter={() => setShowCopyButton(true)}
      onMouseLeave={() => setShowCopyButton(false)}
    >
      {/* Message content */}
      <div className={`p-4 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
        <div className={`${isUser ? 'max-w-[70%]' : 'flex-1'}`}>
          {/* 사용자 메시지는 버블, 어시스턴트 메시지는 버블 없음 */}
          {isUser ? (
            <div>
              <div className="inline-block p-3 rounded-2xl shadow-sm bg-background border border-border rounded-br-md">
                <p className="whitespace-pre-wrap leading-relaxed text-text text-base">{message.content}</p>
              </div>
              {/* 사용자 메시지 복사 버튼 */}
              {message.content && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleCopy}
                    className={`p-1 text-secondary hover:text-text transition-all duration-200 ${
                      showCopyButton ? 'opacity-100' : 'opacity-0'
                    }`}
                    title="메시지 복사"
                  >
                    {copied ? <Check size={14} className="text-success" /> : <Clipboard size={14} />}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full">
              {/* 로딩 중이고 내용이 비어있으면 로딩 애니메이션 표시 */}
              {isLoading && !message.content ? (
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="prose prose-base max-w-none text-text prose-headings:text-text prose-strong:text-text prose-code:text-text prose-pre:bg-light prose-pre:text-text">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {/* 어시스턴트 메시지 복사 버튼 */}
                  {message.content && (
                    <div className="flex justify-start pt-1">
                      <button
                        onClick={handleCopy}
                        className={`p-1 text-secondary hover:text-text transition-all duration-200 ${
                          showCopyButton ? 'opacity-100' : 'opacity-0'
                        }`}
                        title="메시지 복사"
                      >
                        {copied ? <Check size={14} className="text-success" /> : <Clipboard size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};