# Keybinding Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add push/pop "layers" so a modal can suppress base-page shortcuts (exclusive) and/or add scoped shortcuts (additive), with a `global` escape hatch.

**Architecture:** All resolution logic lives in `ShortcutRegistry`, which gains an active-layers set and a reachability filter; `matcher.ts` is unchanged because it reads only through `registry.getActive`/`getActiveCandidates`. The controller exposes an imperative `pushLayer` handle; the React binding threads a layer `level` through a new `LayerContext` and activates/deactivates the layer in an effect.

**Tech Stack:** TypeScript (strict), Vitest + jsdom, React 18, tsup.

## Global Constraints

- TypeScript strict mode; avoid `any`. Named exports only.
- TDD: write the failing test first; tests co-located in `__tests__/`.
- Behaviour with **no active layers must be byte-identical to today** (`blockLevel = 0`).
- 80% global coverage gate must hold (`npm test`).
- Full gate before done: `npm run lint && npm run typecheck && npm test && npm run build`.
- Resolution rule (verbatim): `blockLevel` = highest `level` among active **exclusive** layers, else `0`. An entry is reachable iff `entry.level >= blockLevel || entry.global`. Winner = reachable+enabled entry with greatest `(level, priority, insertionIndex)`.

---

### Task 1: Registry layer state + reachability resolution

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/registry.ts`
- Test: `src/engine/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: existing `ShortcutEntry`, `GroupEntry`, `ShortcutRegistry`.
- Produces:
  - `ShortcutEntry` gains `level: number`, `global: boolean`.
  - `GroupEntry` gains `level: number`.
  - `registry.activateLayer(id: string, level: number, exclusive: boolean): void`
  - `registry.deactivateLayer(id: string): void`
  - `registry.nextLevel(): number`
  - Reachability applied in `getActive`, `getAllActive`, `getActiveCandidates`, `getActiveGroup`.

- [ ] **Step 1: Write failing tests** in `src/engine/__tests__/registry.test.ts` (append). Use a small helper to build entries; existing tests show the shape.

```ts
import { describe, it, expect } from 'vitest';
import { ShortcutRegistry } from '../registry';
import type { ShortcutEntry } from '../types';

const entry = (over: Partial<ShortcutEntry> & { keys: string; id: string }): ShortcutEntry => ({
  handler: () => {}, description: undefined, enableOnInputs: false,
  priority: 0, enabled: true, level: 0, global: false, ...over,
});

describe('registry layers', () => {
  it('exclusive layer blocks lower-level entries', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'base', keys: 'a', level: 0 }));
    r.register(entry({ id: 'modal', keys: 'b', level: 1 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('a')).toBeUndefined();      // base suppressed
    expect(r.getActive('b')?.id).toBe('modal');     // layer reachable
  });

  it('additive layer leaves lower entries reachable', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'base', keys: 'a', level: 0 }));
    r.activateLayer('L1', 1, false);
    expect(r.getActive('a')?.id).toBe('base');
  });

  it('global entry pierces an exclusive layer', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'help', keys: '?', level: 0, global: true }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('?')?.id).toBe('help');
  });

  it('a higher layer overrides a global key', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'help', keys: '?', level: 0, global: true }));
    r.register(entry({ id: 'modalHelp', keys: '?', level: 1 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('?')?.id).toBe('modalHelp');  // (level,priority,index): level 1 wins
  });

  it('deactivateLayer re-reveals the layer beneath', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'base', keys: 'a', level: 0 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('a')).toBeUndefined();
    r.deactivateLayer('L1');
    expect(r.getActive('a')?.id).toBe('base');
  });

  it('nextLevel is max active level + 1', () => {
    const r = new ShortcutRegistry();
    expect(r.nextLevel()).toBe(1);
    r.activateLayer('L1', 1, false);
    expect(r.nextLevel()).toBe(2);
  });

  it('candidates and cheatsheet exclude suppressed entries', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'g-d', keys: 'g d', level: 0 }));
    r.register(entry({ id: 'm', keys: 'g x', level: 1 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActiveCandidates('g').map((c) => c.keys)).toEqual(['g x']);
    expect(r.getAllActive().map((e) => e.id)).toEqual(['m']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/registry.test.ts`
Expected: FAIL — `activateLayer`/`nextLevel` not a function; `level`/`global` missing on `ShortcutEntry`.

- [ ] **Step 3: Add fields to `types.ts`**

