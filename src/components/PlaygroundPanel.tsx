import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, FileText, Zap } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { useChat } from '../hooks/useChat';
import { ChatSession, KnowledgeBaseItem } from '../types/chat';

interface PlaygroundPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession?: ChatSession;
  user: User | null;
}

export const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({ 
  isOpen, 
  onClose, 
  currentSession,
  user 
}) => {
  const [mainPrompt, setMainPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [applying, setApplying] = useState(false);

  const { applyPlaygroundChanges } = useChat(user);

  // 데이터 로드 (세션 변경 시에도 반응)
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentSession?.id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 플레이그라운드 데이터 로딩 시작...', {
        sessionId: currentSession?.id,
        hasPlaygroundData: !!(currentSession?.playgroundMainPromptContent || currentSession?.playgroundKnowledgeBaseSnapshot)
      });
      
      // 현재 세션에 플레이그라운드 데이터가 있는지 확인
      if (currentSession?.playgroundMainPromptContent || currentSession?.playgroundKnowledgeBaseSnapshot) {
        console.log('🎮 세션별 플레이그라운드 데이터 로드');
        
        setMainPrompt(currentSession.playgroundMainPromptContent || '');
        setKnowledgeBase(currentSession.playgroundKnowledgeBaseSnapshot || []);
        setHasChanges(false);
        
        console.log('✅ 세션별 플레이그라운드 데이터 로딩 완료');
        return;
      }

      // 세션에 플레이그라운드 데이터가 없으면 기본 데이터 로드
      console.log('📋 기본 프롬프트 및 지식 기반 데이터 로드');
      
      // 메인 프롬프트 가져오기
      const { data: mainPromptData, error: mainPromptError } = await supabase
        .from('prompts_and_knowledge_base')
        .select('content')
        .eq('type', 'main_prompt')
        .eq('name', 'main_prompt');

      if (mainPromptError) {
        console.error('❌ 메인 프롬프트 로드 실패:', mainPromptError);
        throw new Error(`메인 프롬프트 로드 실패: ${mainPromptError.message}`);
      }

      console.log('📝 메인 프롬프트 데이터:', mainPromptData);

      // 메인 프롬프트가 없으면 빈 문자열로 초기화
      const mainPromptContent = mainPromptData && mainPromptData.length > 0 
        ? mainPromptData[0].content 
        : '';

      // 지식 기반 항목들 가져오기
      const { data: knowledgeData, error: knowledgeError } = await supabase
        .from('prompts_and_knowledge_base')
        .select('id, name, content, order_index')
        .eq('type', 'knowledge_base')
        .order('order_index', { ascending: true });

      if (knowledgeError) {
        console.error('❌ 지식 기반 로드 실패:', knowledgeError);
        throw new Error(`지식 기반 로드 실패: ${knowledgeError.message}`);
      }

      console.log('📚 지식 기반 데이터:', knowledgeData);

      setMainPrompt(mainPromptContent);
      setKnowledgeBase(knowledgeData || []);
      setHasChanges(false);
      
      console.log('✅ 기본 플레이그라운드 데이터 로딩 완료');
    } catch (err) {
      console.error('❌ 데이터 로딩 오류:', err);
      setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleMainPromptChange = (value: string) => {
    setMainPrompt(value);
    setHasChanges(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // 확장자 제거
      
      const newItem: KnowledgeBaseItem = {
        id: crypto.randomUUID(),
        name: fileName,
        content: content,
        order_index: knowledgeBase.length + 1
      };

      setKnowledgeBase(prev => [...prev, newItem]);
      setHasChanges(true);
    };
    reader.readAsText(file);
    
    // 파일 입력 초기화
    event.target.value = '';
  };

  const removeKnowledgeItem = (id: string) => {
    setKnowledgeBase(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const resetChanges = () => {
    loadData();
  };

  const handleApplyChanges = async () => {
    if (!applyPlaygroundChanges) {
      setError('플레이그라운드 변경사항을 적용할 수 없습니다. 활성 세션이 필요합니다.');
      return;
    }

    setApplying(true);
    setError(null);

    try {
      await applyPlaygroundChanges(mainPrompt, knowledgeBase);
      setHasChanges(false);
      console.log('✅ 플레이그라운드 변경사항 적용 완료');
    } catch (error) {
      console.error('❌ 플레이그라운드 변경사항 적용 실패:', error);
      setError(error instanceof Error ? error.message : '변경사항 적용 중 오류가 발생했습니다.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={`fixed top-0 right-0 h-full bg-white border-l border-slate-200 shadow-lg z-40 transition-transform duration-300 ease-in-out ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`} style={{ width: '384px' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-800">PLAYGROUND</h2>
          {hasChanges && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              수정됨
            </span>
          )}
          {currentSession?.playgroundMainPromptContent || currentSession?.playgroundKnowledgeBaseSnapshot ? (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              세션별
            </span>
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      {/* Content - 고정 높이와 스크롤 영역 설정 */}
      <div className="flex flex-col" style={{ height: 'calc(100vh - 73px)' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-slate-600">로딩 중...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={loadData}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Main Prompt Section */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  메인 프롬프트
                </label>
                <textarea
                  value={mainPrompt}
                  onChange={(e) => handleMainPromptChange(e.target.value)}
                  className="w-full h-40 p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="메인 프롬프트를 입력하세요..."
                />
                {mainPrompt && (
                  <p className="text-xs text-slate-500 mt-1">
                    {mainPrompt.length} 글자
                  </p>
                )}
              </div>

              {/* Knowledge Base Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    지식 기반 파일 ({knowledgeBase.length}개)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 cursor-pointer transition-colors">
                    <Upload size={14} />
                    업로드
                    <input
                      type="file"
                      accept=".txt,.md"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  {knowledgeBase.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      <FileText size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">업로드된 지식 기반 파일이 없습니다</p>
                      <p className="text-xs mt-1">TXT 또는 MD 파일을 업로드하세요</p>
                    </div>
                  ) : (
                    knowledgeBase.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText size={16} className="text-slate-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-slate-700 truncate block">
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {item.content.length} 글자
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeKnowledgeItem(item.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="파일 제거"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions - 하단에 고정 */}
        {hasChanges && (
          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex gap-2">
              <button
                onClick={resetChanges}
                disabled={applying}
                className="flex-1 px-3 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                초기화
              </button>
              <button
                onClick={handleApplyChanges}
                disabled={applying}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    적용 중...
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    적용
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              * 현재 세션에만 적용되며, 원본 데이터는 변경되지 않습니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
};