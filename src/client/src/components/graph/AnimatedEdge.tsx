import { memo } from 'react';
import { type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import type { GraphEdgeData } from './types';

const ACCENT_COLOR = '#58a6ff';
const RETURN_COLOR = '#22c55e';
const BORDER_COLOR = '#30363d';

export type EdgeDirection = 'down' | 'up' | null;

function AnimatedEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
    offset: 20,
  });

  const edgeData = (data as GraphEdgeData | undefined) ?? {
    direction: null,
    isDimmed: false,
    reducedMotion: false,
  };
  const isReverse = edgeData.direction === 'up';
  const isActive = edgeData.direction !== null;
  const strokeColor = isActive ? (isReverse ? RETURN_COLOR : ACCENT_COLOR) : BORDER_COLOR;

  const className = [
    edgeData.isDimmed ? 'opacity-25' : 'opacity-100',
    edgeData.reducedMotion || !isActive
      ? ''
      : isReverse
        ? 'graph-edge-return'
        : 'graph-edge-flow',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <path
      d={edgePath}
      fill="none"
      stroke={strokeColor}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      className={className}
      style={{
        transition: 'opacity 200ms ease, stroke 200ms ease, stroke-width 200ms ease',
        strokeDasharray: isActive ? '10 8' : undefined,
      }}
    />
  );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);
