/**
 * Minimal runnable example of which-key with React.
 *
 * To run this example, add it to a React + Vite project:
 *   npm create vite@latest my-app -- --template react-ts
 *   cd my-app && npm i which-key
 *   # replace src/App.tsx with this file
 *   npm run dev
 */
import { useState } from 'react';
import {
  WhichKeyProvider,
  WhichKeyLayer,
  useShortcut,
  useShortcutGroup,
  WhichKeyPopup,
  ShortcutCheatsheet,
} from 'which-key/react';
import 'which-key/styles.css';

function save() {
  alert('Saved!');
}

/** Modal — wrapped in <WhichKeyLayer exclusive> by the parent, so page
 *  shortcuts (s, g h, …) are suppressed while it is open.
 *  The ? help shortcut still works because it is registered as global. */
function ItemModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(0);
  const ITEMS = ['Alpha', 'Beta', 'Gamma'];

  useShortcut('Escape', onClose, { description: 'Close modal' });
  useShortcut('j', () => setSelected((i) => Math.min(i + 1, ITEMS.length - 1)), {
    description: 'Select next',
  });
  useShortcut('k', () => setSelected((i) => Math.max(i - 1, 0)), {
    description: 'Select previous',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 32, minWidth: 300 }}>
        <h3 style={{ marginTop: 0 }}>Item picker</h3>
        <p>
          Press <kbd>j</kbd>/<kbd>k</kbd> to move, <kbd>Escape</kbd> to close.
          <br />
          Page shortcuts are blocked — try <kbd>s</kbd>; it will not fire.
          <br />
          Press <kbd>?</kbd> to open the cheatsheet (global shortcut — still works).
        </p>
        <ul>
          {ITEMS.map((item, i) => (
            <li key={item} style={{ fontWeight: i === selected ? 'bold' : 'normal' }}>
              {item}
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
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
      <textarea
        placeholder="Type here… shortcuts fire outside inputs by default."
        rows={5}
        cols={60}
      />
    </div>
  );
}

export default function App() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <WhichKeyProvider sortKeys="alphabetical">
      <Editor />

      {/* Open the modal via a button OR the 'm' shortcut */}
      <div style={{ padding: '0 24px' }}>
        <button onClick={() => setModalOpen(true)}>Open modal (or press m)</button>
      </div>

      {/*
        useShortcut at this level (outside <WhichKeyLayer>) is on the base layer.
        It fires when no exclusive layer is active.
      */}
      <OpenModalShortcut onOpen={() => setModalOpen(true)} />

      {/*
        <WhichKeyLayer exclusive> activates an exclusive layer for the duration
        the modal is mounted. All base-layer shortcuts are suppressed; only the
        modal's own shortcuts and global shortcuts (like ?) fire.
      */}
      {modalOpen && (
        <WhichKeyLayer exclusive>
          <ItemModal onClose={() => setModalOpen(false)} />
        </WhichKeyLayer>
      )}

      {/* Renders the leader-key popup at the bottom of the screen */}
      <WhichKeyPopup layout="horizontal" />
      {/* Renders the full-screen cheatsheet (toggled by ?) */}
      <ShortcutCheatsheet />
    </WhichKeyProvider>
  );
}

/** Separate component so the shortcut is registered at the base layer level. */
function OpenModalShortcut({ onOpen }: { onOpen: () => void }) {
  useShortcut('m', onOpen, { description: 'Open modal' });
  return null;
}
