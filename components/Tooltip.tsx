'use client';

import { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition(rect.top < 60 ? 'bottom' : 'top');
    }
  }, [visible]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={`absolute z-[9999] px-2 py-1.5 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg min-w-max max-w-[280px] left-1/2 -translate-x-1/2 ${position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
