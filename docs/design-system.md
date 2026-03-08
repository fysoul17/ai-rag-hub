# Design Style: Obsidian Pulse

> Dark, angular, and intense — a diamond-cut interface with pulsing red accents over an obsidian grid.

**Platform**: web
**Source**: `docs/design/style_1_obsidian_pulse.html`

---

## Implementation Note

This document defines the visual design language—HOW things should look.

When implementing:

1. Use your **feature spec** for page structure (WHAT sections/components to build)
2. Use **this document** for styling those components (HOW they should look)
3. Apply values using syntax appropriate for your framework

---

## Colors

| Role             | Value                          |
| ---------------- | ------------------------------ |
| Background       | `#0a0a0c`                      |
| Surface          | `#151518`                      |
| Surface Elevated | `#1d1d22`                      |
| Text             | `#f4f4f5`                      |
| Text Muted       | `#71717a`                      |
| Accent           | `#ef4444`                      |
| Accent Glow      | `rgba(239, 68, 68, 0.4)`      |
| Border           | `#27272a`                      |
| Status Green     | `#22c55e`                      |

**Gradients**:

- Accent bar: `90deg, #ef4444 0%, rgba(239, 68, 68, 0.4) 50%, #ef4444 100%`

## Typography

**Font Family**: Bebas Neue (headings), DM Sans (body)
**Bebas Neue Weights**: 400
**DM Sans Weights**: 400, 500, 700

| Element       | Font       | Size | Weight | Letter-spacing | Line-height |
| ------------- | ---------- | ---- | ------ | -------------- | ----------- |
| H1            | Bebas Neue | 84px | 400    | -0.02em        | 0.95        |
| H2            | Bebas Neue | 56px | 400    | -0.01em        | —           |
| H3            | Bebas Neue | 24px | 400    | 0.02em         | —           |
| Subtitle      | Bebas Neue | 18px | 400    | 0.1em          | —           |
| Body Large    | DM Sans    | 18px | 400    | —              | 1.7         |
| Body          | DM Sans    | 14px | 400    | —              | 1.6         |
| Small/Caption | DM Sans    | 12px | 500    | 0.2em          | —           |
| Label         | DM Sans    | 14px | 500    | 0.05em         | —           |

**Note**: Headings (Bebas Neue) are inherently uppercase. Labels and captions use `text-transform: uppercase`.

**Body text line-height**: `.feature-description` uses `1.7` at 14px while `.message` uses `1.6` at 14px. Choose based on content density (descriptions vs. chat messages).

## Spacing

| Context                      | Value                    |
| ---------------------------- | ------------------------ |
| Container max-width          | 1400px                   |
| Container padding            | 0 40px (mobile: 0 20px)  |
| Nav padding                  | 24px vertical            |
| Section padding              | 120px vertical           |
| Hero padding                 | 120px top, 80px bottom   |
| Card padding (large)         | 40px                     |
| Card padding (small)         | 24px                     |
| Grid gap                     | 24px                     |
| Hero grid gap                | 80px                     |
| CTA group gap                | 16px                     |
| Tight gap (icon + text)      | 8px                      |
| Logo gap                     | 12px                     |
| Nav link gap                 | 40px                     |
| Section header margin-bottom | 80px                     |
| Feature icon margin-bottom   | 24px                     |
| Title margin-bottom          | 12px                     |
| Hero tag margin-bottom       | 32px                     |
| H1 margin-bottom             | 24px                     |
| Hero description margin-bottom | 40px                   |

## Shape

This design uses **angular clip-paths** instead of border-radius. All containers and cards have sharp 0px corners.

| Context          | Shape                                                                              |
| ---------------- | ---------------------------------------------------------------------------------- |
| Cards/Containers | 0px (sharp corners)                                                                |
| Diamond icon     | `clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`                          |
| Button Primary   | `clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)` |
| Hero Tag         | `clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)` |
| Logo Icon        | Diamond clip-path, 36px                                                            |
| Dots/Circles     | 50% (border-radius)                                                                |

## Shadows

| Name              | Value                                            |
| ----------------- | ------------------------------------------------ |
| Button Hover Glow | `0 8px 32px rgba(239, 68, 68, 0.4)`             |
| Status Pulse      | `0 0 0 0 rgba(34, 197, 94, 0.4)` → `0 0 0 8px rgba(34, 197, 94, 0)` (animated) |

**Note**: This design relies on borders and clip-paths rather than box-shadows for depth. Elevation is achieved through background color layering (`--bg` → `--surface` → `--surface-elevated`).

