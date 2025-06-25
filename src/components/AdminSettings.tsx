import React, { useState, useEffect } from 'react';
import { Settings, Database, Users, FileText, X, Upload, Trash2, Rocket, AlertTriangle, Clock, User } from 'lucide-react';
import { useGlobalPrompt } from '../hooks/useGlobalPrompt';

interface AdminSettingsProps {
  onClose: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'prompts' | 'system'>('prompts');
  const [deploymentNotes, setDeploymentNotes] = useState('');
  const [showDeployModal, setShowDeployModal] = useState(false);

  const {
    mainPrompt,
    knowledgeBase,
    deploymentHistory,
    loading,
    deploying,
    error,
    hasChanges,
    loadGlobalData,
    loadDeploymentHistory,
    updateMainPrompt,
    addKnowledgeBaseItem,
    removeKnowledgeBaseItem,
    deployGlobalPrompt,
    resetChanges,
    clearError,
  } = useGlobalPrompt();

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadGlobalData();
    loadDeploymentHistory();
  }, [loadGlobalData, loadDeploymentHistory]);

  const tabs = [
    { id: 'users' as const, label: '사용자 관리', icon: Users },
    { id: 'prompts' as const, label: '전역 프롬프트 관리', icon: FileText },
    { id: 'system' as const, label: '시스템 설정', icon: Database },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // 확장자 제거
      addKnowledgeBaseItem(fileName, content);
    };
    reader.readAsText(file);
    
    // 파일 입력 초기화
    event.target.value = '';
  };

  const handleDeploy = async () => {
    try {
      await deployGlobalPrompt(deploymentNotes.trim() || undefined);
      setDeploymentNotes('');
      setShowDeployModal(false);
    } catch (error) {
      // 에러는 useGlobalPrompt에서 처리됨
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Settings size={24} className="text-primary" />
            <h2 className="text-xl font-semibold text-gray-800">관리자 설정</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-red-500 hover:text-red-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {activeTab === 'users' && (
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
                <h3 className="text-lg font-semibold">전역 프롬프트 관리</h3>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                      수정됨
                    </span>
                  )}
                  <button
                    onClick={() => setShowDeployModal(true)}
                    disabled={deploying || !hasChanges}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Rocket size={16} />
                    {deploying ? '배포 중...' : '전역 프롬프트 배포'}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-gray-600">로딩 중...</span>
                </div>
              ) : (
                <>
                  {/* Main Prompt Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      메인 프롬프트
                    </label>
                    <textarea
                      value={mainPrompt}
                      onChange={(e) => updateMainPrompt(e.target.value)}
                      className="w-full h-40 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      placeholder="메인 프롬프트를 입력하세요..."
                    />
                    {mainPrompt && (
                      <p className="text-xs text-gray-500 mt-1">
                        {mainPrompt.length} 글자
                      </p>
                    )}
                  </div>

                  {/* Knowledge Base Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
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
                        <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                          <FileText size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">업로드된 지식 기반 파일이 없습니다</p>
                          <p className="text-xs mt-1">TXT 또는 MD 파일을 업로드하세요</p>
                        </div>
                      ) : (
                        knowledgeBase.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText size={16} className="text-gray-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-gray-700 truncate block">
                                  {item.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {item.content.length} 글자
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeKnowledgeBaseItem(item.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="파일 제거"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Changes Notice */}
                  {hasChanges && (
                    <div className="flex gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">변경사항이 있습니다</p>
                        <p className="text-xs text-yellow-600 mt-1">
                          배포하면 모든 새로운 채팅에 적용됩니다.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={resetChanges}
                          disabled={deploying}
                          className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Deployment History */}
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">배포 이력</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {deploymentHistory.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <Clock size={24} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">배포 이력이 없습니다</p>
                        </div>
                      ) : (
                        deploymentHistory.map((deployment) => (
                          <div
                            key={deployment.id}
                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Rocket size={14} className="text-green-600" />
                                <span className="text-sm font-medium text-gray-700">
                                  {formatDate(deployment.deployedAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <User size={12} />
                                {deployment.deployedByEmail}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <p>메인 프롬프트: {deployment.mainPromptLength.toLocaleString()} 글자</p>
                              <p>지식 기반: {deployment.knowledgeBaseItems}개 항목</p>
                              {deployment.deploymentNotes && (
                                <p className="italic">"{deployment.deploymentNotes}"</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'system' && (
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

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">전역 프롬프트 배포</h3>
              <p className="text-sm text-gray-600 mb-4">
                변경된 전역 프롬프트와 지식 기반을 배포합니다. 
                배포 후 모든 새로운 채팅에 적용되며, 배포 이력이 자동으로 기록됩니다.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  배포 메모 (선택사항)
                </label>
                <textarea
                  value={deploymentNotes}
                  onChange={(e) => setDeploymentNotes(e.target.value)}
                  className="w-full h-20 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="이번 배포에 대한 메모를 입력하세요..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeployModal(false);
                    setDeploymentNotes('');
                  }}
                  disabled={deploying}
                  className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={deploying}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {deploying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      배포 중...
                    </>
                  ) : (
                    <>
                      <Rocket size={16} />
                      배포하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};