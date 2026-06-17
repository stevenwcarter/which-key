# Migration Guide

## From inlined `@whichkey/core` / `@whichkey/ui`

Earlier versions of this functionality were shipped as private packages inlined directly into the application (`@whichkey/core` for the engine and `@whichkey/ui` for the React components). The standalone `which-key` npm package consolidates both into a single published package.

### Install

```bash
npm i which-key
```

Remove the old inlined packages from your dependencies (they were never published to npm, so this is just a cleanup step in your `package.json`).

### Import changes

| Old import                          | New import                              |
|-------------------------------------|-----------------------------------------|
| `@whichkey/core`                    | `which-key`                             |
| `@whichkey/ui`                      | `which-key/react`                       |
| *(inline CSS, various locations)*   | `import 'which-key/styles.css'`         |

#### Engine

```ts
// Before
import { createWhichKey } from '@whichkey/core';

// After
import { createWhichKey } from 'which-key';
```

#### React components and hooks

```tsx
// Before
import { WhichKeyProvider, useShortcut, WhichKeyPopup } from '@whichkey/ui';

// After
import { WhichKeyProvider, useShortcut, WhichKeyPopup } from 'which-key/react';
```

#### Styles

```ts
// Before — inline CSS or a local import path
import './whichkey.css';

// After
import 'which-key/styles.css';
```

### API compatibility

The public API is unchanged. All options, hook signatures, and component props are identical to the inlined versions. No code changes are needed beyond updating the import paths and adding the CSS import.

### Vanilla / non-React usage

If you were driving the DOM renderer manually, that layer is now available as:

```ts
import { mountWhichKey } from 'which-key/vanilla';
```

See [API.md](./API.md#vanilla--which-keyvanilla) for the full `MountOptions` reference.
