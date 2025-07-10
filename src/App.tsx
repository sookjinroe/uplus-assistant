import React, { useState, useEffect } from 'react';
import { ChatHistory } from './components/ChatHistory';
import { ChatArea } from './components/ChatArea';
import { Auth } from './components/Auth';
import { AdminSettings } from './components/AdminSettings';
import { PlaygroundPanel } from './components/PlaygroundPanel';
import { useChat } from './hooks/useChat';
import { useAuth } from './hooks/useAuth';
import { useUserRole } from './hooks/useUserRole';
import { Menu, X, ChevronDown, Edit2, Trash2, LogOut, User, Settings, Play } from 'lucide-react';
import { Dropdown, DropdownItem } from './components/Dropdown';

// 타이틀 표시용 함수 (화면 표시시 말줄임표 추가)
const getDisplayTitle = (title: string, maxLength: number = 40): string => {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength) + '...';
};

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  
  const {
    sessions,
    currentSession,
    isLoading,
    isStreamingContent,
    error,
    sendMessage,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    clearError,
    stopGenerating,
    applyPlaygroundChangesToSession,
    loadMoreMessages,
    loadFullSessionMessages,
  } = useChat(user);

  // 현재 세션의 더 많은 메시지 로드
  const handleLoadMoreMessages = async () => {
    if (!currentSession || currentSession.messages.length === 0) return;
    
    const firstMessage = currentSession.messages[0];
    const moreMessages = await loadMoreMessages(currentSession.id, firstMessage.id);
    
    if (moreMessages.length > 0) {
      // 새로운 메시지들을 현재 세션에 추가
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(session =>
          session.id === currentSession.id
            ? {
                ...session,
                messages: [...moreMessages, ...session.messages]
              }
            : session
        ),
      }));
    }
  };

  // 사용자 역할이 변경될 때 플레이그라운드 패널 자동 닫기
  useEffect(() => {
    if (role !== 'admin' && playgroundOpen) {
      console.log('🔒 일반 사용자로 전환됨 - 플레이그라운드 패널 닫기');
      setPlaygroundOpen(false);
    }
  }, [role, playgroundOpen]);

  // Show loading spinner while checking auth state or user role
  if (authLoading || roleLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if user is not logged in
  if (!user) {
    return <Auth />;
  }

  const handleTitleRenameStart = () => {
    if (currentSession) {
      setEditingTitle(true);
      setTitleValue(currentSession.title);
    }
  };

  const handleTitleRenameSubmit = () => {
    if (currentSession && titleValue.trim()) {
      renameSession(currentSession.id, titleValue.trim());
    }
    setEditingTitle(false);
    setTitleValue('');
  };

  const handleTitleRenameCancel = () => {
    setEditingTitle(false);
    setTitleValue('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleTitleRenameCancel();
    }
  };

  const handleDeleteCurrentSession = () => {
    if (currentSession) {
      deleteSession(currentSession.id);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handlePlaygroundToggle = () => {
    // 관리자만 플레이그라운드 패널을 열 수 있음
    if (role === 'admin') {
      setPlaygroundOpen(!playgroundOpen);
    } else {
      console.warn('⚠️ 일반 사용자는 플레이그라운드에 접근할 수 없습니다.');
    }
  };

  // 현재 세션이 sessions 배열에 있는지 확인 (빈 세션이 아닌지)
  const isCurrentSessionInList = currentSession && sessions.some(s => s.id === currentSession.id);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-dark bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed lg:relative lg:translate-x-0 z-30 transition-transform duration-300 ease-in-out h-full`}>
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col h-full">
          {/* Header with service name and user info */}
          <div className="p-4 pb-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800">U+ Assistant</h1>
                {role === 'admin' && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    ADMIN
                  </span>
                )}
              </div>
              
              {/* User Menu */}
              <Dropdown
                trigger={
                  <button className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
                    <User size={20} className="text-slate-600" />
                  </button>
                }
                className="dropdown-left"
              >
                <div className="px-3 py-2 border-b border-slate-200">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {user.email}
                  </p>
                  {role === 'admin' && (
                    <p className="text-xs text-red-600 font-medium">관리자</p>
                  )}
                </div>
                {role === 'admin' && (
                  <DropdownItem
                    onClick={() => setShowAdminSettings(true)}
                    className="text-primary hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-2">
                      <Settings size={14} />
                      관리자 설정
                    </div>
                  </DropdownItem>
                )}
                <DropdownItem
                  onClick={handleSignOut}
                  className="text-red-600 hover:bg-red-50"
                >
                  <div className="flex items-center gap-2">
                    <LogOut size={14} />
                    로그아웃
                  </div>
                </DropdownItem>
              </Dropdown>
            </div>
            
            <button
              onClick={createNewSession}
              className="w-full flex items-center gap-2 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors group"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">새 채팅</span>
            </button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto">
            <ChatHistory
              sessions={sessions}
              currentSessionId={currentSession?.id || null}
              onSessionSelect={switchSession}
              onSessionDelete={deleteSession}
              onSessionRename={renameSession}
              onNewSession={createNewSession}
            />
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex relative">
        {/* Chat area */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          playgroundOpen ? 'mr-96' : ''
        }`}>
          {/* Header - 세션이 목록에 있을 때만 표시 */}
          {isCurrentSessionInList && (
            <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-background via-background/80 to-transparent pt-6">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-light transition-colors flex-shrink-0"
                >
                  {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {editingTitle ? (
                    <input
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onBlur={handleTitleRenameSubmit}
                      onKeyDown={handleTitleKeyDown}
                      className="text-xl font-semibold text-text bg-background border border-primary rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-0 flex-1"
                      autoFocus
                      maxLength={50}
                    />
                  ) : (
                    <h1 className="text-xl font-semibold text-text truncate min-w-0">
                      {getDisplayTitle(currentSession?.title || 'AI Chat')}
                    </h1>
                  )}
                  
                  {/* 드롭다운 메뉴 */}
                  {!editingTitle && (
                    <Dropdown
                      trigger={
                        <button className="p-1 rounded hover:bg-light transition-colors flex-shrink-0">
                          <ChevronDown size={16} className="text-secondary" />
                        </button>
                      }
                    >
                      <DropdownItem onClick={handleTitleRenameStart}>
                        <div className="flex items-center gap-2">
                          <Edit2 size={14} />
                          이름 변경
                        </div>
                      </DropdownItem>
                      <DropdownItem
                        onClick={handleDeleteCurrentSession}
                        className="text-error hover:bg-error/10"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 size={14} />
                          삭제
                        </div>
                      </DropdownItem>
                    </Dropdown>
                  )}
                </div>
              </div>

              {/* PLAYGROUND 버튼 - 관리자만 표시 */}
              {role === 'admin' && (
                <button
                  onClick={handlePlaygroundToggle}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                    playgroundOpen
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Play size={16} />
                  PLAYGROUND
                </button>
              )}
            </div>
          )}

          {/* 빈 채팅일 때 모바일 메뉴 버튼과 PLAYGROUND 버튼 */}
          {!isCurrentSessionInList && (
            <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg bg-background shadow-md hover:bg-light transition-colors"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              {/* PLAYGROUND 버튼 - 관리자만 표시 */}
              {role === 'admin' && (
                <button
                  onClick={handlePlaygroundToggle}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors shadow-md ${
                    playgroundOpen
                      ? 'bg-primary text-white'
                      : 'bg-background text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Play size={16} />
                  PLAYGROUND
                </button>
              )}
            </div>
          )}

          {/* Chat area */}
          <ChatArea
            messages={currentSession?.messages || []}
            isLoading={isLoading}
            isStreamingContent={isStreamingContent}
            error={error}
            onSendMessage={sendMessage}
            onStopGenerating={stopGenerating}
            onClearError={clearError}
            hasHeader={isCurrentSessionInList}
            onLoadMoreMessages={handleLoadMoreMessages}
            hasMoreMessages={currentSession?.hasMoreMessages || false}
          />
        </div>

        {/* Playground Panel - 관리자만 렌더링 */}
        {role === 'admin' && (
          <PlaygroundPanel 
            isOpen={playgroundOpen}
            onClose={() => setPlaygroundOpen(false)}
            currentSession={currentSession}
            onApply={applyPlaygroundChangesToSession}
          />
        )}
      </div>

      {/* Admin Settings Modal */}
      {showAdminSettings && role === 'admin' && (
        <AdminSettings onClose={() => setShowAdminSettings(false)} />
      )}
    </div>
  );
}

export default App;