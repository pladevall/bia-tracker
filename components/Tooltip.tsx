'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = 80; // approximate

      // Determine if tooltip should appear above or below
      const showBelow = rect.top < tooltipHeight + 10;
      setPosition(showBelow ? 'bottom' : 'top');

      // Calculate position
      setCoords({
        left: rect.left + rect.width / 2,
        top: showBelow ? rect.bottom + 4 : rect.top - 4,
      });
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
      {mounted && visible && createPortal(
        <span
          className={`fixed z-[9999] px-2 py-1.5 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded shadow-lg max-w-[280px] -translate-x-1/2 ${position === 'top' ? '-translate-y-full' : ''
            }`}
          style={{
            left: coords.left,
            top: coords.top,
            pointerEvents: 'none',
          }}
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
}
