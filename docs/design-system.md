# LiD Prep — Design System

A complete, self-contained specification of the LiD Prep design system: tokens, the CSS-variable contract, font stacks, component specs, and interaction and accessibility rules. Everything here is copy-pasteable: raw values, ready-to-use CSS, and clear integration points.

Themes compile to CSS custom properties on `:root`. Components reference `var(--*)` and never hardcode color, font, radius, or motion values. The token layer is plain CSS variables and is framework-agnostic; the examples show a Tailwind CSS v4 bridge but nothing here depends on Tailwind.

---

## Table of contents

1. Architecture: how theming works
2. Color tokens
3. Highlight system
4. Typography
5. Radius, tracking, motion
6. Layout and spacing
7. The CSS-variable contract
8. Component specs
9. Interaction patterns
10. Accessibility
11. Drop-in starter CSS

---

## 1. Architecture: how theming works

- **Tokens are CSS custom properties on `:root`.** A typed `Theme` object is written to `:root` at runtime, one `root.style.setProperty('--color-…', value)` per token.
- **Two independent axes:** `theme` (which palette and personality) and `mode` (`light` or `dark`). Two themes ship: **Cal x Readwise** (default) and **High Contrast**. Each carries a full light and dark scale. Mode is not part of the theme; it selects which scale is written.
- **No re-render on switch.** Changing theme or mode only rewrites `:root` variables; the component tree does not re-render. A `lid-mode-light` / `lid-mode-dark` class and `color-scheme` are also set on `<html>`.
- **Pre-hydration paint.** An inline script applies the stored theme and mode before the app hydrates, avoiding a flash. The global stylesheet also hardcodes the Cal x Readwise light values as bootstrap defaults so the first paint is correct even before JavaScript runs.
- **Utility bridge.** A small `@theme inline` block maps the variables to utility classes, so components can write `bg-surface text-ink border-border` instead of `bg-[var(--color-surface)]`.

The `Theme` type:

```ts
type ColorMode = 'light' | 'dark'
type HighlightKind = 'date' | 'event' | 'concept' | 'person' | 'place' | 'law'
type HighlightTreatment = 'pill' | 'tint' | 'underline' | 'italic-border' | 'mono-border'

type HighlightSpec = { color: string; textColor?: string; treatment: HighlightTreatment }

type ColorScale = {
  background: string; surface: string; 'surface-2': string
  ink: string; 'ink-muted': string; 'ink-subtle': string; 'ink-inverse'?: string
  border: string; 'border-strong': string
  action: string; 'action-inverse': string
  'reading-surface': string; 'reading-ink': string
  success: string; 'success-tint': string
  error: string; 'error-tint': string
  info: string; warning: string; 'focus-ring': string
}

type Theme = {
  id: string
  name: string
  description?: string
  tokens: {
    color: { light: ColorScale; dark: ColorScale }
    highlight: Record<HighlightKind, HighlightSpec>
    font: { display: string; ui: string; reading: string; mono: string }
    radius: { sm: string; md: string; lg: string; pill: string }
    tracking: { display: string; ui: string; reading: string }
    motion?: { fast: string; base: string; slow: string }
  }
}
```

---

## 2. Color tokens

Naming: the emitted CSS variable is `--color-{token}` (for example, token `surface-2` becomes `--color-surface-2`). Every text-on-surface pair below is verified at **WCAG AA** (at least 4.5:1 body, at least 3:1 large or UI text) in both modes for both themes. The specific greys are the exact values chosen to clear that bar; keep them as-is unless you re-verify contrast.

### 2.1 Theme: Cal x Readwise (default, `id: cal-readwise-hybrid`)

Grayscale chrome, a warm reading surface, and three-hue highlights. Built for long reading sessions.

**Light mode**

