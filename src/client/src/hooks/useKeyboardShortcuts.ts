import { useEffect, useCallback } from 'react';
import type { SessionSummary } from '@shared/types';

export function useKeyboardShortcuts(options: {
  sessions: SessionSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { sessions, selectedId, onSelect } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA'
    ) {
      return;
    }

    if (event.key === 'Escape') {
      onSelect(null);
      return;
    }

    if (
      event.key === 'j' ||
      event.key === 'ArrowDown' ||
      event.key === 'k' ||
      event.key === 'ArrowUp'
    ) {
      const sortedSessions = [...sessions].sort((a, b) => {
        const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
      });

      const currentIndex = sortedSessions.findIndex((s) => s.id === selectedId);

      if (event.key === 'j' || event.key === 'ArrowDown') {
        if (currentIndex === -1) {
          if (sortedSessions.length > 0) {
            onSelect(sortedSessions[0].id);
          }
        } else if (currentIndex < sortedSessions.length - 1) {
          onSelect(sortedSessions[currentIndex + 1].id);
        }
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        if (currentIndex > 0) {
          onSelect(sortedSessions[currentIndex - 1].id);
        }
      }
    }
  }, [sessions, selectedId, onSelect]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
