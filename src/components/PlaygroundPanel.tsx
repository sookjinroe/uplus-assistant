import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, FileText, Check } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { ChatSession } from '../types/chat';

interface PlaygroundPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: ChatSession | undefined;
  onApply: (
    mainPrompt: string, 
    knowledgeBase: Array<{
      id: string;
      name: string;
      content: string;
      order_index: number;
    }>
  ) => Promise<void>;
}

interface KnowledgeBaseItem {
  id: string;
  name: string;
  content: string;
  order_index: number;
}

export const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({ 
  isOpen, 
  onClose, 
  currentSession,
  onApply 
}) => {
  const [mainPrompt, setMainPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSessionSpecific, setIsSessionSpecific] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentSession]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 플레이그라운드 데이터 로딩 시작...');
      
      // 현재 세션에 플레이그라운드 스냅샷이 있는지 확인
      if (currentSession?.playgroundMainPromptContent || currentSession?.playgroundKnowledgeBaseSnapshot) {
        console.log('📸 세션별 플레이그라운드 스냅샷 로드');
        
        // 세션별 스냅샷 데이터 사용
        const sessionMainPrompt = currentSession.playgroundMainPromptContent || '';
        const sessionKnowledgeBase = currentSession.playgroundKnowledgeBaseSnapshot || [];
        
        setMainPrompt(sessionMainPrompt);
        setKnowledgeBase(sessionKnowledgeBase);
        setIsSessionSpecific(true);
        setHasChanges(false);
        
        console.log('✅ 세션별 플레이그라운드 데이터 로딩 완료:', {
          mainPromptLength: sessionMainPrompt.length,
          knowledgeBaseItems: sessionKnowledgeBase.length
        });
      } else {
        console.log('🌐 전역 플레이그라운드 데이터 로드');
        
        // 전역 데이터베이스에서 로드
        const [mainPromptResult, knowledgeBaseResult] = await Promise.all([
          supabase
            .from('prompts_and_knowledge_base')
            .select('content')
            .eq('type', 'main_prompt')
            .eq('name', 'main_prompt'),
          supabase
            .from('prompts_and_knowledge_base')
            .select('id, name, content, order_index')
            .eq('type', 'knowledge_base')
            .order('order_index', { ascending: true })
        ]);

        if (mainPromptResult.error) {
          console.error('❌ 메인 프롬프트 로드 실패:', mainPromptResult.error);
          throw new Error(`메인 프롬프트 로드 실패: ${mainPromptResult.error.message}`);
        }

        if (knowledgeBaseResult.error) {
          console.error('❌ 지식 기반 로드 실패:', knowledgeBaseResult.error);
          throw new Error(`지식 기반 로드 실패: ${knowledgeBaseResult.error.message}`);
        }

        console.log('📝 메인 프롬프트 데이터:', mainPromptResult.data);
        console.log('📚 지식 기반 데이터:', knowledgeBaseResult.data);

        const mainPromptContent = mainPromptResult.data && mainPromptResult.data.length > 0 
          ? mainPromptResult.data[0].content 
          : '';

        setMainPrompt(mainPromptContent);
        setKnowledgeBase(knowledgeBaseResult.data || []);
        setIsSessionSpecific(false);
        setHasChanges(false);
        
        console.log('✅ 전역 플레이그라운드 데이터 로딩 완료');
      }
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

  const handleApply = async () => {
    if (!hasChanges) return;
    
    setIsApplying(true);
    try {
      await onApply(mainPrompt, knowledgeBase);
      setHasChanges(false);
      setIsSessionSpecific(true); // 적용 후에는 세션별 데이터가 됨
    } catch (error) {
      console.error('적용 중 오류:', error);
      setError(error instanceof Error ? error.message : '적용 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
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
          {isSessionSpecific && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              세션별
            </span>
          )}
          {hasChanges && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              수정됨
            </span>
          )}
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
                disabled={isApplying}
                className="flex-1 px-3 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                초기화
              </button>
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    적용 중...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    적용
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              * 적용하면 이 세션에서만 사용되는 프롬프트가 됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
};