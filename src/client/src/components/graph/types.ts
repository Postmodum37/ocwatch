import type { ActivitySession } from '@shared/types';
import type { EdgeDirection } from './AnimatedEdge';

export type GraphDirection = 'TB' | 'LR';

export interface GraphNodeData extends Record<string, unknown> {
  session: ActivitySession;
  isFocused: boolean;
  isDimmed: boolean;
  collapsedDescendantCount: number;
  onToggleCollapse: (nodeId: string) => void;
}

export interface GraphEdgeData extends Record<string, unknown> {
  direction: EdgeDirection;
  isDimmed: boolean;
  reducedMotion: boolean;
}