In `ShortcutEntry` add:
```ts
  level: number;
  global: boolean;
```
In `GroupEntry` add:
```ts
  level: number;
```
In `ShortcutOptions` add:
```ts
  global?: boolean;
  level?: number;
```

- [ ] **Step 4: Implement layer state + reachability in `registry.ts`**

Add active-layer state and helpers; rewrite `findActive` and `getActiveGroup` to use reachability. Replace the class internals as follows:

```ts
export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutEntry[]>();
  private groups = new Map<string, GroupEntry[]>();
  private layers = new Map<string, { level: number; exclusive: boolean }>();

  activateLayer(id: string, level: number, exclusive: boolean): void {
    this.layers.set(id, { level, exclusive });
  }

  deactivateLayer(id: string): void {
    this.layers.delete(id);
  }

  nextLevel(): number {
    let max = 0;
    for (const { level } of this.layers.values()) if (level > max) max = level;
    return max + 1;
  }

  private blockLevel(): number {
    let block = 0;
    for (const { level, exclusive } of this.layers.values()) {
      if (exclusive && level > block) block = level;
    }
    return block;
  }

  private isReachable(entry: { level: number; global: boolean }, block: number): boolean {
    return entry.global || entry.level >= block;
  }
```

Keep `register`, `unregister`, `registerGroup`, `unregisterGroup` as-is (they already splice by priority — `insertionIndex` ordering is preserved). Then rewrite `findActive`:

```ts
  private findActive(bucket: ShortcutEntry[]): ShortcutEntry | undefined {
    const block = this.blockLevel();
    let best: ShortcutEntry | undefined;
    let bestIdx = -1;
    for (let i = 0; i < bucket.length; i++) {
      const e = bucket[i];
      if (!e.enabled || !this.isReachable(e, block)) continue;
      if (
        best === undefined ||
        e.level > best.level ||
        (e.level === best.level && e.priority > best.priority) ||
        (e.level === best.level && e.priority === best.priority && i > bestIdx)
      ) {
        best = e;
        bestIdx = i;
      }
    }
    return best;
  }
```

Rewrite `getActiveGroup` to honour group reachability (no `global` for groups):

```ts
  getActiveGroup(prefix: string): GroupEntry | undefined {
    const bucket = this.groups.get(prefix);
    if (!bucket || bucket.length === 0) return undefined;
    const block = this.blockLevel();
    let best: GroupEntry | undefined;
    let bestIdx = -1;
    for (let i = 0; i < bucket.length; i++) {
      const g = bucket[i];
      if (g.level < block) continue;
      if (
        best === undefined ||
        g.level > best.level ||
        (g.level === best.level && g.priority > best.priority) ||
        (g.level === best.level && g.priority === best.priority && i > bestIdx)
      ) {
        best = g;
        bestIdx = i;
      }
    }
    return best;
  }
```

`getActive`, `getAllActive`, and `getActiveCandidates` already delegate to `findActive`, so they inherit reachability with no change.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/engine/__tests__/registry.test.ts`
Expected: PASS (all new + existing registry tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/registry.ts src/engine/__tests__/registry.test.ts
git commit -m "feat(engine): registry layer state + reachability resolution"
```

---

### Task 2: Controller `pushLayer` handle + global help

**Files:**
- Modify: `src/engine/controller.ts`
- Modify: `src/engine/index.ts` (export `LayerHandle` type)
- Test: `src/engine/__tests__/controller.test.ts`

**Interfaces:**
- Consumes: `registry.activateLayer/deactivateLayer/nextLevel` (Task 1).
- Produces (on `WhichKeyEngine`):
  - `register(keys, handler, options?)` now passes `options.level ?? 0` and `options.global ?? false` into the entry.
  - `registerGroup(prefix, options)` accepts optional `level?: number`.
  - `activateLayer(level: number, exclusive: boolean): () => void` (low-level, returns deactivate).
  - `pushLayer(options?: { exclusive?: boolean; level?: number }): LayerHandle` where
    `type LayerHandle = { readonly level: number; register: WhichKeyEngine['register']; registerGroup: WhichKeyEngine['registerGroup']; pop(): void }`.
  - The built-in `?` help entry is registered with `global: true`.

- [ ] **Step 1: Write failing tests** in `src/engine/__tests__/controller.test.ts` (append).