| Token | Value | Use |
|---|---|---|
| `background` | `#F4F4F4` | Outer page background |
| `surface` | `#FFFFFF` | Cards, modals |
| `surface-2` | `#F0EFEC` | Inset surfaces, hover, summary card |
| `ink` | `#141414` | Primary text |
| `ink-muted` | `#6B6B6B` | Secondary text |
| `ink-subtle` | `#6B6B6B` | Tertiary text |
| `ink-inverse` | `#FFFFFF` | Text on dark or action fills |
| `border` | `#E5E5E5` | Default borders |
| `border-strong` | `#D4D4D4` | Emphasis borders |
| `action` | `#141414` | Primary buttons |
| `action-inverse` | `#FFFFFF` | Text on action |
| `reading-surface` | `#FBF9F4` | Long-form reading background (warm paper) |
| `reading-ink` | `#1A1A1A` | Text on reading surface |
| `success` | `#4A7C59` | Correct markers |
| `success-tint` | `rgba(74,124,89,0.10)` | Correct row background |
| `error` | `#A8413B` | Incorrect markers |
| `error-tint` | `rgba(168,65,59,0.10)` | Incorrect row background |
| `info` | `#5A6F8A` | Neutral, non-error informational state |
| `warning` | `#A88A4D` | Time-sensitive accent |
| `focus-ring` | `#141414` | Keyboard focus outline |

**Dark mode**

| Token | Value |
|---|---|
| `background` | `#0A0A0A` |
| `surface` | `#141414` |
| `surface-2` | `#1B1B1B` |
| `ink` | `#F4F4F4` |
| `ink-muted` | `#9C9C9C` |
| `ink-subtle` | `#848484` |
| `ink-inverse` | `#141414` |
| `border` | `#262626` |
| `border-strong` | `#3A3A3A` |
| `action` | `#F4F4F4` |
| `action-inverse` | `#141414` |
| `reading-surface` | `#161412` |
| `reading-ink` | `#E8E5DE` |
| `success` | `#7BAA89` |
| `success-tint` | `rgba(123,170,137,0.14)` |
| `error` | `#D08580` |
| `error-tint` | `rgba(208,133,128,0.14)` |
| `info` | `#7A8FAA` |
| `warning` | `#C8A86D` |
| `focus-ring` | `#F4F4F4` |

### 2.2 Theme: High Contrast (`id: monochrome-stark`)

Pure black-on-white, maximal contrast (core pairs about 21:1, AAA by construction), no warmth, and **sharp corners** (all radii `0`). This is the accessibility preset.

**Light mode**

| Token | Value |
|---|---|
| `background` | `#FFFFFF` |
| `surface` | `#FFFFFF` |
| `surface-2` | `#F2F2F2` |
| `ink` | `#000000` |
| `ink-muted` | `#525252` |
| `ink-subtle` | `#6D6D6D` |
| `ink-inverse` | `#FFFFFF` |
| `border` | `#E5E5E5` |
| `border-strong` | `#000000` |
| `action` | `#000000` |
| `action-inverse` | `#FFFFFF` |
| `reading-surface` | `#FFFFFF` |
| `reading-ink` | `#000000` |
| `success` | `#000000` |
| `success-tint` | `rgba(0,0,0,0.06)` |
| `error` | `#000000` |
| `error-tint` | `rgba(0,0,0,0.06)` |
| `info` | `#525252` |
| `warning` | `#525252` |
| `focus-ring` | `#000000` |

**Dark mode**

| Token | Value |
|---|---|
| `background` | `#000000` |
| `surface` | `#0A0A0A` |
| `surface-2` | `#1A1A1A` |
| `ink` | `#FFFFFF` |
| `ink-muted` | `#A3A3A3` |
| `ink-subtle` | `#848484` |
| `ink-inverse` | `#000000` |
| `border` | `#262626` |
| `border-strong` | `#FFFFFF` |
| `action` | `#FFFFFF` |
| `action-inverse` | `#000000` |
| `reading-surface` | `#000000` |
| `reading-ink` | `#FFFFFF` |
| `success` | `#FFFFFF` |
| `success-tint` | `rgba(255,255,255,0.08)` |
| `error` | `#FFFFFF` |
| `error-tint` | `rgba(255,255,255,0.08)` |
| `info` | `#A3A3A3` |
| `warning` | `#A3A3A3` |
| `focus-ring` | `#FFFFFF` |