## Motion

| Property                    | Value                                 |
| --------------------------- | ------------------------------------- |
| Easing (soft/decelerate)    | `cubic-bezier(0.16, 1, 0.3, 1)`      |
| Easing (bounce/overshoot)   | `cubic-bezier(0.34, 1.56, 0.64, 1)`  |
| Easing (keyframes)          | `ease-in-out`                         |
| Base transition             | 0.3s                                  |
| Card hover duration         | 0.4s                                  |
| Nav enter duration          | 0.6s                                  |
| Content enter duration      | 0.8s                                  |
| Scroll reveal duration      | 0.8s                                  |
| Stagger delay               | 0.1s                                  |
| Nav enter delay             | 0.1s                                  |
| Hero content enter delay    | 0.3s                                  |
| Hero visual enter delay     | 0.5s                                  |
| Grid pulse cycle            | 4s                                    |
| Orb float cycle             | 8s                                    |
| Logo pulse cycle            | 2s                                    |
| Status pulse cycle          | 2s                                    |
| Tag indicator pulse         | 1.5s                                  |
| Typing indicator cycle      | 1.4s                                  |

## Effects

**Background Grid**:

- Pattern: 1px lines at 60px intervals (horizontal + vertical)
- Color: `#27272a` (border color)
- Position: fixed, full viewport
- Animation: opacity pulses between 0.2 and 0.4 over 4s

**Gradient Orb**:

- Size: 600px × 600px
- Color: radial gradient from `rgba(239, 68, 68, 0.4)` to transparent at 70%
- Blur: 80px
- Position: fixed, top-right (offset -200px both axes)
- Animation: drifts 50px diagonally and scales to 1.1 over 8s

**Accent Top Lines**:

- Feature cards: 2px red line at top, scales from 0 to full width on hover
- Chat interface: 3px gradient line at top (accent → glow → accent)

---

## Component Patterns

Reusable patterns that define how components should look, regardless of page structure.

### Icon Approach

- **Type**: SVG icons
- **Container**: 48px × 48px, accent background (`#ef4444`), diamond clip-path
- **Icon color**: Background color (`#0a0a0c`) — creates knockout effect
- **Icon size**: 24px × 24px within container

### Navigation

- **Position**: Static, top of page
- **Style**: Transparent background, bottom border (`1px solid #27272a`)
- **Layout**: Flex, space-between
- **Logo**: Bebas Neue 28px, 0.1em spacing, with 36px diamond icon (accent fill, pulsing)
- **Links**: DM Sans 14px/500, uppercase, 0.05em spacing, muted color, 40px gap
- **Link hover**: Color transitions to text white, 2px accent underline animates width 0→100%
- **Enter animation**: Slides down 20px, fades in over 0.6s with soft easing

### Card: Feature

- **Use for**: Feature highlights, capability descriptions
- **Background**: `#151518` (surface)
- **Border**: 1px solid `#27272a`
- **Padding**: 40px
- **Corner radius**: 0px (sharp angular)
- **Structure**: Diamond icon container → Title (Bebas Neue 24px) → Description (DM Sans 14px, muted)
- **Top accent line**: 2px `#ef4444`, hidden by default (scaleX(0)), animates to full width on hover
- **Hover**: translateY(-8px) with bounce easing (0.4s), border-color changes to `#71717a`

### Card: Chat Interface (Hero)

- **Use for**: Interactive demo/preview in hero section
- **Background**: `#151518` (surface)
- **Border**: 1px solid `#27272a`
- **Padding**: 24px
- **Top accent**: 3px gradient bar (accent → glow → accent)
- **Header**: Bebas Neue title + status indicator (green pulsing dot + small text)
- **Messages**: User messages have left accent border + elevated background; AI messages have border + dark background
- **Input**: Dark background, bordered, accent border on focus

### Button: Primary

- **Background**: `#ef4444` (accent)
- **Text**: `#0a0a0c` (background), 14px/700, uppercase, 0.05em spacing
- **Padding**: 16px 32px
- **Shape**: Angular diamond clip-path (pointed left and right edges, 12px inset)
- **Hover**: translateY(-2px), glow shadow `0 8px 32px rgba(239, 68, 68, 0.4)`, 0.3s bounce easing

### Button: Secondary

- **Background**: transparent
- **Border**: 1px solid `#27272a`
- **Text**: `#f4f4f5`, 14px/500, uppercase, 0.05em spacing
- **Padding**: 16px 32px
- **Hover**: Background fills to `#151518`, border-color changes to `#71717a`, 0.3s ease

