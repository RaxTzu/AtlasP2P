'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 300 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const getPosition = () => {
    switch (position) {
      case 'bottom':
        return 'top-full mt-2';
      case 'left':
        return 'right-full mr-2 top-1/2 -translate-y-1/2';
      case 'right':
        return 'left-full ml-2 top-1/2 -translate-y-1/2';
      default: // top
        return 'bottom-full mb-2';
    }
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div
          className={`absolute ${getPosition()} left-1/2 -translate-x-1/2 z-50 animate-fade-in-scale pointer-events-none`}
          style={{
            animation: 'fadeInScale 0.15s ease-out'
          }}
        >
          <div className="glass-strong border border-border/50 rounded-xl shadow-2xl px-4 py-3 max-w-xs">
            <div className="text-sm text-foreground">
              {content}
            </div>
          </div>

          {/* Arrow */}
          {position === 'top' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-border/50" />
            </div>
          )}
          {position === 'bottom' && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1">
              <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-border/50" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
