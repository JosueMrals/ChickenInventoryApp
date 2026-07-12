---
name: ChickenInventoryApp
description: Inventory, sales, and delivery-route management for a chicken distribution business
colors:
  field-blue: "#007AFF"
  success-green: "#34C759"
  danger-red: "#FF3B30"
  accent-purple: "#5856D6"
  ink: "#1A1A1A"
  body-text: "#333333"
  muted-text: "#8E8E93"
  faint-text: "#999999"
  surface: "#FFFFFF"
  app-bg: "#F5F6FA"
  dashboard-bg: "#F0F4F8"
  divider: "#EEEEEE"
  border: "#E0E0E0"
  shadow-ink: "#0A2540"
typography:
  title:
    fontFamily: "System (Roboto on Android)"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: "normal"
  sectionTitle:
    fontFamily: "System (Roboto on Android)"
    fontSize: "15px"
    fontWeight: 700
  statValue:
    fontFamily: "System (Roboto on Android)"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: "20px"
  body:
    fontFamily: "System (Roboto on Android)"
    fontSize: "14px"
    fontWeight: 600
  label:
    fontFamily: "System (Roboto on Android)"
    fontSize: "11px"
    fontWeight: 500
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "30px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "16px"
  lg: "20px"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "10px"
  card-header:
    backgroundColor: "{colors.field-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "50px 16px 10px"
  button-primary:
    backgroundColor: "{colors.field-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "14px 16px"
  button-success:
    backgroundColor: "{colors.success-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  button-danger:
    backgroundColor: "{colors.danger-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
---

# Design System: ChickenInventoryApp

## 1. Overview

**Creative North Star: "The Field Blue System"**

This is an operational tool, not a showcase: staff record sales, restock inventory, and close delivery routes on it, often one-handed, sometimes outdoors, sometimes at a warehouse counter. The system reads as clean and trustworthy — a single confident operational blue (`#007AFF`) anchors every screen (headers, primary actions, active states), sitting on white cards over a quiet light gray-blue canvas. There is no custom typeface; the system leans on the platform's own Roboto stack, weighted heavily (700-800) at the top of the hierarchy so numbers and titles stay legible at a glance. Depth is conveyed through one soft, barely-there shadow rather than layered elevation — the app is deliberately flat and calm, not skeuomorphic or glossy.

This system explicitly rejects decoration for its own sake: no gradients, no glassmorphism, no ornamental color beyond the functional palette (blue for primary action, green for success/paid, red for danger/error). Every color has a job.

**Key Characteristics:**
- One dominant accent (`#007AFF`) carries primary actions and identity across all modules — headers, FABs, active tabs, primary buttons.
- White cards (`16px` radius) float on a light gray-blue app background with one soft, consistent shadow recipe.
- Type is system-default (Roboto), leaning bold (700-800) for numbers/titles and medium (500-600) for body/labels — no custom font stack.
- Semantic color is functional only: green = success/paid, red = danger/error/delete, purple = a secondary/rare accent.
- Pill-shaped (`30px` radius) primary action buttons and FABs; smaller `8-12px` radii for cards, inputs, and icon containers.

## 2. Colors

Restrained and functional: one primary accent, a tight semantic set (success/danger), and a neutral scale that does most of the work.

### Primary
- **Field Blue** (`#007AFF`): the app's one identity color. Used for screen headers, primary buttons, active/selected states, FABs, and icon containers. Appears in 29+ style files — it is the single most-used color in the app by design, not accident.