```ts
import { describe, it, expect, vi } from 'vitest';
import { createWhichKey } from '../controller';

describe('controller layers', () => {
  it('exclusive pushLayer suppresses a base shortcut, pop restores it', () => {
    const wk = createWhichKey({ helpKey: null });
    const base = vi.fn();
    wk.register('a', base);
    const layer = wk.pushLayer({ exclusive: true });
    const modal = vi.fn();
    layer.register('b', modal);
    // base 'a' now unreachable, layer 'b' reachable
    expect(wk.registry.getActive('a')).toBeUndefined();
    expect(wk.registry.getActive('b')?.handler).toBeTypeOf('function');
    layer.pop();
    expect(wk.registry.getActive('a')?.handler).toBeTypeOf('function');
    expect(wk.registry.getActive('b')).toBeUndefined(); // handle entries auto-unregistered
  });

  it('global help survives an exclusive layer', () => {
    const wk = createWhichKey(); // default ? help
    wk.pushLayer({ exclusive: true });
    expect(wk.registry.getActive('?')?.id).toBe('__whichkey_default_help__');
  });

  it('cheatsheet excludes suppressed base entries under an exclusive layer', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('a', () => {}, { description: 'base' });
    const layer = wk.pushLayer({ exclusive: true });
    layer.register('b', () => {}, { description: 'modal' });
    const model = wk.getCheatsheetModel();
    const keys = model.standalone.map((s) => s.keys);
    expect(keys).toContain('b');
    expect(keys).not.toContain('a');
  });

  it('pushLayer emits a snapshot', () => {
    const wk = createWhichKey({ helpKey: null });
    const listener = vi.fn();
    wk.subscribe(listener);
    wk.pushLayer({ exclusive: true });
    expect(listener).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/engine/__tests__/controller.test.ts`
Expected: FAIL — `wk.pushLayer is not a function`.

- [ ] **Step 3: Implement in `controller.ts`**

Add `LayerHandle` to the type definitions near `WhichKeyEngine`:

```ts
export type LayerHandle = {
  readonly level: number;
  register: WhichKeyEngine['register'];
  registerGroup: WhichKeyEngine['registerGroup'];
  pop(): void;
};
```

Add to the `WhichKeyEngine` type:
```ts
  activateLayer(level: number, exclusive: boolean): () => void;
  pushLayer(options?: { exclusive?: boolean; level?: number }): LayerHandle;
```

In `register`, thread the new fields (the entry object):
```ts
        priority: opts?.priority ?? 0,
        enabled: opts?.enabled ?? true,
        level: opts?.level ?? 0,
        global: opts?.global ?? false,
```

In `registerGroup`, accept `level`:
```ts
    registerGroup(prefix, opts) {
      const id = `wkg_${idCounter++}`;
      registry.registerGroup({
        id, prefix, description: opts.description,
        priority: opts.priority ?? 0, level: opts.level ?? 0,
      });
      return () => registry.unregisterGroup(id);
    },
```
(Widen the `registerGroup` option type on `WhichKeyEngine` to `{ description: string; priority?: number; level?: number }`.)

In the built-in help registration, add `global: true` and `level: 0`:
```ts
    registry.register({
      id: DEFAULT_HELP_ID,
      keys: parseKey(helpKey),
      handler: () => toggleCheatsheet(),
      description: 'Toggle keyboard shortcuts',
      enableOnInputs: false,
      priority: -1,
      enabled: true,
      level: 0,
      global: true,
    });
```

Add `activateLayer` and `pushLayer` to the returned object:
```ts
    activateLayer(level, exclusive) {
      const id = `wklayer_${idCounter++}`;
      registry.activateLayer(id, level, exclusive);
      emit();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        registry.deactivateLayer(id);
        emit();
      };
    },
    pushLayer(opts) {
      const level = opts?.level ?? registry.nextLevel();
      const deactivate = this.activateLayer(level, opts?.exclusive ?? false);
      const owned = new Set<() => void>();
      const track = (un: () => void): (() => void) => {
        const wrapped = () => { un(); owned.delete(wrapped); };
        owned.add(wrapped);
        return wrapped;
      };
      return {
        level,
        register: (keys, h, o) => track(this.register(keys, h, { ...o, level })),
        registerGroup: (prefix, o) => track(this.registerGroup(prefix, { ...o, level })),
        pop: () => {
          for (const un of [...owned]) un();
          deactivate();
        },
      };
    },
```
Note: `this` inside the returned object literal refers to the engine object — keep the object as a single returned literal so `this.register`/`this.activateLayer` resolve. (The existing object is already returned directly; these methods can call the sibling methods via `this`.)

