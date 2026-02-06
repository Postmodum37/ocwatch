import { useState, useEffect, useRef } from 'react';
import { Zap, ChevronDown, Coins, Box } from 'lucide-react';
import type { SessionStats as SessionStatsType } from '@shared/types';
import { formatTokens } from '../utils/formatters';

interface SessionStatsProps {
  stats?: SessionStatsType | null;
}

export function SessionStats({ stats }: SessionStatsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tokensChanged, setTokensChanged] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevTokensRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (stats?.totalTokens !== undefined && prevTokensRef.current !== null) {
      if (stats.totalTokens !== prevTokensRef.current) {
        setTokensChanged(true);
        const timeout = setTimeout(() => setTokensChanged(false), 600);
        return () => clearTimeout(timeout);
      }
    }
    prevTokensRef.current = stats?.totalTokens ?? null;
  }, [stats?.totalTokens]);

  if (!stats) {
    return (
      <div 
        className="inline-flex items-center h-8 px-3 gap-2 bg-surface/50 border border-border/50 rounded-full text-text-secondary text-xs font-medium select-none"
        data-testid="session-stats-empty"
      >
        <Coins className="w-3.5 h-3.5 opacity-50" />
        <span>No stats</span>
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
      className="relative inline-flex items-center h-8 bg-surface border border-border rounded-full shadow-sm select-none"
      data-testid="session-stats"
      ref={dropdownRef}
    >
      <div className="flex items-center gap-1.5 pl-3 pr-3">
        <Zap 
          className={`w-4 h-4 transition-all duration-300 ${tokensChanged ? 'text-white scale-110 drop-shadow-[0_0_6px_#58a6ff]' : 'text-[#58a6ff] scale-100'}`} 
          strokeWidth={2.5} 
        />
        <span className={`font-mono text-sm font-semibold tabular-nums transition-colors duration-300 ${tokensChanged ? 'text-white' : 'text-text-primary'}`}>
          {formattedTokens}
        </span>
      </div>

      <div className="w-px h-3.5 bg-border" />

      <div className="flex items-center gap-2 px-3">
        <Coins className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
        <span className="font-mono text-xs text-text-primary font-medium tracking-tight">
          {formattedCost}
        </span>
      </div>

      <div className="w-px h-3.5 bg-border" />

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group flex items-center gap-2 px-3 pr-4 h-full 
          hover:bg-white/5 transition-all duration-200 
          rounded-r-full outline-none focus:bg-white/5
          ${isOpen ? 'bg-white/5' : ''}
        `}
      >
        <Box className={`w-3.5 h-3.5 ${isOpen ? 'text-purple-400' : 'text-text-secondary group-hover:text-purple-400'} transition-colors duration-200`} strokeWidth={2.5} />
        <span className={`text-xs font-medium ${isOpen ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'} transition-colors duration-200`}>
          {modelCount}
        </span>
        <ChevronDown 
          className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>

      <div 
        className={`
          absolute top-full right-0 mt-2 w-64 
          bg-surface border border-border rounded-xl shadow-2xl 
          origin-top-right transition-all duration-200 z-50 overflow-hidden
          ${isOpen 
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}
        `}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-[#0d1117]/30 border-b border-border">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Model Breakdown</span>
          <span className="text-[10px] font-mono text-text-secondary opacity-70">{modelCount} active</span>
        </div>
        
        <div className="max-h-64 overflow-y-auto py-1">
          {stats.modelBreakdown.map((model) => (
            <div 
              key={model.modelID} 
              className="flex items-center justify-between px-3 py-2 text-xs group hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400/50 group-hover:bg-purple-400 transition-colors shrink-0" />
                <span 
                  className="text-text-secondary group-hover:text-text-primary transition-colors truncate" 
                  title={model.modelID}
                >
                  {model.modelID}
                </span>
              </div>
              <span className="text-text-primary font-mono ml-3 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                {formatTokens(model.tokens)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
