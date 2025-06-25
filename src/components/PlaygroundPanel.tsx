import React from 'react';
import { X } from 'lucide-react';

interface PlaygroundPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({ isOpen, onClose }) => {
  return (
    <div className={`fixed top-0 right-0 h-full bg-white border-l border-slate-200 shadow-lg z-40 transition-transform duration-300 ease-in-out ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`} style={{ width: '384px' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">PLAYGROUND</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="text-center text-slate-500">
          <p>플레이그라운드 기능이 곧 추가될 예정입니다.</p>
        </div>
      </div>
    </div>
  );
};