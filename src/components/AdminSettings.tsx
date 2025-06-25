import React, { useState, useEffect } from 'react';
import { Settings, Database, Users, FileText, X, Play } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface AdminSettingsProps {
  onClose: () => void;
  isPlayground?: boolean;
  onApplyPlayground?: (mainPrompt: string, knowledgeBaseItems: Array<{ name: string; content: string }>) => void;
}

interface KnowledgeBaseItem {
  name: string;
  content: string;
  order_index: number;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ 
  onClose, 
  isPlayground = false,
  onApplyPlayground 
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'prompts' | 'system'>('prompts');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Playground state
  const [mainPromptContent, setMainPromptContent] = useState('');
  const [knowledgeBaseItems, setKnowledgeBaseItems] = useState<KnowledgeBaseItem[]>([]);

  const tabs = [
    { id: 'users' as const, label: '사용자 관리', icon: Users },
    { id: 'prompts' as const, label: isPlayground ? 'PLAYGROUND' : '프롬프트 관리', icon: isPlayground ? Play : FileText },
    { id: 'system' as const, label: '시스템 설정', icon: Database },
  ];

  // Load prompt and knowledge base data when prompts tab is active
  useEffect(() => {
    if (activeTab === 'prompts') {
      loadPromptData();
    }
  }, [activeTab]);

  const loadPromptData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load main prompt
      const { data: mainPromptData, error: mainPromptError } = await supabase
        .from('prompts_and_knowledge_base')
        .select('content')
        .eq('type', 'main_prompt')
        .eq('name', 'main_prompt')
        .single();

      if (mainPromptError) {
        throw new Error(`메인 프롬프트 로드 실패: ${mainPromptError.message}`);
      }

      // Load knowledge base items
      const { data: knowledgeData, error: knowledgeError } = await supabase
        .from('prompts_and_knowledge_base')
        .select('name, content, order_index')
        .eq('type', 'knowledge_base')
        .order('order_index', { ascending: true });

      if (knowledgeError) {
        throw new Error(`지식 기반 로드 실패: ${knowledgeError.message}`);
      }

      setMainPromptContent(mainPromptData?.content || '');
      setKnowledgeBaseItems(knowledgeData || []);
    } catch (err) {
      console.error('Error loading prompt data:', err);
      setError(err instanceof Error ? err.message : '데이터 로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPlayground = () => {
    if (onApplyPlayground) {
      onApplyPlayground(mainPromptContent, knowledgeBaseItems);
      onClose();
    }
  };

  const updateKnowledgeBaseItem = (index: number, field: 'name' | 'content', value: string) => {
    setKnowledgeBaseItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {isPlayground ? (
              <Play size={24} className="text-primary" />
            ) : (
              <Settings size={24} className="text-primary" />
            )}
            <h2 className="text-xl font-semibold text-gray-800">
              {isPlayground ? 'PLAYGROUND' : '관리자 설정'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        {!isPlayground && (
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary border-b-2 border-primary bg-blue-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {activeTab === 'users' && !isPlayground && (
            <div>
              <h3 className="text-lg font-semibold mb-4">사용자 관리</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600">사용자 관리 기능이 곧 추가될 예정입니다.</p>
                <ul className="mt-2 text-sm text-gray-500 space-y-1">
                  <li>• 사용자 목록 조회</li>
                  <li>• 역할 변경 (admin/user)</li>
                  <li>• 사용자 활동 통계</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {isPlayground ? 'PLAYGROUND - 프롬프트 테스트' : '프롬프트 관리'}
                </h3>
                {isPlayground && (
                  <button
                    onClick={handleApplyPlayground}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    적용
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-gray-600">로딩 중...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Main Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      메인 프롬프트
                    </label>
                    <textarea
                      value={mainPromptContent}
                      onChange={(e) => setMainPromptContent(e.target.value)}
                      className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-sm"
                      placeholder="메인 프롬프트를 입력하세요..."
                    />
                  </div>

                  {/* Knowledge Base Items */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지식 기반 항목들
                    </label>
                    <div className="space-y-4">
                      {knowledgeBaseItems.map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="mb-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              항목 이름
                            </label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateKnowledgeBaseItem(index, 'name', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-sm"
                              placeholder="항목 이름"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              내용
                            </label>
                            <textarea
                              value={item.content}
                              onChange={(e) => updateKnowledgeBaseItem(index, 'content', e.target.value)}
                              className="w-full h-32 p-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent resize-none font-mono text-sm"
                              placeholder="지식 기반 내용을 입력하세요..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'system' && !isPlayground && (
            <div>
              <h3 className="text-lg font-semibold mb-4">시스템 설정</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600">시스템 설정 기능이 곧 추가될 예정입니다.</p>
                <ul className="mt-2 text-sm text-gray-500 space-y-1">
                  <li>• API 키 관리</li>
                  <li>• 로그 조회</li>
                  <li>• 백업 및 복원</li>
                  <li>• 성능 모니터링</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};