### Secondary
- **Signal Purple** (`#5856D6`): rare secondary accent for specific highlighted states (used sparingly, far below Field Blue's frequency). Treat as an exception color, not a second primary.

### Tertiary
- **Success Green** (`#34C759` / `#10B981`) and **Danger Red** (`#FF3B30` / `#EF4444`): semantic-only. Green marks paid/success/positive states; red marks delete/error/negative states. Never used decoratively.

### Neutral
- **Pure Surface** (`#FFFFFF`): card and sheet backgrounds.
- **App Canvas** (`#F5F6FA` / `#F0F4F8`): screen background behind cards — a barely-tinted cool gray, not pure white.
- **Deep Ink** (`#1A1A1A`): primary text on light surfaces (titles, values).
- **Body Gray** (`#333333`): secondary body text.
- **Muted Gray** (`#8E8E93` / `#999999`): captions, labels, timestamps, footer text.
- **Hairline** (`#EEEEEE` / `#E0E0E0`): dividers and card borders.
- **Shadow Ink** (`#0A2540`): the color shadows are tinted from, not black — gives the soft shadow a cool, deep-blue cast instead of a muddy gray.

### Named Rules
**The One Accent Rule.** Field Blue (`#007AFF`) is the only color that means "this is the primary action or the app's identity." If a new component needs an accent, reach for Field Blue before introducing a new hue.

## 3. Typography

**Body Font:** System default (Roboto on Android, no custom font loaded)
**Character:** No display/body pairing — a single system sans carries the whole hierarchy through weight and size alone. Numbers and titles go heavy (700-800); supporting text stays medium (500-600). This keeps the app legible at a glance for field use without the overhead of custom font loading.

### Hierarchy
- **Title** (800, 22px): screen header titles, in white on the Field Blue header band.
- **Section Title** (700, 15px): section headers within a screen (e.g. dashboard "Modules", "Stats").
- **Stat Value** (800, 16px, 20px line-height): the primary number on a stat card — the thing the user scans for first.
- **Body / Label-strong** (600, 14px): card labels, module names, primary readable content.
- **Label** (500, 11px): stat captions, footer text, secondary metadata.

### Named Rules
**The Weight-Over-Family Rule.** Hierarchy is built with font-weight and size on one system font, never a second typeface. Don't introduce a display font for emphasis — go heavier or bigger on the existing stack.

## 4. Elevation

Flat by default, with one soft, consistent shadow used everywhere a surface needs to lift off the canvas — no elevation tiers. The shadow is deliberately faint (`0.05` opacity) and blue-tinted (`#0A2540`, not black), so cards read as gently raised rather than dramatically floating.

### Shadow Vocabulary
- **Card Lift** (`shadowColor: #0A2540, shadowOffset: {0, 2}, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2`): the one elevation token in the system. Used on stat cards, module cards, and other floating surfaces uniformly.

### Named Rules
**The One Shadow Rule.** Every elevated surface uses the exact same shadow recipe. Don't invent a second, heavier shadow for "more important" cards — importance is carried by content and color, not by shadow depth.

## 5. Components

### Buttons
- **Shape:** Primary actions and FABs are pill-shaped (`30px` radius). Secondary/inline buttons use `8-12px` radius.
- **Primary:** Field Blue (`#007AFF`) background, white text, `14px` vertical / `16px` horizontal padding.
- **Success / Danger:** Same shape family, background swapped to Success Green or Danger Red for confirm/destructive actions respectively.
- **Focus / Pressed:** standard RN touch feedback (opacity/ripple); no custom hover states apply on Android.

### Cards / Containers
- **Corner Style:** `16px` radius (stat cards, module cards); `12px` for smaller nested containers.
- **Background:** Pure white (`#FFFFFF`) surface on the app's tinted gray-blue canvas.
- **Shadow Strategy:** Card Lift (see Elevation) — always, uniformly.
- **Border:** None on cards; hairline (`#EEEEEE`/`#E0E0E0`) reserved for list dividers and input borders.
- **Internal Padding:** `10px` for stat cards, `20px` vertical / `8px` horizontal for module cards.

### Inputs / Fields
- **Style:** bordered (`borderWidth: 2` where emphasized, e.g. quantity steppers), Field Blue border on focus/active state, `8-12px` radius.
- **Error:** switches border/text to Danger Red.

### Navigation / Header
- **Style:** Field Blue full-width header band, white bold (800) title text, `14px` bottom-corner radius, sits flush at the top of the screen.

### Stat Card (signature component)
The dashboard's primary at-a-glance unit: an icon container + a bold value + a muted label, in a horizontal row inside a Card Lift surface. This pattern (icon, big number, small caption) repeats across reports and warehouse summaries — treat it as the canonical "glanceable metric" component for the app.

## 6. Do's and Don'ts

### Do:
- **Do** use Field Blue (`#007AFF`) for the single primary action or identity element per screen.
- **Do** use the Card Lift shadow (`#0A2540` @ 0.05 opacity) for every elevated surface, uniformly.
- **Do** keep hierarchy in weight and size on the system font — 800/700 for titles and numbers, 500/600 for body and labels.
- **Do** reserve green/red strictly for success/paid and danger/error/delete states.
- **Do** keep primary buttons and FABs pill-shaped (`30px` radius) for easy one-handed tapping in the field.

### Don't:
- **Don't** add gradients, glassmorphism, or decorative blur — this system is flat and functional, not a showcase.
- **Don't** introduce a second display typeface; go heavier/bigger on the existing system font instead.
- **Don't** invent a second shadow tier "for emphasis" — the One Shadow Rule means importance comes from content, not depth.
- **Don't** use green or red decoratively outside their success/danger meaning.
- **Don't** trade legibility for polish — low-contrast grays or dense unlabeled icon rows work against the field/warehouse mixed-use context this app runs in.