### Badge: Hero Tag

- **Shape**: Angular clip-path (pointed right edge, 12px inset)
- **Background**: `#151518` (surface) with 1px border
- **Text**: 12px/500, uppercase, 0.1em spacing, muted color
- **Indicator**: 8px diamond shape in accent red, pulses opacity 1→0.5 over 1.5s
- **Layout**: Inline-flex, 8px gap, 8px 16px padding

### Section Header

- **Pattern**: Tag label → H2 title
- **Alignment**: Centered
- **Tag**: 12px/500, uppercase, 0.2em spacing, accent color, 16px margin-bottom
- **Title**: Bebas Neue 56px
- **Spacing**: 80px margin-bottom to content

### Scroll Reveal

- **Initial state**: opacity 0, translateY(40px)
- **Revealed state**: opacity 1, translateY(0)
- **Duration**: 0.8s with soft easing
- **Stagger**: 0.1s between siblings (1st: 0.1s, 2nd: 0.2s, 3rd: 0.3s)
- **Trigger**: IntersectionObserver at 10% threshold

### Status Indicator

- **Dot**: 8px circle, `#22c55e` green
- **Pulse**: Box-shadow expands from 0 to 8px and fades over 2s
- **Text**: 12px, muted color

### Typing Indicator

- **Dots**: 3 × 6px circles, muted color
- **Animation**: Each dot bounces up 6px, 1.4s cycle
- **Stagger**: 0.2s between dots

---

## Interactive States

| Component        | Trigger | Property     | From            | To                                  | Duration | Easing  |
| ---------------- | ------- | ------------ | --------------- | ----------------------------------- | -------- | ------- |
| Feature Card     | hover   | transform    | none            | translateY(-8px)                    | 0.4s     | bounce  |
| Feature Card     | hover   | border-color | `#27272a`       | `#71717a`                           | 0.3s     | ease    |
| Feature Card     | hover   | top line     | scaleX(0)       | scaleX(1)                           | 0.4s     | soft    |
| Button Primary   | hover   | transform    | none            | translateY(-2px)                    | 0.3s     | bounce  |
| Button Primary   | hover   | box-shadow   | none            | 0 8px 32px rgba(239,68,68,0.4)      | 0.3s     | ease    |
| Button Secondary | hover   | background   | transparent     | `#151518`                           | 0.3s     | ease    |
| Button Secondary | hover   | border-color | `#27272a`       | `#71717a`                           | 0.3s     | ease    |
| Nav Link         | hover   | color        | `#71717a`       | `#f4f4f5`                           | 0.3s     | ease    |
| Nav Link         | hover   | underline    | width 0         | width 100%                          | 0.3s     | bounce  |
| Chat Input       | focus   | border-color | `#27272a`       | `#ef4444`                           | 0.3s     | ease    |
| Chat Send Button | hover   | transform    | scale(1)        | scale(1.05)                         | 0.3s     | bounce  |

---

## Character

- **Theme**: Dark
- **Shape**: Angular (diamond clip-paths, 0px radii, sharp edges throughout)
- **Density**: Spacious (120px section padding, 80px header margins, 40px card padding)
- **Energy**: Dynamic (pulsing grid, floating orb, bouncing hover animations, typing dots)

---

## Token Reference

Quick reference for implementation.

### Colors
```
color-bg: #0a0a0c
color-surface: #151518
color-surface-elevated: #1d1d22
color-text: #f4f4f5
color-text-muted: #71717a
color-accent: #ef4444
color-accent-glow: rgba(239, 68, 68, 0.4)
color-border: #27272a
color-status-green: #22c55e
```

### Typography
```
font-display: "Bebas Neue", sans-serif
font-body: "DM Sans", sans-serif
font-weight-regular: 400
font-weight-medium: 500
font-weight-bold: 700
```

### Spacing
```
space-section: 120px
space-hero-top: 120px
space-hero-bottom: 80px
space-section-header-mb: 80px
space-card-lg: 40px
space-card-sm: 24px
space-grid: 24px
space-cta: 16px
space-tight: 8px
space-container: 40px
```

### Shape
```
radius-all: 0px
clip-diamond: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)
clip-btn-primary: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)
clip-tag: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)
```

### Motion
```
ease-soft: cubic-bezier(0.16, 1, 0.3, 1)
ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)
duration-base: 0.3s
duration-card: 0.4s
duration-enter: 0.8s
duration-nav-enter: 0.6s
stagger: 0.1s
```

---

_Generated from: `docs/design/style_1_obsidian_pulse.html`_
