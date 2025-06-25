import React, { useState, useEffect } from 'react';
import { X, Upload, Trash2, FileText, Save } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface PlaygroundPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface KnowledgeBaseItem {
  id: string;
  name: string;
  content: string;
  order_index: number;
}

export const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({ isOpen, onClose }) => {
  const [mainPrompt, setMainPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 메인 프롬프트 가져오기 - single() 대신 배열로 가져와서 안전하게 처리
      const { data: mainPromptData, error: mainPromptError } = await supabase
        .from('prompts_and_knowledge_base')
        .select('content')
        .eq('type', 'main_prompt')
        .eq('name', 'main_prompt');

      if (mainPromptError) {
        console.error('메인 프롬프트 로드 실패:', mainPromptError);
        throw new Error('메인 프롬프트를 불러올 수 없습니다.');
      }

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
        console.error('지식 기반 로드 실패:', knowledgeError);
        throw new Error('지식 기반을 불러올 수 없습니다.');
      }

      setMainPrompt(mainPromptContent);
      setKnowledgeBase(knowledgeData || []);
      setHasChanges(false);
    } catch (err) {
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
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col h-full">
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
              </div>

              {/* Knowledge Base Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    지식 기반 파일
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
                    </div>
                  ) : (
                    knowledgeBase.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText size={16} className="text-slate-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-slate-700 truncate">
                            {item.name}
                          </span>
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

        {/* Footer Actions */}
        {hasChanges && (
          <div className="border-t border-slate-200 p-4">
            <div className="flex gap-2">
              <button
                onClick={resetChanges}
                className="flex-1 px-3 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                초기화
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                disabled
                title="테스트 환경에서는 저장되지 않습니다"
              >
                <Save size={14} />
                저장
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              * 수정사항은 브라우저 세션 동안만 유지됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
};