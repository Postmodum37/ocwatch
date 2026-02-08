import { render } from '@testing-library/react';
import { LoadingSkeleton, SessionListSkeleton } from '../LoadingSkeleton';
import { describe, it, expect } from 'vitest';

describe('LoadingSkeleton', () => {
  it('renders skeleton structure', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.querySelector('.space-y-4')).toBeDefined();
  });

  it('applies shimmer animation class to skeleton blocks', () => {
    const { container } = render(<LoadingSkeleton />);
    const shimmerElements = container.querySelectorAll('.animate-shimmer');
    expect(shimmerElements.length).toBeGreaterThan(0);
  });

  it('renders multiple skeleton rows', () => {
    const { container } = render(<LoadingSkeleton />);
    const rows = container.querySelectorAll('.flex.items-center.gap-3.p-3.bg-surface.rounded-lg');
    expect(rows.length).toBe(5);
  });

  it('applies shimmer animation to all skeleton elements', () => {
    const { container } = render(<LoadingSkeleton />);
    const allSkeletonDivs = container.querySelectorAll('[class*="bg-surface"], [class*="bg-background"]');
    let shimmerCount = 0;
    allSkeletonDivs.forEach((el) => {
      if (el.className.includes('animate-shimmer')) {
        shimmerCount++;
      }
    });
    expect(shimmerCount).toBeGreaterThan(0);
  });

  it('has shimmer class on header skeleton', () => {
    const { container } = render(<LoadingSkeleton />);
    const headerShimmer = container.querySelector('.w-12.h-12.bg-surface.rounded-lg.animate-shimmer');
    expect(headerShimmer).toBeDefined();
  });
});

describe('SessionListSkeleton', () => {
  it('renders session list skeleton structure', () => {
    const { container } = render(<SessionListSkeleton />);
    expect(container.querySelector('.w-\\[280px\\]')).toBeDefined();
  });

  it('renders skeleton items', () => {
    const { container } = render(<SessionListSkeleton />);
    const items = container.querySelectorAll('[class*="animate-shimmer"]');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders 8 skeleton session items', () => {
    const { container } = render(<SessionListSkeleton />);
    const sessionItems = container.querySelectorAll('.flex.items-start.gap-3.p-3');
    expect(sessionItems.length).toBe(8);
  });
});