> In High Contrast, `success` and `error` collapse to pure ink. Meaning is carried by icon, shape, or text, never color alone. Never rely on `success` or `error` hue as the sole signal in any theme.

---

## 3. Highlight system

Inline phrase-level annotations inside reading content, rendered as `<mark data-highlight-kind data-highlight-treatment>`. **Six kinds, three base hues, five treatments.** The treatment (not just color) differentiates kinds, so meaning survives colorblindness and the monochrome theme.

Per kind, the theme emits three variables: `--highlight-{kind}-color`, `--highlight-{kind}-text-color` (defaults to `var(--color-ink)`), and `--highlight-{kind}-treatment`.

### 3.1 Cal x Readwise mapping

| Kind | Color | Treatment | Text color |
|---|---|---|---|
| `date` | `#FBDA83` | `pill` | `#1A1A1A` |
| `event` | `#FBDA83` | `tint` | inherits ink |
| `concept` | `#E4938E` | `underline` | inherits ink |
| `person` | `#E4938E` | `italic-border` | inherits ink |
| `place` | `#8DBBFF` | `tint` | inherits ink |
| `law` | `#8DBBFF` | `mono-border` | inherits ink |

`pill` is the only treatment that sets its own text color; the rest keep body ink, so dark-mode contrast is automatic.

### 3.2 High Contrast mapping (grayscale; treatment alone differentiates)

| Kind | Color | Treatment |
|---|---|---|
| `date` | `var(--color-ink)` | `pill` (text uses `--color-action-inverse`) |
| `event` | `var(--color-ink-muted)` | `tint` |
| `concept` | `var(--color-ink)` | `underline` |
| `person` | `var(--color-ink)` | `italic-border` |
| `place` | `var(--color-ink-muted)` | `tint` |
| `law` | `var(--color-ink)` | `mono-border` |

### 3.3 Treatment CSS

The renderer makes no styling decisions; it wraps ranges in `<mark>` and CSS attribute selectors do the rest. At each call site the mark sets `--highlight-color` and `--highlight-text-color` inline from the active spec.

```css
mark[data-highlight-kind] { background: transparent; color: inherit; padding: 0; }

mark[data-highlight-kind][data-highlight-treatment='pill'] {
  background-color: var(--highlight-color, transparent);
  color: var(--highlight-text-color, inherit);
  padding: 1px 8px; border-radius: var(--radius-pill); font-weight: 500;
}
mark[data-highlight-kind][data-highlight-treatment='tint'] {
  background-color: color-mix(in srgb, var(--highlight-color, transparent) 28%, transparent);
  color: var(--highlight-text-color, inherit);
  padding: 1px 6px; border-radius: 3px;
}
mark[data-highlight-kind][data-highlight-treatment='underline'] {
  border-bottom: 2px solid var(--highlight-color, currentColor); padding-bottom: 1px;
}
mark[data-highlight-kind][data-highlight-treatment='italic-border'] {
  font-style: italic; border-bottom: 1px solid var(--highlight-color, currentColor); padding-bottom: 1px;
}
mark[data-highlight-kind][data-highlight-treatment='mono-border'] {
  font-family: var(--font-mono); border: 1px solid var(--highlight-color, currentColor);
  padding: 0 6px; border-radius: 4px; font-size: 0.88em; white-space: nowrap;
}
```

> Authoring rule: mark only the **first occurrence** of a phrase per reading layer. Marking every occurrence is visual noise.

---

## 4. Typography

### 4.1 Font families (per theme)

Four roles. Values are the exact stacks written to `--font-{role}`.

