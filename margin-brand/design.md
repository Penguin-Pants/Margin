# design.md — Margin

## 1. Design philosophy

Margin is a private single-user writing and coding environment. The UI should feel controlled, minimal and slightly cinematic without interfering with day-to-day use.

The brand inherits the **Dr. Claw Development** family DNA:

- black, charcoal and red foundations,
- metallic silver accents,
- subtle retro-futurist tension,
- strong geometry,
- dark-mode-first presentation.

Margin's product-specific role is to be the quiet, precise editor in that family. It should feel more *focused command console* than *showy villain lair*.

## 2. Product personality

- Focused
- Private
- Technical
- Controlled
- Compact
- Slightly dramatic, never campy

## 3. Parent-brand inheritance rules

### Shared Dr. Claw elements

- Villain Red as the single strong accent color
- Dark surfaces with charcoal layering
- Metallic silver for emblematic and structural details
- Strong rectangular / geometric composition
- Minimal decorative motion

### Unique Margin elements

- Document-page symbol with one red margin bar
- Writing / editing / notes emphasis
- Structural clarity over intimidation
- Cleaner, less aggressive composition than sibling products

## 4. Color tokens

### Core palette

| Token | Hex | Use |
|---|---|---|
| `--color-villain-red` | `#E10606` | Primary accent, active controls, highlights |
| `--color-shadow-black` | `#0B0B0B` | App background, deepest surfaces |
| `--color-charcoal` | `#111111` | Surface and panel base |
| `--color-panel` | `#161616` | Secondary panel fill |
| `--color-panel-2` | `#1B1B1B` | Elevated panels, tabs, menus |
| `--color-steel-gray` | `#4A4A4A` | Borders, muted chrome, secondary icon strokes |
| `--color-metallic-silver` | `#8F959C` | Branded icon treatment, muted highlights |
| `--color-highlight-white` | `#EDEDED` | Primary text and high-contrast icon detail |
| `--color-border` | `#2C2C2C` | Border system |
| `--color-text-muted` | `#B9BCC1` | Secondary text |

### Semantic usage

| Semantic token | Suggested value |
|---|---|
| `--bg-app` | `var(--color-shadow-black)` |
| `--bg-surface` | `var(--color-charcoal)` |
| `--bg-surface-2` | `var(--color-panel)` |
| `--bg-surface-3` | `var(--color-panel-2)` |
| `--border-default` | `var(--color-border)` |
| `--text-primary` | `var(--color-highlight-white)` |
| `--text-secondary` | `var(--color-text-muted)` |
| `--accent-primary` | `var(--color-villain-red)` |
| `--accent-primary-contrast` | `var(--color-highlight-white)` |
| `--focus-ring` | `var(--color-villain-red)` |
| `--danger` | `var(--color-villain-red)` |

## 5. Typography

The repository currently uses a practical system stack and should stay that way.

### UI type

Use the existing stack:

```css
system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
```

### Editorial / code contexts

Keep the editor's existing monospace behavior where already defined by the application stack.

### Hierarchy

- App titles: 20–24px, semibold or bold
- Dialog / panel headings: 16–18px, semibold
- Body copy: 14px default
- Supporting text: 12–13px

Do not introduce a custom webfont dependency solely for branding.

## 6. Iconography

### Primary app symbol

A simplified document page with:

- a folded corner,
- metallic or white structure,
- a vertical red margin,
- short horizontal content lines.

### Icon rules

- Keep icon strokes simple and readable.
- Avoid thin ornamental lines below 24px contexts.
- Preserve a consistent corner radius language.
- In monochrome contexts, reduce to black/white while keeping the redline concept when possible.

## 7. Spacing and layout

- 4px base spacing unit
- Primary component rhythm: 8 / 12 / 16 / 24px
- Panels and dialogs: 8px radius
- Larger surfaces and app cards: 12–16px radius where appropriate
- Avoid excessive empty space; this is a compact tool, not a marketing site

## 8. Borders, elevation and surfaces

- Use visible but restrained borders
- Prefer border and contrast over heavy shadows
- Use metallic silver sparingly in branded contexts, not as a generic UI color everywhere
- Menus and dialogs may have a soft shadow but should not look glossy or skeuomorphic

## 9. Component appearance

### Buttons

- Default: dark surface + subtle border
- Primary: villain red background, white text
- Hover: slightly brighter border / red emphasis
- Focus: 2px focus ring in villain red

### Tabs

- Dark chrome, active tab slightly raised or higher contrast
- Active state may use a thin red top or underline accent instead of blue

### Panels

- Left outline panel, menus and status areas should use layered charcoal surfaces
- Structural separators should use `--border-default`

### Forms

- Inputs remain dark with clear contrast
- Focused fields use the red focus ring
- Error states use villain red without additional alarm colors unless required

## 10. Motion and animation

- Keep motion minimal
- Use only short opacity or border transitions (100–180ms)
- Avoid branded animations that distract from editing
- No pulsing red effects, scans or cartoon villain theatrics

## 11. Accessibility

- Maintain strong contrast in both dark and light themes
- Icons must remain legible at 16px and 32px
- Focus states must be visible without relying on color alone
- Never use low-contrast gray-on-black for essential text
- Preserve keyboard navigation behavior already present in the app

## 12. Light and dark themes

### Dark theme

This is the primary theme. Use the full Dr. Claw palette here.

### Light theme

Retain light theme support, but reinterpret red carefully:

- background becomes off-white / pale gray,
- text becomes near-black,
- red stays the primary accent,
- borders become cool light gray,
- metallic silver should become a neutral gray rather than a chrome effect.

Do not force bright red backgrounds across large areas in light mode.

## 13. Platform-specific rules

### Web application / PWA

Required assets:

- favicon SVG
- favicon ICO
- 16px and 32px favicon PNGs
- Apple touch icon
- `icon-192.png`
- `icon-512.png`
- `icon-maskable-512.png`
- social preview image

### Repository / docs

Useful support assets:

- README banner
- selected identity preview

## 14. Correct / incorrect usage

### Correct

- Use the Redline icon with the approved palette.
- Use red as a targeted emphasis color.
- Keep branding integrated into the existing product shell.
- Preserve the app's compact, tool-like nature.

### Incorrect

- Replacing every neutral UI color with red
- Adding cartoon claws, cats or villain faces to the editor UI
- Switching to a generic neon cyberpunk look
- Using a complex icon that collapses at 16px
- Treating marketing mockups as permission to redesign product workflows

## 15. Implementation notes for this repository

- Preserve the app's existing layout and functionality.
- Update the browser title, manifest and login branding from **Notepad** / **NPPweb** to **Margin**.
- Replace the old blue primary accent with the Dr. Claw red where the change is low-risk and user-facing.
- Keep technical identifiers, data structures and existing behavior stable unless a branding change explicitly requires an update.
