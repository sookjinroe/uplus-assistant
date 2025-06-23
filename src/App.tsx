import React, { useState } from 'react';
import { ChatHistory } from './components/ChatHistory';
import { ChatArea } from './components/ChatArea';
import { Auth } from './components/Auth';
import { useChat } from './hooks/useChat';
import { useAuth } from './hooks/useAuth';
import { Menu, X, ChevronDown, Edit2, Trash2, LogOut, User } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  
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
  } = useChat(user);

  // Show loading spinner while checking auth state
  if (authLoading) {
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
              <h1 className="text-xl font-bold text-slate-800">U+ Assistant</h1>
              
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
                </div>
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col relative">
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
          </div>
        )}

        {/* 빈 채팅일 때 모바일 메뉴 버튼 */}
        {!isCurrentSessionInList && (
          <div className="lg:hidden absolute top-4 left-4 z-10">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg bg-background shadow-md hover:bg-light transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
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
        />
      </div>
    </div>
  );
}

export default App;