import React from 'react';
import { Activity, Clock } from 'lucide-react';
import type { SessionMetadata } from '@shared/types';

interface SessionListProps {
  sessions: SessionMetadata[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const formatRelativeTime = (date: Date | string) => {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export const SessionList: React.FC<SessionListProps> = ({ sessions, selectedId, onSelect }) => {
  return (
    <div className="w-[280px] h-full bg-surface border-r border-border flex flex-col" data-testid="session-list">
      <div className="p-4 border-b border-border">
        <h2 className="text-text-primary font-semibold text-lg">Sessions</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map((session) => {
          const isSelected = session.id === selectedId;
          const lastActive = new Date(session.updatedAt);
          // Active if updated less than 5 minutes ago
          const isActive = (new Date().getTime() - lastActive.getTime()) < 5 * 60 * 1000;

          return (
            <button
              key={session.id}
              data-testid={`session-item-${session.id}`}
              onClick={() => onSelect(session.id)}
              className={`w-full text-left p-3 border-b border-border hover:bg-background transition-colors flex items-start gap-3 group
                ${isSelected ? 'bg-background border-l-2 border-l-accent' : 'border-l-2 border-l-transparent'}
              `}
            >
              <div className="mt-1 shrink-0">
                {isActive ? (
                  <Activity className="w-4 h-4 text-success" />
                ) : (
                  <Clock className="w-4 h-4 text-text-secondary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium truncate text-sm mb-1 ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                  {session.title || 'Untitled Session'}
                </h3>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-text-secondary'}`} />
                  <span className="text-xs text-text-secondary truncate">
                    {formatRelativeTime(session.updatedAt)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
