import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';
import {
  fetchGlobalPromptAndKnowledgeBase,
  updateGlobalPromptAndKnowledgeBase,
  saveDeploymentSnapshot,
  fetchDeploymentHistory
} from '../utils/api';

interface KnowledgeBaseItem {
  id: string;
  name: string;
  content: string;
  order_index: number;
}

interface DeploymentHistoryItem {
  id: string;
  deployedAt: string;
  mainPromptLength: number;
  knowledgeBaseItems: number;
  deployedByEmail: string;
  deploymentNotes?: string;
  createdAt: string;
}

export const useGlobalPrompt = () => {
  const { user, session } = useAuth();
  const { role } = useUserRole(user);
  
  const [mainPrompt, setMainPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 전역 프롬프트 및 지식 기반 로드
  const loadGlobalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchGlobalPromptAndKnowledgeBase(session?.access_token);
      setMainPrompt(data.mainPrompt);
      setKnowledgeBase(data.knowledgeBase);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  // 배포 이력 로드
  const loadDeploymentHistory = useCallback(async () => {
    // 관리자가 아닌 경우 배포 이력을 로드하지 않음
    if (role !== 'admin') {
      setDeploymentHistory([]);
      return;
    }

    try {
      const data = await fetchDeploymentHistory(session?.access_token);
      setDeploymentHistory(data.deploymentHistory || []);
    } catch (err) {
      console.error('Failed to load deployment history:', err);
      // 배포 이력 로드 실패는 전체 기능을 막지 않음
      setDeploymentHistory([]);
    }
  }, [session?.access_token, role]);

  // 메인 프롬프트 변경
  const updateMainPrompt = useCallback((content: string) => {
    setMainPrompt(content);
    setHasChanges(true);
  }, []);

  // 지식 기반 항목 추가
  const addKnowledgeBaseItem = useCallback((name: string, content: string) => {
    const newItem: KnowledgeBaseItem = {
      id: crypto.randomUUID(),
      name,
      content,
      order_index: knowledgeBase.length + 1
    };
    setKnowledgeBase(prev => [...prev, newItem]);
    setHasChanges(true);
  }, [knowledgeBase.length]);

  // 지식 기반 항목 제거
  const removeKnowledgeBaseItem = useCallback((id: string) => {
    setKnowledgeBase(prev => prev.filter(item => item.id !== id));
    setHasChanges(true);
  }, []);

  // 전역 프롬프트 배포 (저장 + 배포 이력 기록을 한 번에)
  const deployGlobalPrompt = useCallback(async (deploymentNotes?: string) => {
    console.log('🚀 배포 시도:', {
      hasChanges,
      role,
      isAdmin: role === 'admin',
      user: user?.email
    });

    if (!hasChanges) {
      console.log('❌ 변경사항이 없어서 배포 중단');
      return;
    }
    
    // 관리자가 아닌 경우 배포 불가
    if (role !== 'admin') {
      const errorMsg = `배포 권한이 없습니다. 관리자만 배포할 수 있습니다. (현재 역할: ${role || 'undefined'})`;
      console.error('❌ 권한 오류:', errorMsg);
      setError(errorMsg);
      return;
    }
    
    setDeploying(true);
    setError(null);
    
    try {
      console.log('📤 전역 프롬프트 저장 중...');
      // 1. 전역 프롬프트 저장
      await updateGlobalPromptAndKnowledgeBase(mainPrompt, knowledgeBase, session?.access_token);
      
      console.log('📸 배포 이력 기록 중...');
      // 2. 배포 이력 기록
      await saveDeploymentSnapshot(deploymentNotes, session?.access_token);
      
      setHasChanges(false);
      
      console.log('🔄 배포 이력 새로고침 중...');
      // 3. 배포 이력 새로고침
      await loadDeploymentHistory();
      
      console.log('✅ 배포 완료');
    } catch (err) {
      console.error('❌ 배포 실패:', err);
      setError(err instanceof Error ? err.message : '배포 중 오류가 발생했습니다.');
      throw err;
    } finally {
      setDeploying(false);
    }
  }, [mainPrompt, knowledgeBase, hasChanges, session?.access_token, loadDeploymentHistory, role, user?.email]);

  // 변경사항 초기화
  const resetChanges = useCallback(() => {
    loadGlobalData();
  }, [loadGlobalData]);

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // 상태
    mainPrompt,
    knowledgeBase,
    deploymentHistory,
    loading,
    deploying,
    error,
    hasChanges,
    isAdmin: role === 'admin', // 직접 계산
    
    // 액션
    loadGlobalData,
    loadDeploymentHistory,
    updateMainPrompt,
    addKnowledgeBaseItem,
    removeKnowledgeBaseItem,
    deployGlobalPrompt,
    resetChanges,
    clearError,
  };
};