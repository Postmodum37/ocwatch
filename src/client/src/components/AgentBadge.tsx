import type { SessionStatus } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';

interface AgentBadgeProps {
  agent: string;
  status?: SessionStatus;
  className?: string;
}

export const AgentBadge: React.FC<AgentBadgeProps> = ({ agent, status, className = '' }) => {
  const baseColor = getAgentColor(agent);
  const isWorking = status === 'working';
  
  return (
    <span 
      className={`
        inline-flex items-center 
        px-2.5 py-1 
        rounded-md 
        text-white text-xs font-semibold
        shrink-0
        ${isWorking ? 'animate-badge-glow' : ''}
        ${className}
      `}
      style={{ 
        backgroundColor: baseColor,
        '--badge-color': `${baseColor}60`,
      } as React.CSSProperties}
    >
      {agent}
    </span>
  );
};