| Role (`--font-...`) | Cal x Readwise | High Contrast |
|---|---|---|
| `display` | `var(--font-google-sans-loaded), "Inter Tight", "Inter", ui-sans-serif, system-ui, sans-serif` | `"Inter Tight", ui-sans-serif, system-ui, sans-serif` |
| `ui` | `"Inter", ui-sans-serif, system-ui, sans-serif` | `"Inter", ui-sans-serif, system-ui, sans-serif` |
| `reading` | `var(--font-google-sans-loaded), "Inter", ui-sans-serif, system-ui, sans-serif` | `"Inter", ui-sans-serif, system-ui, sans-serif` |
| `mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` | same |

**Roles:** `display` = headings and question text; `ui` = chrome, buttons, nav, labels; `reading` = long-form content; `mono` = code, token names, and the `mono-border` highlight.

### 4.2 Fonts to load

| Family | Role variable | Weights | Notes |
|---|---|---|---|
| **Google Sans Flex** | `--font-google-sans-loaded` | `400-700` (variable) | Self-host the woff2. Leads the display and reading stacks. |
| **Inter** | `--font-ui-loaded` | default | UI chrome |
| **Inter Tight** | `--font-display-loaded` | `500, 600, 700` | Display fallback and High Contrast display |
| **JetBrains Mono** | `--font-mono-loaded` | `400, 500` | Mono |

Provide these loaded-font variables however your framework loads fonts (`@font-face`, a font loader, or a package such as Fontsource). If Google Sans Flex is not available, the stacks fall back to Inter Tight then Inter then system sans with no code change.

### 4.3 Type scale

Sizes are used as explicit pixel values rather than a named scale. This is the working scale, most-used first:

| Size | Typical role |
|---|---|
| `11px` | Micro-labels, mono token captions, uppercase eyebrows |
| `12px` | Captions, badges, helper text, section eyebrows |
| `13px` | Most common UI body (nav, meta, secondary text) |
| `14px` | UI body, options, buttons |
| `15px` | Emphasized UI or reading body |
| `16px` | Reading body, primary body |
| `18px` | Question text, emphasized body |
| `20px` | Sub-section headings |
| `24px`, `28px`, `30px` | Section headings through page titles |

**Weights:** `semibold` (600) is dominant, then `medium` (500), `normal` (400), `bold` (700).

**Line height:** long-form reading `1.6-1.7`; UI body `1.5-1.55`; tighter headings `1.2-1.4`; single-line pills and badges use `1`.

**Tracking tokens** (letter-spacing, per theme):

| `--tracking-...` | Cal x Readwise | High Contrast |
|---|---|---|
| `display` | `-0.02em` | `-0.04em` |
| `ui` | `0` | `0` |
| `reading` | `0` | `-0.01em` |

Uppercase eyebrow labels additionally use a local `0.06em` tracking.

---

## 5. Radius, tracking, motion

**Radius** (`--radius-{sm|md|lg|pill}`):

| Token | Cal x Readwise | High Contrast |
|---|---|---|
| `sm` | `4px` | `0` |
| `md` | `8px` | `0` |
| `lg` | `10px` | `0` |
| `pill` | `9999px` | `0` |

Cards typically use `md`; pills and badges use `pill`.

**Motion** (`--motion-{fast|base|slow}`, both themes): `fast: 150ms`, `base: 250ms`, `slow: 300ms`.

Motion usage:

| Action | Duration | Easing |
|---|---|---|
| Hover state | 150ms (`fast`) | ease-out |
| Theme switch | 200ms | ease-out |
| Modal open/close | 200ms | ease-out (scale 95% to 100%, opacity 0 to 1) |
| Reveal bevel | 250ms (`base`) | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Content cross-fade | 150ms each way | ease-in-out |
| Option indicator | 250ms (`base`) | ease-out |
| Timer pulse (warning) | 1.5s loop | ease-in-out |
| Panel slide | 300ms (`slow`) | `cubic-bezier(0.16, 1, 0.3, 1)` |

**Reduced motion** is honored globally: `@media (prefers-reduced-motion: reduce)` forces all animation and transition durations to `0.01ms` and `scroll-behavior: auto`. Decorative animations are gated behind the `motion-safe` variant.

