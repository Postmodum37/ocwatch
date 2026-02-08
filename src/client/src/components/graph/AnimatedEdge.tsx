import { memo } from 'react';
import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';

const ACCENT_COLOR = '#58a6ff';
const BORDER_COLOR = '#30363d';
const PARTICLE_COUNT = 3;
const ANIMATION_DURATION = 2; // seconds

export interface AnimatedEdgeData {
  active: boolean;
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

  const isActive = data?.active === true;

  const strokeColor = isActive ? `${ACCENT_COLOR}40` : BORDER_COLOR;
  
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
          
          {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
            <circle
              key={i}
              r="3"
              fill={ACCENT_COLOR}
              className="edge-particle"
            >
              <animateMotion
                dur={`${ANIMATION_DURATION}s`}
                repeatCount="indefinite"
                begin={`${i * (ANIMATION_DURATION / PARTICLE_COUNT)}s`}
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
