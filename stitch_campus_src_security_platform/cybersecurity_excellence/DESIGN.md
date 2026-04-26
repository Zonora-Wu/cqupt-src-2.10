---
name: CyberSentinel Dark
colors:
  surface: '#111411'
  surface-dim: '#111411'
  surface-bright: '#373a36'
  surface-container-lowest: '#0c0f0c'
  surface-container-low: '#191c19'
  surface-container: '#1d201d'
  surface-container-high: '#272b27'
  surface-container-highest: '#323631'
  on-surface: '#e1e3dd'
  on-surface-variant: '#c0c9bd'
  inverse-surface: '#e1e3dd'
  inverse-on-surface: '#2e312d'
  outline: '#8a9389'
  outline-variant: '#414940'
  surface-tint: '#97d59e'
  primary: '#97d59e'
  on-primary: '#003916'
  primary-container: '#2a6438'
  on-primary-container: '#a0dea7'
  inverse-primary: '#306a3d'
  secondary: '#bfc6db'
  on-secondary: '#293041'
  secondary-container: '#42495a'
  on-secondary-container: '#b1b8cd'
  tertiary: '#ffb1c0'
  on-tertiary: '#571b2c'
  tertiary-container: '#894253'
  on-tertiary-container: '#ffbeca'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b2f2b9'
  primary-fixed-dim: '#97d59e'
  on-primary-fixed: '#00210a'
  on-primary-fixed-variant: '#155127'
  secondary-fixed: '#dbe2f8'
  secondary-fixed-dim: '#bfc6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#ffd9df'
  tertiary-fixed-dim: '#ffb1c0'
  on-tertiary-fixed: '#3c0517'
  on-tertiary-fixed-variant: '#733142'
  background: '#111411'
  on-background: '#e1e3dd'
  surface-variant: '#323631'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  mono:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  container-max: 1200px
  gutter: 24px
  xs: 4px
  sm: 12px
  base: 8px
  md: 24px
  lg: 48px
  xl: 80px
---

## Brand & Style

The brand identity is rooted in the "Cyber-Security" aesthetic—technical, authoritative, yet approachable for a student audience. The style is a hybrid of **Glassmorphism** and **Modern Dark Mode**, utilizing deep emerald greens and slate grays to evoke a "terminal" or "command center" feel. 

The visual narrative relies on ambient glowing elements (radial gradients) and semi-transparent layers to create a sense of depth and digital sophistication. It aims to feel high-tech, secure, and prestigious, particularly through the use of subtle motion (pulses) and high-quality iconography.

## Colors
The palette is dominated by a rich "Obsidian Green" background (`#0F1511`). The primary action color is a deep Forest Green (`#2A6438`), used for high-emphasis buttons and brand elements. 

Secondary elements utilize Slate Grays to maintain hierarchy without competing for attention. A vibrant Mint Green (`#4ADE80`) is reserved for status indicators, active links, and "glow" effects to signify vitality and security. The interface relies heavily on alpha-transparency for borders and backgrounds to create a layered, "glassy" appearance over the dark base.

## Typography
The system uses **Inter** as the primary workhorse font for its readability and modern, neutral profile across headlines and body text. To inject a technical, futuristic edge, **Space Grotesk** is used for monospaced data, labels, and "code-like" UI elements. 

Headlines utilize tight line-heights and negative letter-spacing for a bold, editorial impact. Body text maintains generous line-height (1.6) to ensure comfort during long reading sessions of technical documentation or platform rules.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for core content, centered with a maximum width of 1200px to ensure readability on large displays. Navigation and footers extend to 1440px or full-width to ground the layout.

Spacing follows an 8px modular scale. Hero sections use significant vertical padding (80px to 128px) to create an expansive, premium feel. Content blocks are separated by defined borders or subtle shifts in background tone to maintain clear information architecture.

## Elevation & Depth
Depth is achieved through **Glassmorphism** and **Ambient Light**. Surfaces do not use traditional shadows; instead, they use:
1.  **Backdrop Blurs:** 20px blurs on semi-transparent containers.
2.  **Inner Glows/Borders:** 1px white borders at 5-10% opacity to define edges against the dark background.
3.  **Color Halos:** Large, soft radial gradients (Emerald/Green) positioned behind key content areas to suggest a light source from "behind" the screen.
4.  **Shadow Halos:** Buttons use colored drop shadows (e.g., green shadows on green buttons) to simulate luminescence.

## Shapes
The design utilizes a **Pill-shaped** and **Large-radius** language. While standard buttons and tags are fully rounded (pill), containers and cards use a refined `1.5rem` (24px) radius to feel modern and friendly. This high roundedness offsets the "hard" nature of cybersecurity themes, making the platform feel accessible to students.

## Components

### Buttons
- **Primary:** Solid `#2A6438`, fully rounded, with a subtle outer glow of the same color. Text is white, medium weight.
- **Secondary/Ghost:** Transparent background with a `1px` border of `rgba(255,255,255,0.1)`. Hovers introduce a subtle white overlay (5%).

### Cards (Glass Panels)
Cards use the `glass-panel` class: `rgba(255, 255, 255, 0.03)` background, `20px` backdrop blur, and a thin, low-contrast border. Group hover effects should slightly brighten the background or increase border opacity.

### Inputs
Search and text inputs are integrated into the glass panels. They feature monospaced placeholder text and no visible border until focused, where they gain a subtle primary color ring or shadow.

### Status Chips
Small, fully rounded tags using a 10% opacity background of their semantic color (e.g., Green for "Live") with a pulsing dot indicator for real-time status.

### Iconography
Material Symbols (Outlined) are used throughout, often encased in circular containers with low-opacity background tints to denote different categories (Security = Green, Learning = Blue, etc.).