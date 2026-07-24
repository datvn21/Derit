# Design — Derit Admin

A locked design system for Derit admin pages. Every page redesign reads this file before emitting code.

## Genre
**modern-minimal** — Stripe/Linear school: Inter throughout, generous whitespace, pill CTAs, monochrome with restrained accent.

## Paper & Ink
- `--background: oklch(0.985 0 0)` → `bg-background` — pure white canvas
- `--card: oklch(1 0 0)` → `bg-card` — content surface, slightly brighter than canvas
- `--popover: oklch(1 0 0)` → `bg-popover` — floating surface (Popover, Tooltip, Select)
- `--overlay: oklch(0.145 0.005 25 / 0.5)` → `bg-overlay` — modal/sheet scrim
- `--foreground: oklch(0.145 0.005 25)` → `text-foreground` — primary text
- `--muted-foreground: oklch(0.556 0 0)` → `text-muted-foreground` — secondary text
- `--muted: oklch(0.97 0 0)` → `bg-muted` — subtle bg (table headers, skeleton, inline chips)
- `--accent: oklch(0.97 0 0)` → `bg-accent` — quiet callout surface
- `--border: oklch(0.922 0 0)` → `border-border` — hairline between cards and surfaces
- `--rule: oklch(0.91 0 0)` — internal gridlines (tables, dividers)
- `--color-accent: oklch(0.52 0.18 258)` → `bg-primary` / `text-primary` — brand blue
- `--color-accent-ink: oklch(0.985 0 0)` — white on accent
- `--color-focus: oklch(0.52 0.18 258 / 0.4)` — focus ring
- `--destructive: oklch(0.577 0.245 27.325)` → `bg-destructive` / `text-destructive` — red
- `--success: oklch(0.52 0.13 155)` → `bg-success` / `text-success` — green
- `--warning: oklch(0.62 0.14 75)` → `bg-warning` / `text-warning` — amber

## Status Badge Variants
Status pills render exclusively through the `<Badge>` primitive. Variants in `apps/web/app/components/ui/badge.tsx`:
- `default` — neutral: `bg-muted text-muted-foreground border-border`
- `info` — blue: `bg-primary/10 text-primary border-primary/30`
- `success` — green: `bg-success/10 text-success border-success/30`
- `warning` — amber: `bg-warning/15 text-warning border-warning/30`
- `destructive` — red: `bg-destructive/10 text-destructive border-destructive/30`

## Sidebar Theme (light)
- `--color-sidebar: oklch(0.985 0 0)` — white background
- `--color-sidebar-foreground: oklch(0.145 0.005 25)`
- `--color-sidebar-accent: oklch(0.52 0.18 258 / 0.1)` — blue tint
- `--color-sidebar-accent-foreground: oklch(0.52 0.18 258)`
- `--color-sidebar-border: oklch(0.91 0 0)`

## Typography
- Display: Inter 600, tight tracking (-0.02em)
- Body: Inter 400, normal tracking
- Scale: text-sm (14px) base, text-xs for labels

## Spacing
4-point named scale:
- `--space-xs: 0.5rem` — 8px
- `--space-sm: 1rem` — 16px
- `--space-md: 1.5rem` — 24px
- `--space-lg: 2rem` — 32px

## Motion
- Reveal: none (app-page discipline)
- Transitions: 150ms ease-out for hovers
- No bounce/overshoot

## Microinteractions
- Hover: subtle background shift, 150ms
- Focus: 2px solid accent ring
- Buttons: scale(0.98) on active

## CTA Voice
- Primary: filled accent pill
- Secondary: outlined with accent border
- Destructive: red variant for delete actions

## Component Patterns
- Cards: white bg, subtle border, 8px radius
- Tables: clean headers with uppercase labels
- Badges: rounded-full pills with muted backgrounds
- Status pills **must** render via the `<Badge>` primitive — never build an inline pill with `bg-green-50 text-green-700 border-green-200` in a route. If a new state appears, add a new Badge variant.
- Buttons **must** render via the `<Button>` primitive. Never override `bg-primary` / `hover:bg-primary/80` on a Button. Use `<Button variant="destructive">` for red, `variant="default"` for primary, `variant="outline"` for secondary.
- Modals: centered with backdrop blur
- Empty states: `bg-card border border-border rounded-lg p-12 text-center` — never a separate gray block.

## What Pages Share
- The sidebar design (light theme)
- Accent color placement
- Card styling and radius
- Table patterns
- Button styles
- Hairline borders (`border-border`)
- Container surface (`bg-card`)
- Secondary text (`text-muted-foreground`)
- Status pills via `<Badge>` primitive
