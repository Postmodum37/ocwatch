
## Task 10: Tailwind + Dark Theme Setup (2026-01-31)

### Completed
- ✅ Installed Tailwind CSS, PostCSS, Autoprefixer, and Lucide React
- ✅ Configured `tailwind.config.js` with dark theme color palette
- ✅ Created `src/client/src/styles/index.css` with Tailwind directives
- ✅ Updated `src/client/index.html` to include `class="dark"`
- ✅ Created base layout in `App.tsx` using new design tokens
- ✅ Verified build and dark mode application

### Key Decisions
- **Tailwind Version**: Downgraded to v3.4.17 (from v4 default) to strictly follow requirements for `tailwind.config.js` configuration. v4 uses CSS-first configuration by default which would deviate from the specific "Configure tailwind.config.js" instruction.
- **Dark Mode Strategy**: Used `darkMode: 'class'` and added `class="dark"` to `<html>` tag for permanent dark mode (no toggle).
- **Color Palette**: Defined semantic names (`background`, `surface`, `border`, etc.) matching GitHub/Linear dark theme specs directly in `theme.extend`.
- **Icon Library**: Lucide React chosen for consistent, clean iconography matching the "Design Principles".

### Implementation Details
- **Colors**:
  - Background: `#0d1117`
  - Surface: `#161b22`
  - Accent: `#58a6ff`
  - Text Primary: `#c9d1d9`
- **Verification**: Checked build output for correct RGB values (Tailwind converts hex to RGB in CSS variables).

### Gotchas
- **Tailwind v4 vs v3**: `bun add tailwindcss` now installs v4. Had to explicit downgrade to v3 to ensure compatibility with standard init workflow and config file requirements.
- **Verification**: `grep` for hex codes in built CSS fails because Tailwind converts to RGB. Verified by checking RGB values manually.

### Next Steps (Task 11)
- Create specialized UI components (Card, Badge, Button) using these base styles.
- Implement sidebar and main content area structure.

## React Flow + Dagre Integration (Task 12)
- **Coordinate Systems**: Dagre nodes are center-anchored (x/y is center), while React Flow nodes are top-left anchored. When mapping Dagre layout to React Flow nodes, subtract half width/height from x/y:
  ```typescript
  x: nodeWithPosition.x - nodeWidth / 2,
  y: nodeWithPosition.y - nodeHeight / 2,
  ```
- **Type Safety**: `reactflow` exports types like `Node` and `Edge`. With `verbatimModuleSyntax: true`, these MUST be imported as `import type { Node, Edge } ...`.
- **Vitest**: To use globals (`describe`, `it`) in a Vite project, add `/// <reference types="vitest" />` to `vite.config.ts`.

## Task 11: Session List Sidebar (2026-01-31)

### Completed
- ✅ Created `src/client/src/components/SessionList.tsx` with fixed 280px sidebar.
- ✅ Implemented status indicators (icon + dot) and relative time formatting.
- ✅ Configured `@shared` alias in `tsconfig.app.json` and `vite.config.ts`.
- ✅ Integrated into `App.tsx` (merging with parallel changes).
- ✅ Verified with Unit Tests (`bun x vitest`) and Visual Verification (Playwright).

### Key Decisions
- **Path Alias**: Configured `@shared` alias to allow clean imports from the shared folder, which is outside the `src/client` root.
- **Visuals**: Used `bg-surface` for sidebar to distinguish from `bg-background` main area.
- **Testing**: Used `vitest` via `bun x vitest` because `bun test` lacks DOM environment by default and project was configured for Vitest (jsdom).

### Gotchas
- **Parallel Work**: `App.tsx` was modified by another task during my work. I had to ensure my integration respected the existing content (`AgentTree`).
- **TypeScript**: `tsc -b` is strict about `verbatimModuleSyntax` and references. Had to fix type imports in multiple files to get a clean build.
