# DESIGN.md — "Press Room"

The visual system for the Guitar Frames builder, ported from Violin Tab Writer.
Concept: **an Andy Warhol screenprint shop**. The app is a printing press; each
chord frame, scale diagram, and tab staff is the proof coming off it. Loud
CMYK-ish inks and silkscreen devices wrap the chrome, while the **diagrams
themselves stay user-coloured on white stock** so they never lose legibility (and
so exports stay clean).

Implemented in `src/styles/globals.css` (tokens + chrome) and
`src/pages/index.astro` (poster header, colour bar, registration marks, footer).
Repurposing the Tailwind design tokens means existing utility classes adopt the
palette automatically.

---

## 1. Principles

1. **The proof is sacred.** The chord/scale/tab SVG is what gets exported
   (SVG/PNG/PDF). Its colours are user-controlled (note dots, fonts) and are
   **untouched by the theme**. All theme colour lives in the chrome *around* it.
2. **Flat ink, hard edges.** No soft gradients on UI surfaces, no blur. Color is
   applied as flat fills with solid `--ink` borders and **hard offset shadows**
   (the screenprint "misregistration" look). Atmosphere-only gradients are
   allowed in the far background.
3. **Bold, not busy.** A dominant cream field, a few saturated inks used as
   accents, and one fat display voice. Repetition and registration marks supply
   the "print shop," not clutter.
4. **Everything is a printed object.** Cards are silkscreen panels, the editor is
   a manuscript, the preview is a pinned proof, labels are press tape.

---

## 2. Color — the ink swatches

All defined as CSS variables in `:root`.

| Token | Hex | Role |
|-------|-----|------|
| `--paper` | `#f6efda` | Page stock (warm cream) |
| `--ink` | `#17120d` | Near-black; all borders, text, shadows |
| `--pop-pink` | `#ff2e88` | Magenta — primary accent |
| `--pop-cyan` | `#10c4d8` | Cyan |
| `--pop-yellow` | `#ffc20a` | Marigold |
| `--pop-orange` | `#ff5a1f` | Tangerine |
| `--pop-violet` | `#6c4ce0` | Grape |
| `--pop-green` | `#1bb36a` | Go-green |

**Design-token mapping** (so Tailwind `bg-*`/`border-*`/`text-*` inherit the look):

```
--background → --paper      --primary → --pop-pink   --border → --ink
--foreground → --ink        --primary-foreground → #fffdf4
--card → #fffdf4            --muted → #ece3c8         --ring → --pop-cyan
--card-foreground → --ink   --muted-foreground → #6f6347
```

**Usage rules**
- Pure `--ink` on `--paper`/white for all body text — never colored body copy.
- Pop inks are for *fills and shadows*, not text (exception: white text on a
  saturated chip, e.g. the PDF button and the footer-link hover).
- Each major surface gets **one** assigned ink (see §6), used consistently for
  its shadow and its title dot. Don't mix multiple pops on one element.

---

## 3. Typography

Three UI voices. The diagram fonts (Patrick Hand, Caveat, Shadows Into Light,
Inter, etc.) are **user-selectable for the SVG output** and are not part of the
chrome — leave them alone.

| Voice | Font | Used for |
|-------|------|----------|
| **Display** | `Anton` (400, condensed poster) | Page title, every card title — `UPPERCASE`, letter-spacing `0.03–0.04em` |
| **Body / UI** | `Poppins` (400–800) | Paragraphs, button labels, control values |
| **Label / mono** | `Space Mono` (400/700) | Eyebrow, field labels, help text, errors, footer, JSON dumps, the PROOF stamp — `UPPERCASE`, wide tracking |

Type rules: display is always uppercase and tight; mono labels are always
uppercase with `0.07–0.22em` tracking; body stays sentence case. Never set body
copy in Anton or Space Mono.

---

## 4. The screenprint devices

- **Misregistration title.** The H1 is cream fill + `-webkit-text-stroke: 2.5px ink`
  with two layered hard shadows offset diagonally:
  `text-shadow: 7px 7px 0 var(--pop-cyan), 14px 14px 0 var(--pop-pink);`
- **Hard offset shadows.** The house shadow is `Npx Npx 0` (zero blur) in `--ink`
  or a pop ink. Scale by element: cards `8px`, textarea `5px`, buttons `3px`,
  tape/chips `2–4px`.
