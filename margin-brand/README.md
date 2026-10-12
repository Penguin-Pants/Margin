# Margin branding package

This package contains the approved **Margin** visual identity using **Concept A: Redline**, refined to fit the **Dr. Claw Development** product family.

## Summary

- **Product name:** Margin
- **Parent brand:** Dr. Claw Development
- **Concept:** Redline
- **Tagline:** Private notes and code, in one place.
- **Core metaphor:** A metallic document with a single red editing margin.
- **Audience:** One primary user, working privately across devices on notes, Markdown and code.

## Package contents

- `assets/source/` — SVG masters
- `assets/exported/` — ready-to-use web and PWA assets
- `assets/mockups/` — visual preview of the selected identity
- `assets/supporting/` — repository/banner support asset
- `theme/` — design tokens
- `design.md` — full design system
- `brand-guidelines.md` — concise usage rules
- `implementation/claude-code-implementation-prompt.md` — implementation prompt for Claude Code or Codex

## Recommended repository placement

When integrating this into the repository, place the full folder at:

`/margin-brand/`

and use it as the canonical source of truth for future branding work.

## Verified source files

The `assets/source/` directory contains editable SVG masters. The `assets/exported/` directory contains real PNG/ICO renders (not mockups). `theme/tokens.css` adds styles only when `data-brand-theme="dr-claw"` is selected. Preserve the existing Classic CSS values and default to Classic for current users.

The `assets/source/wordmark.svg` and `horizontal-lockup.svg` use common system-font fallback for editable SVG text. For font-independent outline lettering, convert the glyphs to vector paths in a design editor before public distribution.
