'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

type SnapPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

interface DraggablePanelProps {
  children: ReactNode;
  storageKey: string;
  defaultPosition?: SnapPosition;
  width?: string;
}

export function DraggablePanel({
  children,
  storageKey,
  defaultPosition = 'top-right',
  width = 'w-72',
}: DraggablePanelProps) {
  const [position, setPosition] = useState<SnapPosition>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tempPosition, setTempPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const validPositions: SnapPosition[] = [
      'top-left', 'top-center', 'top-right',
      'middle-left', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right'
    ];
    if (saved && validPositions.includes(saved as SnapPosition)) {
      setPosition(saved as SnapPosition);
    }
  }, [storageKey]);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, position);
  }, [position, storageKey]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'A'
    ) {
      return;
    }

    if (!panelRef.current) return;
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({ x: clientX - rect.left, y: clientY - rect.top });
    setTempPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      setTempPosition({
        x: clientX - dragOffset.x,
        y: clientY - dragOffset.y,
      });
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!panelRef.current) return;

      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
      const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;

      // Calculate which position to snap to (3x3 grid minus center)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const rect = panelRef.current.getBoundingClientRect();
      const centerX = clientX - dragOffset.x + rect.width / 2;
      const centerY = clientY - dragOffset.y + rect.height / 2;

      // Determine horizontal position (left, center, right)
      let horizontal: 'left' | 'center' | 'right';
      if (centerX < viewportWidth / 3) {
        horizontal = 'left';
      } else if (centerX > (viewportWidth * 2) / 3) {
        horizontal = 'right';
      } else {
        horizontal = 'center';
      }

      // Determine vertical position (top, middle, bottom)
      let vertical: 'top' | 'middle' | 'bottom';
      if (centerY < viewportHeight / 3) {
        vertical = 'top';
      } else if (centerY > (viewportHeight * 2) / 3) {
        vertical = 'bottom';
      } else {
        vertical = 'middle';
      }

      // Combine to get snap position (skip middle-center as it would cover the map)
      let newPosition: SnapPosition;
      if (vertical === 'middle' && horizontal === 'center') {
        // Default to top-right if dragged to center
        newPosition = 'top-right';
      } else {
        newPosition = `${vertical}-${horizontal}` as SnapPosition;
      }

      setPosition(newPosition);
      setIsDragging(false);
      setTempPosition(null);
    };

    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset]);

  // Get position classes based on snap position
  // Uses responsive positioning: left-4 on mobile, left-[21rem] (after stats panel) on desktop
  const getPositionClasses = () => {
    const positions: Record<SnapPosition, string> = {
      'top-left': 'top-4 left-4 lg:left-[21rem]', // After stats panel on desktop
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'top-right': 'top-4 right-4',
      'middle-left': 'top-1/2 -translate-y-1/2 left-4 lg:left-[21rem]',
      'middle-right': 'top-1/2 -translate-y-1/2 right-4',
      'bottom-left': 'bottom-24 left-4 lg:left-[21rem]', // Above map controls
      'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2', // Above map controls
      'bottom-right': 'bottom-24 right-4', // Above map controls
    };
    return positions[position];
  };

  return (
    <div
      ref={panelRef}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
      className={`absolute z-[60] ${width} max-w-[calc(100vw-2rem)] ${
        isDragging ? 'cursor-grabbing select-none opacity-90' : 'cursor-grab'
      } ${!isDragging ? getPositionClasses() : ''} transition-all duration-300 ease-out`}
      style={
        isDragging && tempPosition
          ? {
              position: 'fixed',
              left: tempPosition.x,
              top: tempPosition.y,
              zIndex: 9999,
              transition: 'none',
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
