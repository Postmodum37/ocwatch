import { memo } from 'react';
import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react';

const AnimatedEdge = ({
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
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isActive = data?.active === true;

  const strokeColor = isActive ? '#58a6ff40' : '#30363d';
  
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
          
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              r="3"
              fill="#58a6ff"
              className="edge-particle"
            >
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                begin={`${i * 0.66}s`}
              >
                <mpath href={`#edge-path-${id}`} />
              </animateMotion>
            </circle>
          ))}
        </g>
      )}
    </>
  );
};

export default memo(AnimatedEdge);
