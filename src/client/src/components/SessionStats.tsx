import { useState, useEffect, useRef } from 'react';
import { Zap, ChevronDown, Coins } from 'lucide-react';
import type { SessionStats as SessionStatsType } from '@shared/types';

interface SessionStatsProps {
  stats?: SessionStatsType | null;
}

const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return tokens.toString();
};

export function SessionStats({ stats }: SessionStatsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!stats) {
    return (
      <div 
        className="inline-flex items-center gap-2 px-3 py-1.5 text-text-secondary text-sm"
        data-testid="session-stats-empty"
      >
        <Coins className="w-4 h-4" />
        <span>No stats available</span>
      </div>
    );
  }

  const formattedCost = stats.totalCost !== undefined 
    ? `$${stats.totalCost.toFixed(2)}` 
    : '—';
  const formattedTokens = formatTokens(stats.totalTokens);
  const modelCount = stats.modelBreakdown.length;

  return (
    <div 
      className="inline-flex items-center gap-3 px-3 py-1.5 text-sm text-text-primary"
      data-testid="session-stats"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Zap className="w-4 h-4 text-text-secondary" />
          <span className="font-mono">{formattedTokens}</span>
        </div>
        <span className="text-text-secondary">|</span>
        <span className="font-mono">{formattedCost}</span>
        <span className="text-text-secondary">|</span>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-surface transition-colors text-text-primary text-sm"
        >
          <span>{modelCount} model{modelCount !== 1 ? 's' : ''}</span>
          <ChevronDown 
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div 
            className="absolute top-full right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 min-w-[240px]"
          >
            <div className="max-h-64 overflow-y-auto">
              {stats.modelBreakdown.map((model) => (
                <div 
                  key={model.modelID} 
                  className="flex items-center justify-between px-3 py-2 text-sm border-b border-border last:border-b-0 hover:bg-background transition-colors"
                >
                  <span 
                    className="text-text-secondary truncate max-w-[140px]" 
                    title={model.modelID}
                  >
                    {model.modelID.length > 20 
                      ? model.modelID.slice(0, 20) + '...' 
                      : model.modelID}
                  </span>
                  <span className="text-text-primary font-mono ml-2 shrink-0">
                    {formatTokens(model.tokens)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
