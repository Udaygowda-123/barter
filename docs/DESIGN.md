# SWAPD design system

Tokens live in `src/app/globals.css` (`@theme`). Use the Tailwind names below — never raw hex in components.

## Type
| Role | Face | Usage |
|---|---|---|
| Display | Bricolage Grotesque 500/700/800 (`font-display`, automatic on `h1`/`h2`) | Page titles, section heads, big numbers |
| Accent | Instrument Serif italic (`<em class="accent">`) | One expressive word per heading, max. Never body copy |
| UI / body | Geist Sans | Everything else |

Fonts load through `next/font` (self-hosted at build, `display: swap`).

## Colour rules
| Token | Hex | Meaning — use it for |
|---|---|---|
| `paper` | #FAF8F5 | Page background (ivory) |
| `ink` | #17151E | Text, primary dark surfaces, active nav |
| `night` | #100E16 | Immersive dark sections (hero, auth panel) |
| `coral` | #FF765E | **Primary action** and key moments (CTA, swap icon, unread count). Always ink text — white on coral fails AA |
| `cobalt-ink` / `cobalt` | #3D4FE8 / #5267FF | **Needs your attention**: "Your turn", focus ring, unread markers, accent words on light backgrounds. `cobalt-ink` for text/solid fills with white text; `cobalt` only decorative/borders |
| `lilac` / `violet` | #F3E9FF / #CDB8FF | Discovery & creative surfaces; `violet` is the accent word colour on dark backgrounds and the focus ring inside `.on-ink` |
| `mint` | #D8F4DF | Success / agreed (deals, accepted, verified) |
| `butter` | #FFF1C9 | Pending / caution / safety notes |
| `danger` | #B42318 | Destructive and errors only |

Rules of thumb
- One coral primary action per view. Secondary actions use `outline`, `soft` or `ghost`.
- Cobalt is reserved for "you need to act" — don't use it decoratively in lists.
- Status is never colour-only: badges always carry a text label.
- On dark surfaces add `on-ink` so focus rings switch to violet.

## Motion
- CSS first (`.rise`, `.underline-draw`, dialog `anim-*`, `.heart-pop`, orbit). framer-motion only where gestures need it (swipe deck).
- Everything is disabled by the global `prefers-reduced-motion` rule; the hero video and orbit pointer-tilt also opt out in JS.
- Durations: 160–320 ms for UI feedback, ≤ 700 ms for entrances. No looping motion inside the app shell.

## Media
- Hero video: `public/video/hero.{webm,mp4}` + `hero-poster.webp`, built from the openly licensed demo photos (`scripts/demo-photos/credits.json`). Attached after idle, skipped for reduced motion / Save-Data / 2G, paused off-screen. The poster is the LCP image and the fallback.
- 3D: `SwapOrbit` is pure CSS 3D (no WebGL dependency); static under reduced motion.

## Components
- `EmptyState art="swap|inbox|chat|search|heart|bell|box|deal"` — inline SVG illustrations, no network cost.
- `Badge tone="cobalt"` — "Your turn". `Button variant="light"` — secondary action on dark media.
