Implement the approved **Margin** rebrand in the repository, using the provided branding package and preserving the application's existing behavior.

Repository: https://github.com/Penguin-Pants/NPPweb
Canonical branding source in the repo: `/margin-brand/`

## 1. Review and constraints

1. Read `AGENTS.md` and follow repository conventions.
2. Read `/margin-brand/README.md`, `/margin-brand/design.md`, `/margin-brand/brand-guidelines.md` and `/margin-brand/theme/tokens.css` before making changes.
3. Inspect the existing application, especially:
   - `README.md`
   - `web/index.html`
   - `web/login.html`
   - `web/styles.css`
   - `web/manifest.webmanifest`
   - `web/icons/`
   - any other user-facing titles, metadata, docs and assets
4. Preserve working functionality, architecture, tests and data compatibility.
5. Keep the GitHub repository name `NPPweb` unchanged.
6. Do not interpret the branding package as permission to redesign product workflows.

Before implementation, verify that `margin-brand/assets/source/icon.svg`, `margin-brand/assets/source/favicon.svg`, `margin-brand/assets/exported/icon-192.png`, `margin-brand/assets/exported/icon-512.png`, `margin-brand/assets/exported/icon-maskable-512.png` and `margin-brand/theme/tokens.css` all exist. If any are missing, stop and report them. The mockup PNGs are not acceptable substitutes.

## 2. Adopt the approved identity

Use the approved product identity exactly as defined in `/margin-brand/`.

- **Product name:** Margin
- **Parent brand:** Dr. Claw Development
- **Concept:** Redline
- **Tagline:** Private notes and code, in one place.
- **Primary symbol:** metallic document with one red margin bar
- **Primary accent:** `#E10606`
- **Core neutrals:** black / charcoal / metallic silver / white

Use the provided source assets. Do not regenerate the logo or invent a different concept.

## 3. Install assets

Use `/margin-brand/` as the canonical source. Copy or derive only what the app needs.

### Required destination mapping

- `/margin-brand/assets/exported/icon-192.png` -> `web/icons/icon-192.png`
- `/margin-brand/assets/exported/icon-512.png` -> `web/icons/icon-512.png`
- `/margin-brand/assets/exported/icon-maskable-512.png` -> `web/icons/icon-maskable-512.png`
- `/margin-brand/assets/exported/favicon-16.png` -> `web/favicon-16.png` (if used)
- `/margin-brand/assets/exported/favicon-32.png` -> `web/favicon-32.png` (if used)
- `/margin-brand/assets/exported/favicon.ico` -> `web/favicon.ico`
- `/margin-brand/assets/exported/apple-touch-icon.png` -> `web/apple-touch-icon.png`
- `/margin-brand/assets/source/favicon.svg` -> `web/favicon.svg` if beneficial

Update HTML and manifest references so these assets resolve correctly.

## 4. Rename the product everywhere it matters

Change user-facing branding from **Notepad** and **NPPweb** to **Margin** where appropriate.

Update, as applicable:

- browser titles
- login page title and visible heading
- app title and metadata
- PWA manifest `name` and `short_name`
- README and active documentation
- user-facing copy, installation text and branding references
- repository banners or images if present
- tests or snapshots only where branding text is asserted

Be careful not to blindly replace every occurrence of `Notepad` or `NPPweb`.

Do **not** rename low-value technical identifiers if doing so creates risk without user benefit, for example:

- database filenames
- persisted data structures
- API contracts
- environment variables unless clearly user-facing
- repository slug / GitHub URL

If a technical identifier contains a legacy name but is stable and harmless, prefer documenting it rather than changing it.

## 5. Add a visual-brand theme selector in Settings

**Critical requirement: Preserve the original visual theme as a fully supported option.** Do not permanently replace the current blue-accent styling with Dr. Claw colors.

Add one simple **Dr. Claw theme** on/off toggle inside the existing **Account > Settings** dialog:

