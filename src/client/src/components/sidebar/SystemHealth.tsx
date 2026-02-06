import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../store/AppContext';

function formatTimeSince(lastUpdate: number): string {
  const diff = Math.floor((Date.now() - lastUpdate) / 1000);
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m`;
}

export const SystemHealth: React.FC = () => {
  const { lastUpdate, isReconnecting, error } = useAppContext();
  const [timeSince, setTimeSince] = useState<string>(() => formatTimeSince(lastUpdate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSince(formatTimeSince(lastUpdate));
    }, 1000);

    return () => clearInterval(timer);
  }, [lastUpdate]);

  let statusColor = 'bg-green-500';
  let statusText = 'Connected';

  if (error) {
    statusColor = 'bg-red-500';
    statusText = 'Error';
  } else if (isReconnecting) {
    statusColor = 'bg-amber-500';
    statusText = 'Reconnecting';
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 bg-surface border-t border-border text-[10px] text-text-secondary mt-auto"
      data-testid="system-health"
    >
      <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
      <span>{statusText}</span>
      <span>·</span>
      <span>2s poll</span>
      <span>·</span>
      <span>Updated {timeSince} ago</span>
    </div>
  );
};
