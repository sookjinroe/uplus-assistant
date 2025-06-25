import { useState, useCallback } from 'react';
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
  const [mainPrompt, setMainPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // 전역 프롬프트 및 지식 기반 로드
  const loadGlobalData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchGlobalPromptAndKnowledgeBase();
      setMainPrompt(data.mainPrompt);
      setKnowledgeBase(data.knowledgeBase);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 배포 이력 로드
  const loadDeploymentHistory = useCallback(async () => {
    try {
      const data = await fetchDeploymentHistory();
      setDeploymentHistory(data.deploymentHistory || []);
    } catch (err) {
      console.error('Failed to load deployment history:', err);
      // 배포 이력 로드 실패는 전체 기능을 막지 않음
    }
  }, []);

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

  // 전역 프롬프트 저장
  const saveGlobalPrompt = useCallback(async () => {
    if (!hasChanges) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await updateGlobalPromptAndKnowledgeBase(mainPrompt, knowledgeBase);
      setHasChanges(false);
      
      // 저장 후 배포 이력 새로고침
      await loadDeploymentHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [mainPrompt, knowledgeBase, hasChanges, loadDeploymentHistory]);

  // 배포 스냅샷 저장
  const saveSnapshot = useCallback(async (deploymentNotes?: string) => {
    setSnapshotSaving(true);
    setError(null);
    
    try {
      await saveDeploymentSnapshot(deploymentNotes);
      
      // 스냅샷 저장 후 배포 이력 새로고침
      await loadDeploymentHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : '스냅샷 저장 중 오류가 발생했습니다.');
      throw err;
    } finally {
      setSnapshotSaving(false);
    }
  }, [loadDeploymentHistory]);

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
    saving,
    snapshotSaving,
    error,
    hasChanges,
    
    // 액션
    loadGlobalData,
    loadDeploymentHistory,
    updateMainPrompt,
    addKnowledgeBaseItem,
    removeKnowledgeBaseItem,
    saveGlobalPrompt,
    saveSnapshot,
    resetChanges,
    clearError,
  };
};