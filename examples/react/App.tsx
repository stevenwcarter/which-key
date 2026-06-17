/**
 * Minimal runnable example of which-key with React.
 *
 * To run this example, add it to a React + Vite project:
 *   npm create vite@latest my-app -- --template react-ts
 *   cd my-app && npm i which-key
 *   # replace src/App.tsx with this file
 *   npm run dev
 */
import {
  WhichKeyProvider,
  useShortcut,
  useShortcutGroup,
  WhichKeyPopup,
  ShortcutCheatsheet,
} from 'which-key/react';
import 'which-key/styles.css';

function save() {
  alert('Saved!');
}

function Editor() {
  // Label the 'g' prefix so the popup shows "Go to" instead of a bare key.
  useShortcutGroup('g', { description: 'Go to' });

  // Sequence shortcut: press g, then h.
  useShortcut('g h', () => location.assign('/'), { description: 'Home' });

  // Single-key shortcut.
  useShortcut('s', () => save(), { description: 'Save' });

  // Modifier shortcut.
  useShortcut('Ctrl+s', () => save(), { description: 'Save (Ctrl+S)' });

  return (
    <div style={{ padding: 24 }}>
      <h2>which-key React example</h2>
      <p>
        Press <kbd>g</kbd> to see the leader popup, then <kbd>h</kbd> to navigate home.
        <br />
        Press <kbd>s</kbd> or <kbd>Ctrl+S</kbd> to save.
        <br />
        Press <kbd>?</kbd> to open the full cheatsheet.
      </p>
      <textarea placeholder="Type here… shortcuts fire outside inputs by default." rows={5} cols={60} />
    </div>
  );
}

export default function App() {
  return (
    <WhichKeyProvider sortKeys="alphabetical">
      <Editor />
      {/* Renders the leader-key popup at the bottom of the screen */}
      <WhichKeyPopup layout="horizontal" />
      {/* Renders the full-screen cheatsheet (toggled by ?) */}
      <ShortcutCheatsheet />
    </WhichKeyProvider>
  );
}
