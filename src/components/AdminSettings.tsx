import React, { useState } from 'react';
import { Settings, Database, Users, FileText, X } from 'lucide-react';

interface AdminSettingsProps {
  onClose: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'prompts' | 'system'>('users');

  const tabs = [
    { id: 'users' as const, label: '사용자 관리', icon: Users },
    { id: 'prompts' as const, label: '프롬프트 관리', icon: FileText },
    { id: 'system' as const, label: '시스템 설정', icon: Database },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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
            <div>
              <h3 className="text-lg font-semibold mb-4">프롬프트 관리</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-600">프롬프트 및 지식 기반 관리 기능이 곧 추가될 예정입니다.</p>
                <ul className="mt-2 text-sm text-gray-500 space-y-1">
                  <li>• 메인 프롬프트 편집</li>
                  <li>• 지식 기반 항목 관리</li>
                  <li>• 세그먼트 정보 업데이트</li>
                  <li>• 카피 가이드라인 수정</li>
                </ul>
              </div>
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
    </div>
  );
};