- **Halftone stock.** Body background is a dot grid:
  `radial-gradient(circle, rgba(23,18,13,0.07) 22%, transparent 23%)` at `15px 15px`.
- **Atmospheric blooms.** `body::before` paints three soft corner radials
  (yellow/cyan/pink via `color-mix`) — the *only* place gradients are allowed.
- **Registration marks.** Four fixed corner crosshair-in-circle marks
  (`.reg-mark`), `0.7` opacity.
- **Printer's color bar.** `.ink-swatches` — a bordered row of all seven inks
  under the title.
- **PROOF stamp.** A rotated magenta tape label pinned to every `.preview-card`
  (`.preview-card::after`).
- **Flying-V favicon** (`public/favicon.svg`) — the guitar drawn twice: a pink
  offset behind the ink, the same misregistration trick as the title.

---

## 5. Motion

Restrained and physical — buttons behave like real keys, nothing floats.

- Buttons/links: `transform` + `box-shadow` transitions at `0.08s ease`.
- **Hover:** lift `translate(-1px,-1px)`, shadow grows by 1px.
- **Active:** press `translate(3px,3px)`, shadow collapses to `0`.
- Tape/eyebrow and the PROOF stamp sit at a fixed `~2.5°` rotation (static).
- No entrance animations, parallax, or looping motion.

---

## 6. Components

This app is **tabbed** (Chord / Scale / Tab), so it has more cards than the
violin app. Inks are assigned by *role* so a card type reads the same across all
three modes:

| Role | Cards | Ink |
|------|-------|-----|
| Setup / instrument | `.tab-setup-card`, `.instrument-card` | cyan |
| Editor | `.frame-editor-card`, `.dots-editor-card`, `.tab-editor-card` | orange |
| Generator / preset | `.scale-generator-card`, `.preset-card` | green |
| Look & style | `.look-feel-card`, `.text-style-card` | pink |
| Settings / JSON | `.settings-card`, `.json-card`, `.tab-json-card` | violet |
| Preview | `.preview-card` | yellow |

**Cards** (`.card`) — silkscreen panels: `--card` fill, `3px` ink border, radius
`14px`, `8px 8px 0` shadow in the card's ink. **Card titles** — Anton uppercase,
preceded by a bordered ink dot (`.card-title::before`) in the card's color.

**Buttons** (`.btn`) — `2.5px` ink border, radius `9px`, `3px 3px 0` ink shadow,
press animation. Action buttons carry a fixed ink:

| Button | Ink |
|--------|-----|
| Play | green · Stop | orange |
| SVG | cyan · PNG | yellow · PDF | pink |
| Copy code | cyan · Load code | yellow |

Full-width disclosure toggles (`.json-toggle`, `.tab-json-toggle`,
`.look-feel-toggle`) opt out of the chip shadow so they read as panel headers.

State toggles (mode tabs, Beams, Note names, etc.) use the Tailwind `default`
variant when **on** (pink fill) and `outline` when **off** (cream + ink border).

**Form fields** (`.input`, `.select`) — white plates, `2px` ink border, cyan
offset shadow on focus. **Labels** are Space Mono uppercase micro-caps.

**Tab editor** (`.tab-editor-textarea`) — white manuscript, `3px` ink border,
Space Mono, `5px 5px 0` cyan shadow (→ pink on focus). Help tokens (`.tab-help
code`) are yellow chips; errors (`.tab-errors`) are bold tangerine.

**JSON dumps** (`.frame-json`, `.chord-json`, `.tab-json`) — white plates, Space
Mono, `2px` ink border.

**Footer link** (`.footer-link`) — yellow pop chip; hover flips to magenta with
white text.

---

## 7. Spacing & shape

- Radius scale from `--radius: 0.7rem` (chips ~`5–9px`, cards `14px`).
- Border weights: hairline rules `2px`, cards/editor `3px`, buttons `2.5px`.
- Generous page padding (`px-6 py-16`), `max-w-7xl` column, `gap-6` between cards.

---

## 8. Adding new UI — checklist

1. Give it an `--ink` border and a hard offset shadow (ink, or the section's pop).
2. Pick the **role ink** from §6 if it needs accent; reuse the parent surface's ink.
3. Titles → Anton uppercase; labels → Space Mono uppercase; copy → Poppins.
4. Interactive? Add the lift/press shadow transition (use the `.btn` class).
5. Never put theme color inside the diagram SVG — keep proofs user-coloured on white.