---

## 6. Layout and spacing

**Width tokens** (theme-independent):

| Token | Value | Use |
|---|---|---|
| `--width-shell` | `1200px` | Wide container: header, footer, list and grid pages, question pages |
| `--width-readable` | `720px` | Narrow reading measure: marketing prose, chapter reader, auth and transactional screens |
| `--header-h` | `56px` | Sticky header height; sub-nav pins at `top: var(--header-h)` |

**Spacing:** an 4px base unit (`1 unit = 0.25rem`). Common steps: `8px` and `12px` gaps, `16px` and `24px` horizontal padding. Card padding runs 16-24px; the primary content card uses 24px on mobile and 32px on desktop.

**Content pages** use a responsive two-column layout: on large screens the primary card sits left with an aside on the right; below that breakpoint it collapses to a single column.

---

## 7. The CSS-variable contract

This is the full set of variables written to `:root`. This is the integration surface: set these and any component built against them themes correctly.

```
/* colors — one per ColorScale key, for the ACTIVE mode */
--color-background  --color-surface  --color-surface-2
--color-ink  --color-ink-muted  --color-ink-subtle  --color-ink-inverse
--color-border  --color-border-strong
--color-action  --color-action-inverse
--color-reading-surface  --color-reading-ink
--color-success  --color-success-tint  --color-error  --color-error-tint
--color-info  --color-warning  --color-focus-ring

/* fonts */   --font-display  --font-ui  --font-reading  --font-mono
/* radius */  --radius-sm  --radius-md  --radius-lg  --radius-pill
/* tracking */--tracking-display  --tracking-ui  --tracking-reading
/* motion */  --motion-fast  --motion-base  --motion-slow

/* highlights — per kind in {date,event,concept,person,place,law} */
--highlight-{kind}-color
--highlight-{kind}-text-color   /* defaults to var(--color-ink) */
--highlight-{kind}-treatment    /* pill | tint | underline | italic-border | mono-border */
```

Plus on `<html>`: class `lid-mode-light` or `lid-mode-dark`, and `color-scheme: light|dark`.

**Utility bridge** (so `bg-surface`, `text-ink`, `border-border`, `font-display`, `rounded-md` resolve in Tailwind v4):

```css
@theme inline {
  --color-background: var(--color-background);
  --color-surface: var(--color-surface);
  --color-surface-2: var(--color-surface-2);
  --color-ink: var(--color-ink);
  --color-ink-muted: var(--color-ink-muted);
  --color-ink-subtle: var(--color-ink-subtle);
  --color-ink-inverse: var(--color-ink-inverse);
  --color-border-default: var(--color-border);
  --color-border-strong: var(--color-border-strong);
  --color-action: var(--color-action);
  --color-action-inverse: var(--color-action-inverse);
  --color-reading-surface: var(--color-reading-surface);
  --color-reading-ink: var(--color-reading-ink);
  --color-success: var(--color-success);
  --color-error: var(--color-error);
  --color-info: var(--color-info);
  --color-warning: var(--color-warning);
  --font-display: var(--font-display);
  --font-ui: var(--font-ui);
  --font-reading: var(--font-reading);
  --font-mono: var(--font-mono);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-pill: var(--radius-pill);
}
```

> Tailwind v4 note: `font-[var(--font-display)]` emits an empty rule because Tailwind cannot infer the property from a bare `var()`. Either use the `font-display` utility from the bridge above, or add the explicit utility block in section 11.

---

## 8. Component specs

### AppHeader
Sticky, `--header-h` (56px) min-height. Background `--color-surface`, bottom border `--color-border`. Left: wordmark. Center: breadcrumb or mode label (hidden on mobile). Right: theme switcher, language toggle, light/dark toggle, settings (collapses to a drawer on mobile). Replaced by a stripped-down timer header in exam mode.

