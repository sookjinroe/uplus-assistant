import React, { useState } from 'react';
import { ChatSession } from '../types/chat';
import { MessageSquare, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { Dropdown, DropdownItem } from './Dropdown';

// 타이틀 표시용 함수 (사이드바용 - 더 짧게)
const getDisplayTitle = (title: string, maxLength: number = 30): string => {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength) + '...';
};

interface ChatHistoryProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, newTitle: string) => void;
  onNewSession: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  sessions,
  currentSessionId,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleRenameStart = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleRenameSubmit = (sessionId: string) => {
    if (editingTitle.trim()) {
      onSessionRename(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleRenameCancel = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(sessionId);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleSessionClick = (sessionId: string) => {
    if (editingSessionId !== sessionId) {
      onSessionSelect(sessionId);
    }
  };

  return (
    <div className="flex-1 overflow-y-scroll">
      {sessions.length === 0 ? (
        <div className="p-4 text-center text-slate-500">
          <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
          <p>아직 채팅 기록이 없습니다</p>
        </div>
      ) : (
        <div className="p-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative mb-1 rounded-lg transition-colors ${
                session.id === currentSessionId
                  ? 'bg-slate-200'
                  : 'hover:bg-slate-200'
              }`}
            >
              {/* Main session content - clickable area */}
              <div 
                className="p-3 pr-10 cursor-pointer"
                onClick={() => handleSessionClick(session.id)}
              >
                {editingSessionId === session.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleRenameSubmit(session.id)}
                    onKeyDown={(e) => handleKeyDown(e, session.id)}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    maxLength={50}
                  />
                ) : (
                  <h3 className="font-medium text-slate-800 truncate">
                    {getDisplayTitle(session.title)}
                  </h3>
                )}
              </div>

              {/* Dropdown menu - positioned absolutely */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Dropdown
                  trigger={
                    <button className="p-1 rounded hover:bg-slate-300 transition-colors">
                      <MoreVertical size={16} className="text-slate-600" />
                    </button>
                  }
                  className="dropdown-left"
                >
                  <DropdownItem
                    onClick={() => {
                      handleRenameStart(session);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Edit2 size={14} />
                      이름 변경
                    </div>
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => onSessionDelete(session.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <div className="flex items-center gap-2">
                      <Trash2 size={14} />
                      삭제
                    </div>
                  </DropdownItem>
                </Dropdown>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};