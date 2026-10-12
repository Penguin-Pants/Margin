// Theme choice per browser (EDT-6). Default dark. Stored in localStorage
// key pn.theme and shown as data-theme on <html>. theme-init.js applies it
// before first paint.
// The brand theme (Classic or Dr. Claw) is a server setting for every
// device. It is independent of light and dark. This browser keeps a copy in
// pn.brandTheme, so theme-init.js shows it as data-brand-theme before first
// paint, also on the sign-in page, which cannot read the settings.
import { BRAND_THEMES } from '../../shared/contract.js';
import { createStoredChoice } from './stored-choice.js';

/** @type {{ key: string, values: ['dark', 'light'] }} */
export const THEME = { key: 'pn.theme', values: ['dark', 'light'] };

/** @type {{ key: string, values: typeof BRAND_THEMES }} */
export const BRAND_THEME = { key: 'pn.brandTheme', values: BRAND_THEMES };

/**
 * Shows a brand theme from the server settings and keeps a copy for the
 * next page load. An unknown value (for example from an older server) is Classic.
 * @param {object} options
 * @param {() => Pick<Storage, 'setItem'>} options.getStorage
 * @param {{ dataset: Record<string, string> }} options.root Usually document.documentElement.
 * @param {string | undefined} options.value
 */
export function setBrandTheme({ getStorage, root, value }) {
  const brandTheme = BRAND_THEMES.includes(/** @type {any} */ (value)) ? value : BRAND_THEMES[0];
  root.dataset.brandTheme = brandTheme;
  try {
    getStorage().setItem(BRAND_THEME.key, brandTheme);
  } catch {
    // Storage can be blocked. The next page load then shows Classic until it reads the settings.
  }
}

/**
 * @param {object} options
 * @param {() => Pick<Storage, 'getItem' | 'setItem'>} options.getStorage
 * @param {{ dataset: Record<string, string> }} options.root Usually document.documentElement.
 * @param {(theme: 'dark' | 'light') => void} [options.onChange]
 */
export function createTheme({ getStorage, root, onChange }) {
  const theme = createStoredChoice({
    getStorage,
    ...THEME,
    onChange: (value) => {
      root.dataset.theme = value;
      onChange?.(value);
    },
  });
  root.dataset.theme = theme.get();
  return theme;
}

/**
 * Switches the theme with a circle that grows from the toggle button, by the
 * View Transitions API (THM-1). Without the API, or with reduced motion, the
 * switch is instant (THM-2).
 * @param {object} options
 * @param {() => void} options.toggle Switches the theme.
 * @param {{ getBoundingClientRect(): { left: number, top: number, width: number, height: number } }} options.button
 * @param {Document} [options.doc]
 * @param {Window} [options.win]
 * @returns {'animated' | 'instant'}
 */
export function animateThemeSwitch({ toggle, button, doc = document, win = window }) {
  const reduce = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (typeof doc.startViewTransition !== 'function' || reduce) {
    toggle();
    return 'instant';
  }
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, win.innerWidth - x), Math.max(y, win.innerHeight - y));
  const transition = doc.startViewTransition(toggle);
  // A transition that the browser skips (for example a second quick switch)
  // rejects `ready`. The theme has switched anyway, so there is nothing to do.
  transition.ready.then(
    () =>
      doc.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 450, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      ),
    () => {},
  );
  return 'animated';
}
