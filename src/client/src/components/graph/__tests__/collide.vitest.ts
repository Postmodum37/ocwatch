import { describe, it, expect } from 'vitest';
import { collide, type RectCollisionNode } from '../collide';

function runForce(nodes: RectCollisionNode[], options?: Parameters<typeof collide>[0]) {
  const force = collide(options);
  force.initialize?.(nodes, () => 0.5);
  force(1);
}

describe('collide', () => {
  it('separates overlapping nodes along minimum overlap axis', () => {
    const a: RectCollisionNode = { x: 0, y: 0, vx: 0, vy: 0 };
    const b: RectCollisionNode = { x: 260, y: 10, vx: 0, vy: 0 };

    runForce([a, b], { iterations: 1 });

    expect(a.vx).toBeCloseTo(-37.8, 5);
    expect(b.vx).toBeCloseTo(37.8, 5);
    expect(a.vy).toBe(0);
    expect(b.vy).toBe(0);
  });

  it('does not modify velocities of non-overlapping nodes', () => {
    const a: RectCollisionNode = { x: 0, y: 0, vx: 2, vy: -3 };
    const b: RectCollisionNode = { x: 1000, y: 1000, vx: -1, vy: 4 };

    runForce([a, b], { iterations: 1 });

    expect(a.vx).toBe(2);
    expect(a.vy).toBe(-3);
    expect(b.vx).toBe(-1);
    expect(b.vy).toBe(4);
  });

  it('respects fixed nodes and does not apply impulse to them', () => {
    const a: RectCollisionNode = { x: 0, y: 0, vx: 0, fx: 0 };
    const b: RectCollisionNode = { x: 260, y: 10, vx: 0 };

    runForce([a, b], { iterations: 1 });

    expect(a.vx).toBe(0);
    expect(b.vx).toBeCloseTo(37.8, 5);
  });

  it('handles identical positions deterministically by pushing positive Y direction', () => {
    const a: RectCollisionNode = { x: 50, y: 50, vy: 0 };
    const b: RectCollisionNode = { x: 50, y: 50, vy: 0 };

    runForce([a, b], { iterations: 1 });

    expect(a.vy).toBeCloseTo(-73.8, 5);
    expect(b.vy).toBeCloseTo(73.8, 5);
  });

  it('skips nodes with null or undefined coordinates', () => {
    const valid: RectCollisionNode = { x: 0, y: 0, vx: 5, vy: -5 };
    const nullX = { x: null, y: 0, vx: 1, vy: 1 } as unknown as RectCollisionNode;
    const undefinedY: RectCollisionNode = { x: 0, y: undefined, vx: 2, vy: 2 };

    runForce([valid, nullX, undefinedY], { iterations: 1 });

    expect(valid.vx).toBe(5);
    expect(valid.vy).toBe(-5);
    expect(nullX.vx).toBe(1);
    expect(undefinedY.vy).toBe(2);
  });

  it('runs multiple iterations when configured', () => {
    const a: RectCollisionNode = { x: 0, y: 0, vx: 0 };
    const b: RectCollisionNode = { x: 260, y: 10, vx: 0 };

    runForce([a, b], { iterations: 3 });

    expect(a.vx).toBeCloseTo(-113.4, 5);
    expect(b.vx).toBeCloseTo(113.4, 5);
  });

  it('applies custom padding, width, height, and strength settings', () => {
    const a: RectCollisionNode = { x: 0, y: 0, vx: 0, vy: 0 };
    const b: RectCollisionNode = { x: 90, y: 10, vx: 0, vy: 0 };

    runForce([a, b], {
      width: 100,
      height: 50,
      padding: 0,
      strength: 1,
      iterations: 1,
    });

    expect(a.vx).toBeCloseTo(-5, 5);
    expect(b.vx).toBeCloseTo(5, 5);
    expect(a.vy).toBe(0);
    expect(b.vy).toBe(0);
  });
});
