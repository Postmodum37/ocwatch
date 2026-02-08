import type { Force, SimulationNodeDatum } from 'd3-force';

const DEFAULT_WIDTH = 250;
const DEFAULT_HEIGHT = 140;
const DEFAULT_PADDING = 24;
const DEFAULT_STRENGTH = 0.9;
const DEFAULT_ITERATIONS = 2;

export interface RectCollisionNode extends SimulationNodeDatum {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface RectCollideOptions {
  width?: number;
  height?: number;
  padding?: number;
  strength?: number;
  iterations?: number;
}

export function collide(options: RectCollideOptions = {}): Force<RectCollisionNode, undefined> {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    padding = DEFAULT_PADDING,
    strength = DEFAULT_STRENGTH,
    iterations = DEFAULT_ITERATIONS,
  } = options;

  let nodes: RectCollisionNode[] = [];

  const horizontalExtent = width + padding;
  const verticalExtent = height + padding;

  const force = () => {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];

        if (a.x == null || a.y == null) {
          continue;
        }

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];

          if (b.x == null || b.y == null) {
            continue;
          }

          const dx = b.x - a.x;
          const dy = b.y - a.y;

          const overlapX = horizontalExtent - Math.abs(dx);
          const overlapY = verticalExtent - Math.abs(dy);

          if (overlapX <= 0 || overlapY <= 0) {
            continue;
          }

          if (overlapX < overlapY) {
            const direction = dx === 0 ? 1 : Math.sign(dx);
            const impulse = overlapX * 0.5 * strength * direction;

            if (a.fx == null) {
              a.vx = (a.vx ?? 0) - impulse;
            }

            if (b.fx == null) {
              b.vx = (b.vx ?? 0) + impulse;
            }
          } else {
            const direction = dy === 0 ? 1 : Math.sign(dy);
            const impulse = overlapY * 0.5 * strength * direction;

            if (a.fy == null) {
              a.vy = (a.vy ?? 0) - impulse;
            }

            if (b.fy == null) {
              b.vy = (b.vy ?? 0) + impulse;
            }
          }
        }
      }
    }
  };

  force.initialize = (initNodes: RectCollisionNode[]) => {
    nodes = initNodes;
  };

  return force;
}