### Primary content card
Sits in the left column of the shell-width page, single column on narrow screens. Padding 24px mobile, 32px desktop.
- **Header row:** count pill left, optional status badge, category pill right.
- **Title text:** `--font-display`, about 18px, weight 600, normal line height; a min-height prevents layout shift between short and long content.
- **Options:** vertical stack, 8px gap, each a full-width button row.
- **Action row:** right-aligned primary button; left-aligned secondary button (hidden on the first step).
- **Reveal bevel:** full-width strip at card bottom, background `color-mix(in srgb, var(--color-ink) 5%, var(--color-surface))`, 9% on hover.
- **Summary card:** appears below the bevel on reveal; padding 24px; background typically `--color-surface-2`.

### Option row (state machine)
Padding `12px 16px`, `border-radius: var(--radius-md)`, 12px gap between indicator and label.

| State | Indicator | Border | Background |
|---|---|---|---|
| Unselected | empty circle | 1px `--color-border` | `--color-surface` |
| Hover | empty circle | 1px `--color-border-strong` | `--color-surface-2` |
| Selected (pre-submit) | filled circle, `--color-ink` | 1px `--color-ink` | `--color-surface` |
| Correct (chosen) | check, `--color-success` | 2px `--color-success` | `color-mix(success 8%, surface)` |
| Correct (not chosen) | check outline | 1px `--color-success` | `--color-surface` |
| Incorrect (chosen) | X, `--color-error` | 2px `--color-error` | `color-mix(error 8%, surface)` |
| Incorrect (not chosen) | empty circle | 1px `--color-border` | `--color-surface` |

### Reading / extended view
Long-form reading uses `--color-reading-surface`, `--color-reading-ink`, and `--font-reading`, constrained to `--width-readable` (720px). Highlights render inline. Open animation: scale 95% to 100%, opacity 0 to 1, 200ms ease-out.

### Timer
`--font-ui`, `MM:SS`.
- Normal (over 5:00): `--color-ink`, weight 600.
- Warning (5:00 or less): `--color-error`, weight 700, gentle pulse (opacity 1 to 0.7 to 1, 1.5s).
- Critical (0:30 or less): `--color-error`, larger, stronger pulse.
- Expired: static `00:00`, auto-submit.
Updates once per second visually.

### Buttons
- **Primary:** background `--color-action`, text `--color-action-inverse`, `--radius-md`, `--font-ui` weight 600, about 14px.
- **Secondary:** transparent background, `--color-ink-muted` text, 1px `--color-border`; hover moves to `--color-surface-2` background and `--color-ink` text. About 36px tall, `9px 14px` padding.

---

## 9. Interaction patterns

**Answer submission:** select an option (indicator becomes a filled circle, primary button enables), then submit (indicators animate to check or X over 250ms, the summary bevel auto-reveals, the primary button becomes Next), then optionally open the extended reading view, then advance (cross-fade 150ms, bevel collapses, prior state preserved). A back action revisits earlier steps read-only.

**Exam mode:** the same flow, minus the summary reveal (no answer context mid-exam); back navigation is allowed; the timer is pinned; a Finish action replaces Next on the last step. Graded runs are server-owned: the client is an optimistic cache, and scoring and the timer are authoritative on the server.

**Theme or mode switch:** selecting a theme or toggling mode updates the `:root` variables (about 200ms transition); components reflect immediately with no reload or flicker; the choice persists.

**Language toggle:** all content and UI labels re-render in place; the URL does not change; the choice persists.

---

## 10. Accessibility

Accessibility is a hard requirement, not a nice-to-have.

- **Contrast:** every text-on-surface token pair meets WCAG AA (at least 4.5:1 body, at least 3:1 large or UI text) in both modes for both themes. Enforce this at build time and fail the build on any violation. The specific greys in section 2 are the exact values that clear this bar; do not adjust them without re-validating. High Contrast targets AAA (about 21:1).
- **Focus:** global `:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }`, visible at 3:1 or better against surrounding surfaces in every theme and mode.
- **Never color alone:** semantic states pair color with an icon, shape, or text (check versus X, constructive copy for a not-yet-passed state). In the monochrome theme, `success` and `error` are both pure ink, so color can never be the sole signal.
- **Semantic HTML first:** `<h2>` for section headings, real `<button>` for options (not `div` with a button role), `<dialog>` for modals with `aria-labelledby`, and `aria-live="polite"` or `"assertive"` for updates and warnings.
- **Keyboard:** options are Tab-navigable and Space/Enter-selectable; modals trap focus and restore it on close (Escape closes); lists support arrow-key navigation.
- **Reduced motion:** fully honored (see section 5).