- **Off: Classic** — the application's existing theme, including its original blue accent, surfaces, borders and UI appearance. Preserve its current light and dark variants.
- **On: Dr. Claw** — the approved Margin Redline design tokens and visual styling from `/margin-brand/design.md`. Support both light and dark variants.
- Default **Off / Classic** for existing users and for missing stored preferences to avoid changing their appearance without consent.
- Keep the current **Light / Dark** toggle independent. Switching the brand theme must not silently change the light/dark choice, and changing light/dark must not reset the brand theme. There are four supported combinations: Classic Dark, Classic Light, Dr. Claw Dark and Dr. Claw Light.
- Use a clear accessible control label, e.g. `Dr. Claw theme`, with its current state. Avoid a second main-toolbar control.
- Switch instantly without a page reload where feasible. Persist the preference using the application's existing settings infrastructure so it survives reloads and is available across devices. Inspect how current server-backed settings work before choosing a storage method; preserve backward compatibility and avoid unnecessary new infrastructure. Keep current open tabs and unsaved edits untouched.
- If device-to-device settings updates do not propagate live, they must at least apply on the next reload. Follow the existing cross-device settings behavior.
- No change to the app name, favicon, installed-PWA name, user data or underlying functionality when switching brand themes. The application remains **Margin** in both.
- Use a root-level attribute or equivalent semantic theme selector, compatible with the current `data-theme` light/dark mechanism. Ensure the initial theme is applied before paint if the existing initialization flow permits it, to avoid a flash of the wrong theme.
- Ensure login and editor screens respect the saved choice. If authentication prevents loading server settings on the login page, use a safe local fallback without breaking sign-in or exposing sensitive settings.

### Implementation approach

Define shared semantic tokens used by the UI, then provide **Classic** and **Dr. Claw** token sets for each light/dark mode. Reuse existing CSS variables where practical. Preserve the original Classic token values instead of overwriting them. Keep selectors clear and maintainable; do not duplicate the whole stylesheet.

## 6. Apply design tokens and UI styling

Use `/margin-brand/theme/tokens.css` and the guidance in `/margin-brand/design.md`.

Implement the branding within the current styling system. Prefer updating existing CSS variables over introducing a new framework.

### Expected styling changes

- Use the approved red accent only when **Dr. Claw** is selected. Preserve the original blue accent when **Classic** is selected.
- Preserve dark and light theme support within both brand themes.
- Keep surfaces compact, dark and practical.
- Maintain accessibility and readable contrast.
- Keep red focused on important emphasis rather than flooding the interface.

You may need to:

- update root CSS variables
- tune button styles
- update focus ring and active-state colors
- update border / panel tones where needed for consistency

Do not introduce unnecessary visual effects or new dependencies.

## 7. Update visual contexts

Apply branding consistently to:

- login screen
- browser tab / favicon
- installed PWA appearance
- manifest metadata
- any app shell branding or headings that should display the product name
- documentation imagery or banner usage if appropriate

If there is no good reason to add a visible logo into a specific screen, do not force one. Subtle branding is acceptable.

## 8. Validation

Run relevant checks after implementation.

- build
- tests
- any lint or formatting steps available in the repo

Also manually verify:

- icons load correctly
- favicon appears in browser tabs
- manifest names and icons are correct
- login screen shows Margin branding
- all four theme combinations display correctly, including login and editor screens
- Settings toggle works via keyboard and pointer and accurately shows the saved value
- brand-theme selection persists after reload, logout/login as appropriate, and on another device when the existing settings sync mechanism permits
- switching brand themes never discards open tabs or unsaved edits
- current users default to Classic if they have no preference
- existing notes / documents behavior remains unchanged
- no obvious outdated user-facing branding remains

## 9. Two-pass self-review

### Pass 1 — identify issues

Check for:

- missed legacy branding references
- broken asset paths
- inconsistent colors or unintended Classic-theme regressions
- interaction or persistence bugs in the Settings toggle
- inaccessible contrast or focus states
- visual regressions in dark or light mode
- unnecessary architectural changes
- test failures or broken builds

### Pass 2 — challenge findings

Discard speculative concerns. Fix confirmed issues and keep the final change set focused.

## 10. Deliverable expectations

Produce a single focused PR or commit series that:

- installs the Margin branding package assets into the correct locations
- updates active docs and visible product naming
- applies the approved Redline identity when Dr. Claw is enabled while preserving Classic
- adds a persistent Dr. Claw theme toggle in Account > Settings
- keeps the application working as before

Summarize:

- files changed
- branding decisions applied
- behavior and persistence of the Settings theme toggle
- tests run and results
- intentionally retained legacy identifiers
- any remaining risks or follow-up items
