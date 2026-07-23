# Design — Derit Admin

A locked design system for Derit admin pages. Every page redesign reads this file before emitting code.

## Genre
**modern-minimal** — Stripe/Linear school: Inter throughout, generous whitespace, pill CTAs, monochrome with restrained accent.

## Paper & Ink
- `--color-paper: oklch(0.985 0 0)` — pure white canvas
- `--color-paper-2: oklch(0.98 0.005 30)` — warm grey for subtle backgrounds
- `--color-ink: oklch(0.145 0.005 25)` — near-black text
- `--color-ink-2: oklch(0.55 0.005 25)` — secondary text
- `--color-rule: oklch(0.91 0 0)` — hairline borders
- `--color-accent: oklch(0.52 0.18 258)` — brand blue (kept from existing)
- `--color-accent-ink: oklch(0.985 0 0)` — white on accent
- `--color-focus: oklch(0.52 0.18 258 / 0.4)` — focus ring

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
- Modals: centered with backdrop blur

## What Pages Share
- The sidebar design (light theme)
- Accent color placement
- Card styling and radius
- Table patterns
- Button styles