---

## 11. Drop-in starter CSS

Paste this to get the Cal x Readwise light theme rendering immediately. Swap in the dark scale under a `.lid-mode-dark` selector (or via your theme applier) and the High Contrast values from section 2.2 as needed.

```css
:root {
  color-scheme: light;

  /* Cal x Readwise — light */
  --color-background: #f4f4f4;
  --color-surface: #ffffff;
  --color-surface-2: #f0efec;
  --color-ink: #141414;
  --color-ink-muted: #6b6b6b;
  --color-ink-subtle: #6b6b6b;
  --color-ink-inverse: #ffffff;
  --color-border: #e5e5e5;
  --color-border-strong: #d4d4d4;
  --color-action: #141414;
  --color-action-inverse: #ffffff;
  --color-reading-surface: #fbf9f4;
  --color-reading-ink: #1a1a1a;
  --color-success: #4a7c59;
  --color-success-tint: rgba(74, 124, 89, 0.1);
  --color-error: #a8413b;
  --color-error-tint: rgba(168, 65, 59, 0.1);
  --color-info: #5a6f8a;
  --color-warning: #a88a4d;
  --color-focus-ring: #141414;

  /* fonts — supply the *-loaded vars via your font loader, or drop them for system fallback */
  --font-display: var(--font-google-sans-loaded), 'Inter Tight', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-ui: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-reading: var(--font-google-sans-loaded), 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

  /* layout */
  --width-shell: 1200px;
  --width-readable: 720px;
  --header-h: 56px;

  /* radius */
  --radius-sm: 4px;  --radius-md: 8px;  --radius-lg: 10px;  --radius-pill: 9999px;

  /* tracking */
  --tracking-display: -0.02em;  --tracking-ui: 0;  --tracking-reading: 0;

  /* motion */
  --motion-fast: 150ms;  --motion-base: 250ms;  --motion-slow: 300ms;

  /* highlights — Cal x Readwise */
  --highlight-date-color: #fbda83;   --highlight-date-text-color: #1a1a1a;             --highlight-date-treatment: pill;
  --highlight-event-color: #fbda83;  --highlight-event-text-color: var(--color-ink);   --highlight-event-treatment: tint;
  --highlight-concept-color: #e4938e;--highlight-concept-text-color: var(--color-ink); --highlight-concept-treatment: underline;
  --highlight-person-color: #e4938e; --highlight-person-text-color: var(--color-ink);  --highlight-person-treatment: italic-border;
  --highlight-place-color: #8dbbff;  --highlight-place-text-color: var(--color-ink);   --highlight-place-treatment: tint;
  --highlight-law-color: #8dbbff;    --highlight-law-text-color: var(--color-ink);     --highlight-law-treatment: mono-border;
}

html, body {
  background-color: var(--color-background);
  color: var(--color-ink);
  font-family: var(--font-ui);
}
body { min-height: 100dvh; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }

:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

For the highlight `<mark>` treatments, copy the block in section 3.3 verbatim.

If you use Tailwind v4 and want `font-[var(--font-*)]` classes to work (they otherwise emit empty rules), add:

```css
@layer utilities {
  .font-\[var\(--font-display\)\] { font-family: var(--font-display); }
  .font-\[var\(--font-ui\)\]      { font-family: var(--font-ui); }
  .font-\[var\(--font-reading\)\] { font-family: var(--font-reading); }
  .font-\[var\(--font-mono\)\]    { font-family: var(--font-mono); }
}
```