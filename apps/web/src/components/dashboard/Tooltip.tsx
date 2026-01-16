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
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Adjust position if tooltip would go out of bounds
  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let newPosition = position;

      // Check if tooltip goes out of viewport and adjust
      if (position === 'top' && tooltipRect.top < 0) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && tooltipRect.bottom > viewportHeight) {
        newPosition = 'top';
      } else if (position === 'left' && tooltipRect.left < 0) {
        newPosition = 'right';
      } else if (position === 'right' && tooltipRect.right > viewportWidth) {
        newPosition = 'left';
      }

      setAdjustedPosition(newPosition);
    }
  }, [isVisible, position]);

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
    switch (adjustedPosition) {
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
          ref={tooltipRef}
          className={`absolute ${getPosition()} left-1/2 -translate-x-1/2 z-[999] animate-fade-in-scale pointer-events-none`}
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
          {adjustedPosition === 'top' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-border/50" />
            </div>
          )}
          {adjustedPosition === 'bottom' && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1">
              <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-border/50" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