- [ ] **Step 4: Export the type** in `src/engine/index.ts` — add `LayerHandle` to the `controller` type export list:
```ts
export type {
  WhichKeyOptions, WhichKeyEngine, WhichKeySnapshot, LayerHandle,
  CheatsheetEntry, CheatsheetGroup, CheatsheetModel,
} from './controller';
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/engine/__tests__/controller.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/controller.ts src/engine/index.ts src/engine/__tests__/controller.test.ts
git commit -m "feat(engine): pushLayer handle, activateLayer, global help"
```

---

### Task 3: Matcher integration tests (no production change expected)

**Files:**
- Test: `src/engine/__tests__/layers.test.ts` (create)

**Interfaces:**
- Consumes: `createWhichKey`, `pushLayer` (Task 2). Drives real `keydown` events through the matcher.

- [ ] **Step 1: Write failing/guarding tests.** This validates invariants 1 & 2 end-to-end. If they pass immediately, that confirms the matcher needed no change — keep them as regression guards.

```ts
import { describe, it, expect, vi } from 'vitest';
import { createWhichKey } from '../controller';

const press = (target: EventTarget, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('layers — matcher integration', () => {
  it('base shortcut does not fire while an exclusive layer is active, fires after pop', () => {
    const wk = createWhichKey({ helpKey: null, target: document });
    wk.start();
    const base = vi.fn();
    wk.register('a', base);
    const layer = wk.pushLayer({ exclusive: true });
    press(document, 'a');
    expect(base).not.toHaveBeenCalled();
    layer.pop();
    press(document, 'a');
    expect(base).toHaveBeenCalledTimes(1);
    wk.stop();
  });

  it('a global shortcut still fires under an exclusive layer', () => {
    const wk = createWhichKey({ helpKey: null, target: document });
    wk.start();
    const g = vi.fn();
    wk.register('x', g, { global: true });
    wk.pushLayer({ exclusive: true });
    press(document, 'x');
    expect(g).toHaveBeenCalledTimes(1);
    wk.stop();
  });

  it('popup candidates reflect only reachable shortcuts', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('g d', () => {}, { description: 'base' });
    const layer = wk.pushLayer({ exclusive: true });
    layer.register('g x', () => {}, { description: 'modal' });
    expect(wk.registry.getActiveCandidates('g').map((c) => c.keys)).toEqual(['g x']);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/engine/__tests__/layers.test.ts`
Expected: PASS (matcher reads through the registry; no code change needed). If any FAIL, debug the registry reachability from Task 1 rather than editing the matcher.

- [ ] **Step 3: Commit**

```bash
git add src/engine/__tests__/layers.test.ts
git commit -m "test(engine): layer suppression/global integration guards"
```

---

### Task 4: React `<WhichKeyLayer>` + level-threaded hooks

**Files:**
- Modify: `src/react/context.ts`
- Create: `src/react/WhichKeyLayer.tsx`
- Modify: `src/react/useShortcut.ts`
- Modify: `src/react/useShortcutGroup.ts`
- Modify: `src/react/index.ts`
- Test: `src/react/__tests__/WhichKeyLayer.test.tsx` (create)

**Interfaces:**
- Consumes: `engine.activateLayer` (Task 2), `WhichKeyContext`.
- Produces:
  - `LayerContext` (React context) holding `{ level: number }`, default `{ level: 0 }`.
  - `<WhichKeyLayer exclusive?={boolean}>children</WhichKeyLayer>`.
  - `useShortcut(keys, handler, options?)` — `options` may include `global?: boolean`; registers at the current `LayerContext` level.
  - `useShortcutGroup` registers at the current level.

- [ ] **Step 1: Write failing tests** in `src/react/__tests__/WhichKeyLayer.test.tsx`.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WhichKeyProvider } from '../WhichKeyProvider';
import { WhichKeyLayer } from '../WhichKeyLayer';
import { useShortcut } from '../useShortcut';

const Shortcut = ({ k, fn }: { k: string; fn: () => void }) => {
  useShortcut(k, fn);
  return null;
};

