import { Coins, Zap } from 'lucide-react';
import type { SessionStats as SessionStatsType } from '@shared/types';

interface SessionStatsProps {
  stats?: SessionStatsType | null;
}

export function SessionStats({ stats }: SessionStatsProps) {
  if (!stats) {
    return (
      <div 
        className="flex items-center gap-2 p-4 text-text-secondary bg-surface rounded-lg border border-border"
        data-testid="session-stats-empty"
      >
        <Coins className="w-5 h-5" />
        <span>No stats available</span>
      </div>
    );
  }

  const formattedCost = stats.totalCost !== undefined 
    ? `$${stats.totalCost.toFixed(2)}` 
    : '—';

  return (
    <div 
      className="flex flex-col gap-3 p-4 bg-surface rounded-lg border border-border min-w-[300px]"
      data-testid="session-stats"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text-primary flex items-center gap-2">
          <Zap className="w-4 h-4 text-text-secondary" />
          Session Stats
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4 py-2 border-b border-border">
        <div className="flex flex-col">
          <span className="text-xs text-text-secondary">Total Tokens</span>
          <span className="text-lg font-medium text-text-primary">
            {stats.totalTokens.toLocaleString()} tokens
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-text-secondary">Total Cost</span>
          <span className="text-lg font-medium text-text-primary">
            {formattedCost}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Model Breakdown
        </span>
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {stats.modelBreakdown.map((model) => (
            <div key={model.modelID} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary truncate max-w-[180px]" title={model.modelID}>
                {model.modelID.length > 20 
                  ? model.modelID.slice(0, 20) + '...' 
                  : model.modelID}
              </span>
              <span className="text-text-primary font-mono">
                {model.tokens.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
