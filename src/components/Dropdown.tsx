import React, { useState, useRef, useEffect } from 'react';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'left' | 'right'>('left');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 드롭다운 위치 계산
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // 트리거가 화면 우측 절반에 있으면 왼쪽으로, 왼쪽 절반에 있으면 오른쪽으로
      if (triggerRect.left > viewportWidth / 2) {
        setPosition('left');
      } else {
        setPosition('right');
      }
    }
  }, [isOpen]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // className에 dropdown-left가 포함되어 있으면 항상 왼쪽으로 열기
  const forceLeft = className.includes('dropdown-left');
  const finalPosition = forceLeft ? 'left' : position;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div ref={triggerRef} onClick={handleTriggerClick}>
        {trigger}
      </div>
      
      {isOpen && (
        <div className={`absolute top-full mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[120px] ${
          finalPosition === 'left' ? 'right-0' : 'left-0'
        }`}>
          <div className="py-1">
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  ...child.props,
                  onClick: () => {
                    child.props.onClick();
                    setIsOpen(false);
                  }
                });
              }
              return child;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface DropdownItemProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({ onClick, children, className = '' }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-light transition-colors ${className}`}
    >
      {children}
    </button>
  );
};