describe('<WhichKeyLayer>', () => {
  it('exclusive layer suppresses an outer shortcut while mounted', () => {
    const base = vi.fn();
    const { rerender } = render(
      <WhichKeyProvider helpKey={null}>
        <Shortcut k="a" fn={base} />
        <WhichKeyLayer exclusive>
          <span />
        </WhichKeyLayer>
      </WhichKeyProvider>,
    );
    fireEvent.keyDown(document, { key: 'a' });
    expect(base).not.toHaveBeenCalled();

    // Unmount the layer → base reachable again
    rerender(
      <WhichKeyProvider helpKey={null}>
        <Shortcut k="a" fn={base} />
      </WhichKeyProvider>,
    );
    fireEvent.keyDown(document, { key: 'a' });
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('a shortcut declared inside the layer fires and is gone after unmount', () => {
    const modal = vi.fn();
    const { rerender } = render(
      <WhichKeyProvider helpKey={null}>
        <WhichKeyLayer exclusive>
          <Shortcut k="b" fn={modal} />
        </WhichKeyLayer>
      </WhichKeyProvider>,
    );
    fireEvent.keyDown(document, { key: 'b' });
    expect(modal).toHaveBeenCalledTimes(1);

    rerender(<WhichKeyProvider helpKey={null} />);
    fireEvent.keyDown(document, { key: 'b' });
    expect(modal).toHaveBeenCalledTimes(1); // not called again
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/react/__tests__/WhichKeyLayer.test.tsx`
Expected: FAIL — cannot find module `../WhichKeyLayer`.

- [ ] **Step 3: Add `LayerContext` to `context.ts`**

```ts
import { createContext } from 'react';
import type { WhichKeyEngine } from '../engine';

export const WhichKeyContext = createContext<WhichKeyEngine | null>(null);
export const LayerContext = createContext<{ level: number }>({ level: 0 });
```

- [ ] **Step 4: Create `src/react/WhichKeyLayer.tsx`**

```tsx
import { useContext, useEffect, type ReactNode } from 'react';
import { WhichKeyContext, LayerContext } from './context';

export type WhichKeyLayerProps = {
  children: ReactNode;
  exclusive?: boolean;
};

export const WhichKeyLayer = ({ children, exclusive = false }: WhichKeyLayerProps) => {
  const engine = useContext(WhichKeyContext);
  const parent = useContext(LayerContext);
  const level = parent.level + 1;
  useEffect(() => {
    if (!engine) {
      console.warn('[whichkey] <WhichKeyLayer> used outside <WhichKeyProvider>; layer inactive.');
      return;
    }
    return engine.activateLayer(level, exclusive);
  }, [engine, level, exclusive]);
  return <LayerContext.Provider value={{ level }}>{children}</LayerContext.Provider>;
};
```

- [ ] **Step 5: Thread `level` (and `global`) through `useShortcut.ts`**

```ts
import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { WhichKeyContext, LayerContext } from './context';
import type { ShortcutHandler, ShortcutOptions } from '../engine';

export const useShortcut = (
  keys: string, handler: ShortcutHandler, options?: ShortcutOptions,
): void => {
  const engine = useContext(WhichKeyContext);
  const { level } = useContext(LayerContext);
  const handlerRef = useRef(handler);
  useLayoutEffect(() => { handlerRef.current = handler; }, [handler]);
  const description = options?.description;
  const enableOnInputs = options?.enableOnInputs ?? false;
  const priority = options?.priority ?? 0;
  const enabled = options?.enabled ?? true;
  const global = options?.global ?? false;
  useEffect(() => {
    if (!engine) {
      console.warn('[whichkey] useShortcut called outside <WhichKeyProvider>; shortcut will not register.');
      return;
    }
    return engine.register(keys, (event) => handlerRef.current(event), {
      description, enableOnInputs, priority, enabled, global, level,
    });
  }, [engine, keys, description, enableOnInputs, priority, enabled, global, level]);
};
```

- [ ] **Step 6: Thread `level` through `useShortcutGroup.ts`**

```ts
import { useContext, useEffect } from 'react';
import { WhichKeyContext, LayerContext } from './context';

export const useShortcutGroup = (
  prefix: string, options: { description: string; priority?: number },
): void => {
  const engine = useContext(WhichKeyContext);
  const { level } = useContext(LayerContext);
  const { description, priority = 0 } = options;
  useEffect(() => {
    if (!engine) {
      console.warn('[whichkey] useShortcutGroup called outside <WhichKeyProvider>; group will not register.');
      return;
    }
    return engine.registerGroup(prefix, { description, priority, level });
  }, [engine, prefix, description, priority, level]);
};
```

- [ ] **Step 7: Export from `src/react/index.ts`** — add:
```ts
export { WhichKeyLayer } from './WhichKeyLayer';
export type { WhichKeyLayerProps } from './WhichKeyLayer';
export { LayerContext } from './context';
```

- [ ] **Step 8: Run tests**

Run: `npx vitest run src/react/__tests__/WhichKeyLayer.test.tsx`
Expected: PASS.

- [ ] **Step 9: Run the full React suite** (guard against regressions in existing hooks):

Run: `npx vitest run src/react`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/react/context.ts src/react/WhichKeyLayer.tsx src/react/useShortcut.ts src/react/useShortcutGroup.ts src/react/index.ts src/react/__tests__/WhichKeyLayer.test.tsx
git commit -m "feat(react): <WhichKeyLayer> and level-aware hooks"
```

---

### Task 5: Docs, examples, CLAUDE.local.md, changeset

**Files:**
- Modify: `README.md`
- Modify: `examples/react/App.tsx`
- Modify: `examples/vanilla/index.html`
- Modify: `CLAUDE.local.md`
- Create: `.changeset/<name>.md`

**Interfaces:**
- Consumes: the full public API from Tasks 2 & 4.

- [ ] **Step 1: README — add a "Layers" section.** Document, with runnable snippets:
  - Engine/vanilla: `const layer = wk.pushLayer({ exclusive: true }); layer.register('j', fn); layer.pop();`
  - React: `<WhichKeyLayer exclusive>…</WhichKeyLayer>` and that nested `useShortcut`/`useShortcutGroup` bind to it.
  - The `global: true` option (and that `?` help is global by default).
  - exclusive vs additive semantics and the resolution rule in one paragraph.
  Place it after the existing shortcuts/cheatsheet sections; match the surrounding heading style.

- [ ] **Step 2: `examples/react/App.tsx`** — add a modal demo: a piece of state `modalOpen`, a button/shortcut to open it, and when open render `<WhichKeyLayer exclusive>` containing a couple of `useShortcut` calls (e.g. `j`/`k` or `Escape` to close). Show that page shortcuts don't fire while the modal is open and `?` still does.

- [ ] **Step 3: `examples/vanilla/index.html`** — add a modal element with open/close buttons; on open call `const layer = wk.pushLayer({ exclusive: true })` and register a modal shortcut via `layer.register(...)`; on close call `layer.pop()`.

- [ ] **Step 4: `CLAUDE.local.md`** — extend the Engine bullet (registry) and React bullet to mention layers: the active-layers set + reachability rule in `registry.ts`, that `matcher.ts` is unchanged, and `<WhichKeyLayer>` + `LayerContext` in React. Keep additions terse.

- [ ] **Step 5: Verify CLAUDE.local.md size budget**

Run: `wc -l -c CLAUDE.local.md`
Expected: ≤ 500 lines AND ≤ 20000 characters. If over either limit, move the layers detail into `docs/` and leave a one-line "read X when working on layers" pointer in CLAUDE.local.md.

- [ ] **Step 6: Add a changeset**

Create `.changeset/keybinding-layers.md`:
```md
---
"which-key": minor
---

Add keybinding layers: `engine.pushLayer({ exclusive })` and React `<WhichKeyLayer>` scope shortcuts to a UI state (e.g. a modal). Exclusive layers suppress lower-layer shortcuts; `global: true` shortcuts (and the `?` help) pierce them.
```

- [ ] **Step 7: Commit**

```bash
git add README.md examples/react/App.tsx examples/vanilla/index.html CLAUDE.local.md .changeset/keybinding-layers.md
git commit -m "docs(which-key): document and demo keybinding layers"
```

---

### Task 6: Full gate + final review

- [ ] **Step 1: Run the full pre-push gate**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass; coverage ≥ 80% global.

- [ ] **Step 2:** Dispatch the final code-reviewer subagent over the branch diff; address findings via the receiving-code-review flow until clean.

- [ ] **Step 3:** Invoke `superpowers:finishing-a-development-branch`.

## Self-Review notes

- **Spec coverage:** resolution rule → Task 1; pushLayer/activateLayer/global help → Task 2; matcher-unchanged invariant (1 & 2) → Task 3; React `<WhichKeyLayer>` + effect-ordering via context-threaded level → Task 4; docs/examples/CLAUDE budget → Task 5; gate + changeset → Tasks 5/6. All four "Invariants this feature depends on" have a test.
- **Type consistency:** `level`/`global` on `ShortcutEntry`; `level` on `GroupEntry`; `ShortcutOptions.global?`/`level?`; `activateLayer(level, exclusive) => () => void`; `pushLayer(opts) => LayerHandle` with `{ level, register, registerGroup, pop }` — used identically across Tasks 2 and 4.
- **No placeholders:** every code step shows full code.
