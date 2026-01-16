'use client';

import { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  smooth?: boolean;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = '#10b981',
  showDots = false,
  smooth = true
}: SparklineProps) {
  const points = useMemo(() => {
    if (data.length === 0) return '';

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const xStep = width / (data.length - 1 || 1);

    return data.map((value, i) => {
      const x = i * xStep;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  }, [data, width, height]);

  const path = useMemo(() => {
    if (!points) return '';
    const coords = points.split(' ');
    if (coords.length === 0) return '';

    if (!smooth) {
      return `M ${points.split(' ').join(' L ')}`;
    }

    // Smooth curve using quadratic bezier
    let d = `M ${coords[0]}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i].split(',').map(Number);
      const [x2, y2] = coords[i + 1].split(',').map(Number);
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      d += ` Q ${x1},${y1} ${cx},${cy}`;
    }
    const lastCoord = coords[coords.length - 1];
    d += ` L ${lastCoord}`;
    return d;
  }, [points, smooth]);

  if (data.length === 0) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d={`${path} L ${width},${height} L 0,${height} Z`}
        fill={`url(#gradient-${color})`}
      />

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-sm"
      />

      {/* Dots */}
      {showDots && points.split(' ').map((point, i) => {
        const [x, y] = point.split(',').map(Number);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2.5"
            fill={color}
            className="drop-shadow-sm"
          />
        );
      })}
    </svg>
  );
}
