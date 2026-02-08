import { memo } from 'react';
import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';

const ACCENT_COLOR = '#58a6ff';
const RETURN_COLOR = '#22c55e';
const BORDER_COLOR = '#30363d';
const ANIMATION_DURATION = 2; // seconds
const PARTICLE_OFFSETS = [0, 1, 2] as const;

export type EdgeDirection = 'down' | 'up' | null;

export interface AnimatedEdgeData {
  direction: EdgeDirection;
  [key: string]: unknown;
}

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const direction = (data as AnimatedEdgeData | undefined)?.direction ?? null;
  const isActive = direction !== null;
  const isReverse = direction === 'up';
  const particleColor = isReverse ? RETURN_COLOR : ACCENT_COLOR;

  const strokeColor = isActive ? `${particleColor}40` : BORDER_COLOR;
  
  const edgeStyle = {
    ...style,
    stroke: strokeColor,
    strokeWidth: 2,
    transition: 'stroke 0.3s ease, stroke-width 0.3s ease',
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      
      {isActive && (
        <g>
          <path
            id={`edge-path-${id}`}
            d={edgePath}
            fill="none"
            stroke="none"
          />
          
          {PARTICLE_OFFSETS.map((offset) => (
            <circle
              key={`${id}-${direction}-p${offset}`}
              r="3"
              fill={particleColor}
              className={isReverse ? 'edge-particle-return' : 'edge-particle'}
            >
              <animateMotion
                dur={`${ANIMATION_DURATION}s`}
                repeatCount="indefinite"
                begin={`${offset * (ANIMATION_DURATION / PARTICLE_OFFSETS.length)}s`}
                {...(isReverse
                  ? { keyPoints: '1;0', keyTimes: '0;1', calcMode: 'linear' }
                  : {})}
              >
                <mpath href={`#edge-path-${id}`} />
              </animateMotion>
            </circle>
          ))}
        </g>
      )}
    </>
  );
}

export const AnimatedEdge = memo(AnimatedEdgeComponent);
