# Muse-ing landing page design

The landing page at `/` is a scroll-driven 3D film. A cyber-veteran monkey in a black suit, sunglasses and a smoking cigarette plays a slung guitar in a red studio. As you scroll, the camera moves through five shots. Copy, the list of upcoming gigs and a booking form appear over the scene. A normal page footer follows the film.

The art direction follows a fashion-runway landing reference: low worm's-eye angles, a saturated red studio, and heavy extra-wide uppercase titles that decode in. Everything in the scene is Muse-ing's own: the character, the guitar, the smoke and the copy.

---

## 1. Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, webpack dev). Read `node_modules/next/dist/docs/` before using Next APIs |
| 3D | React Three Fiber, three 0.170, drei (`MeshReflectorMaterial`), `@react-three/postprocessing` (Bloom) |
| Styling | Tailwind CSS v4 plus the landing classes in `app/globals.css` |
| Display font | Archivo with the `wdth` axis, via `next/font/google` (`--font-display`) |
| Icons | `lucide-react` |

The page does not use Framer Motion. All motion comes from one damped scroll value, read every frame.

---

## 2. Page structure

```
<Experience>                         components/monkey/experience.tsx
  <div runway  height: 560vh>        scroll length of the film
    <div sticky h-screen>
      <Stage/>                       WebGL canvas (client only, ssr: false)
      <Overlay/>                     DOM copy, gigs, form and header
      "Sculpting…" loader            fades out once the canvas is ready
  <Footer/>                          normal document flow after the film
```

- **Scroll mapping:** `t = scrollY / (runway height − viewport height)`, clamped to 0..1. `t` is measured over the runway only, so scrolling into the footer doesn't move the film.
- **Damping:** `scroll.target` holds the raw value. `scroll.value` follows it with `damp(…, 4.5)` and is what everything reads.
- **Windows:** `win(t, a, b, c, d)` fades a block in over a→b, holds it, and fades it out over c→d. `smooth(a, b, t)` is a smoothstep.
- **Jumps:** the menu and footer links call `jump(p)`, which smooth-scrolls to film position `p`. For example, `jump(1)` goes to the booking form.
- **Without WebGL:** the canvas isn't mounted and the overlay still works.

---

## 3. The five scenes

| # | Scene label | Scroll `t` | Camera | On screen |
| --- | --- | --- | --- | --- |
| 1 | The grin | 0 – 0.10 | Worm's-eye close-up from under the chin, orbiting slowly | The giant **MUSE-ING** title with **LIVE MUSIC** under it, a hairline and two fine columns |
| 2 | The exhale | 0.13 – 0.29 | Orbits round to a clean side profile while he exhales smoke | "A live music experience" and what Muse-ing does for the crowd, artists and venues |
| 3 | The strut | 0.37 – 0.56 | Shin-high camera looking up as he walks toward you, pushing in to knees-up | "Your night, your call" with the setlist and table copy |
| 4 | The gigs | 0.60 – 0.79 | Drops to floor level; he walks up out of frame | "Upcoming gigs": a row of cards that slides sideways as you scroll |
| 5 | The smash | 0.80 – 1.0 | Swings round to the front | He lifts the guitar by the neck and smashes it into the "glass", which cracks; a white flash; the booking form |

The camera keyframes are `CAMERA_KEYS` in `components/monkey/store.ts`, calibrated for a 28° vertical FOV. Between keys the camera eases with a smoothstep.

**Framing offsets:** these slide the frame sideways using the camera's view offset, without changing perspective.
- On landscape screens, scene 3 frames him right of centre (`walkFraming`), leaving the left side for copy.
- On portrait screens, the scene 2 profile is pulled in from the right edge (`PROFILE_SHIFT = 0.3`).

**Smash timing:** `SMASH` in `store.ts` holds the moments `grab`, `windUp`, `strike`, `crack` and `form`. The monkey, the glass and the overlay all share them.

### Scene 1: the title fold

- **Placement:** **MUSE-ING** is drawn on a canvas texture on a plate behind his head, so it sits in the 3D scene rather than the DOM. It spans 96% of the frame width and sits 9% from the top.
- **Arrival:** the title glitches in letter by letter through block glyphs.
- **Fold:** as you scroll (`t` 0.005–0.05), "ING" slides into the dash, then the dash slides into "MUSE", leaving **M-** where the word began.
- **LIVE MUSIC:** cream (`#f4efe6`), 800 weight expanded, 118px on the 2048px canvas with 26px tracking. It stays put while the title folds.
- **Exit:** the whole plate fades out over `t` 0.06–0.11.

### Scene 4: gigs

- **Data:** up to 24 events from `/api/public/events/search?when=upcoming`, falling back to `when=all` if there are none.
- **Cards:** about 6 visible per row on desktop and about 2.5 (40vw each) on phones, at a 4:5 aspect ratio. Each card shows the date, an index (`01`, `02` …), the title, the artist, the venue and the price ("Free" when 0).
- **Sliding:** while the scene holds, scrolling maps to the row's `scrollLeft`, so every gig passes by. You can still swipe or scroll the row by hand.

### Scene 5: form

- **Inquiry types:** three tabs: Reserve, Host and Join as artist. Submissions POST to `/api/public/events` with `inquiryType`.
- **Reserve extras:** Reserve adds an event picker and a "Direct ticket checkout" link to `/book/[id]`.
- **Card style:** the form sits in a `card-noir` panel over a dark scrim. It appears through a white flash after the glass cracks.

---

## 4. The character

The monkey is built entirely in code in `components/monkey/monkey.tsx`. There are no model files.

| Part | Design |
| --- | --- |
| Proportions | Lanky runway build: `BODY = { head 0.86, torso 1.4, legs 1.7, arms 1.2, width 0.88, hips 1.16 }` relative to the original sculpt. Hands, shoes and the guitar keep their sculpted shape |
| Head | A distance-field sculpt with painted skin: pores, creases and a warm muzzle. Fur shell layers, red-lit visor sunglasses |
| Mouth | A sharp, matte, dark lip slit that the upper lip rolls over. The lips part around the cigarette in the right corner (`CIG_X = 0.3`) |
| Cigarette | Black filter with a red band, paper and a glowing ember. Smoke drifts from the ember, and the exhale comes from the mouth in scene 2 |
| Outfit | A single black suit: coat with a skirt, waistcoat, shirt, red tie and belt. There is no outfit switcher |
| Right arm | A worn veteran cyber arm: graphite armour plates over bare-metal chips, a dark synthetic-muscle core, fibre bundles and visible spinning brass gears |
| Shoes | Polished black calf Oxfords: a tall toe box, toe cap and heel counter seams, a laced throat, a slim welted leather sole and a stacked heel |
| Guitar | Slung in front on a cognac leather strap. The right hand strums by the bridge on the beat; the chrome left hand frets under the neck and changes chord every two strides |

### Motion

- **Walk:** procedural, after the reference.
  - The weight shifts clearly onto each nearly straight standing leg, and the free foot kicks back with the knee bent about 70°.
  - One gait cycle (two steps) takes 1.9 s.
  - It plays over `t` 0.29–0.82 (`walkWeight`).
- **Feet:** each step runs heel strike → flat foot → heel rise → push-off from the ball, then the toes point down through the kick-back and up again to reach for the next step.
- **Floor contact (root motion):** he walks on the spot. The world moves with whichever contact point is on the floor: the heel as he lands, the ball as he pushes off. The floor texture, light bars and dust read `travel.z`, so the planted foot stays fixed and he never glides.
- **Arms:** two-bone IK keeps the elbows on human bend planes while the hands follow the guitar.
- **Playing:** a "groove" at twice the step rate drives the strum and a downstroke accent. The accent dips his shoulder, gives his chest a little and nods his head.
- **Idle:** breath, a slow look-around, and the 9-second smoking cycle (drag, hold, exhale) while he isn't walking.

---

## 5. The studio

`components/monkey/studio.tsx` and `stage.tsx`

| Element | Design |
| --- | --- |
| Backdrop | A camera-following sphere with a screen-space radial gradient: core `rgb(0.62, 0.035, 0.05)`, mid `rgb(0.42, 0.02, 0.035)`, edge `rgb(0.09, 0.005, 0.012)`. It has fresh film grain every frame |
| Floor | A glossy red reflective floor: `MeshReflectorMaterial`, colour `#7a0a12`, mirror 0.6, mix strength 3.2, with a worn tile texture and an edge fade |
| Light bars | 16 floating white capsules (HDR, not tone-mapped, so they bloom). They wrap along z as he walks |
| Dust | 500 pale pink points drifting with the walk |
| Glass | An invisible plane in front of him that shows a radial crack texture at the strike |
| Bloom | Intensity 0.85, luminance threshold 0.95, mip-mapped |

### Lighting (do not change)

The lighting on the monkey is fixed. Restyle the studio with the backdrop, floor and bars, never with the lights.

| Light | Values |
| --- | --- |
| Hemisphere | `0x2a2a30` / `0x050505`, 0.45 |
| Key (shadows) | Directional `[-9.8, 12.6, 8.4]`, white, 2.2, shadow map 2048 |
| Fills | Directional `[3, 0.2, 3]` `0xc9d2ff` 0.32; `[-3.2, 1.2, -3]` white 1.3; `[3.4, 2, -2.8]` white 1.6 |
| Rim | Point `[-4, 2, -3]` `0xb04aff`, 18 ± 2 (slow pulse), distance 16 |
| Warm fill | Point `[3, 1, 4]` `0xffa040`, 8 |
| Lamp warmth | Point `[7, FLOOR+5.6, -4]` and `[-8, FLOOR+5.6, -7]`, `0xffa23a`, 45, distance 16, decay 1.7 |

---

## 6. Typography

| Class | Use | Spec |
| --- | --- | --- |
| `.title-x` | Section titles, menu items, the footer wordmark | Archivo 800, `wdth` 125, uppercase, line height 0.92, tracking −0.015em, cream, soft dark shadow |
| `.micro` | Labels, pills, card metadata | Archivo 700, `wdth` 112, 9.5px, tracking 0.14em, uppercase |
| `.fine` | Body copy | 11.5px, line height 1.55, cream at 62%, soft dark shadow |

**Title sizes:**
- Scenes 3 and 4: 30px on phones, 38px on desktop.
- Scene 2 runs larger:
  - title: 38 / 58px
  - opening line: 15 / 18px
  - list text: 14 / 16px
  - list labels: 11 / 13px
- Form: 32 / 44px.

**Decode titles:** every section title "decodes" in. When its section passes 35% visible, characters flicker as block glyphs at 40% opacity and resolve left to right into solid type. They reset once the section has gone, so the effect plays again on the way back.

**Section openers:** a row of three small cream dots (`.dots`) sits above every title.

---

## 7. Colour

| Token | Value | Use |
| --- | --- | --- |
| Cream | `#F4EFE6` | All type, the dots, the menu button, the progress bar, the primary button (`.btn-light`) |
| White | `#FFFFFF` | Hover states, the smash flash |
| Ink | `#0b0a0e` / `#070709` | Card and menu panels, page background behind the canvas |
| Studio red | See the backdrop and floor in section 5 | The scene itself |
| Footer red | Radial `#5a0910` → `#1a0507` → `#070709` | Footer background, continuing the studio |

There is no amber or yellow on the landing. Accents and hovers are cream or white so they hold contrast against the red. Muted text uses cream at reduced opacity (45–70%) rather than a second hue.

---

## 8. Interface around the film

- **Header:**
  - One cream menu button at the top right: 40px, 28px from the edges on phones and 48px / 40px on desktop.
  - A quiet "Live music · Real-time setlists" tag in the centre on desktop.
  - The menu opens a dark panel with Upcoming gigs, Book or host, Join as artist, All events and Artist login. Artist login lives only here.
- **Bottom bar:**
  - The scene label ("03 / 05 · The strut") and a thin progress bar on the left.
  - "Gig index" on the right.
  - The bar fades out for the smash.
- **Entrances:**
  - `.rise` slides a block up 28px out of a 7px blur as its window opens.
  - `.rise-late` follows a beat later, so body copy arrives after its title.
  - All of these read `--p`, the section's visibility, which the scroll loop sets.
- **Footer** (`components/monkey/footer.tsx`):
  - "Live music, shaped by the room" with a mail pill for hello@museing.live.
  - Explore, Artists and Venues link columns.
  - A full-width **MUSE-ING** wordmark at 14.5vw on one line.
  - The copyright line and "Back to top".

---

## 9. Responsive rules

- **Gutters:** 20px on phones (`px-5`), 32px from `sm` (`px-8`).
- **Overflow:** no horizontal page scroll at any width. The footer wordmark uses `whitespace-nowrap` and is sized to fit.
- **Scene 2 copy:** bottom-anchored on phones, centred left at 7vw on desktop.
- **Scene 3 copy:** sits above the bottom bar on phones.
- **Camera framing:** adjusts for portrait and landscape (section 3).

---

## 10. Files

| File | Role |
| --- | --- |
| `app/page.tsx` | Renders `<Experience/>` |
| `components/monkey/experience.tsx` | Runway height, scroll → `t`, jump, footer placement |
| `components/monkey/store.ts` | Scroll state, `win` / `smooth`, camera keys, framing, `BODY`, `SMASH`, `walkWeight`, `travel` |
| `components/monkey/stage.tsx` | Canvas, camera rig, lights, glass, bloom |
| `components/monkey/studio.tsx` | Backdrop, floor, light bars, dust, the MUSE-ING back title |
| `components/monkey/monkey.tsx` | The character: sculpt, materials, rig, walk, guitar play, smash |
| `components/monkey/smoke.tsx` | Cigarette smoke and the exhale |
| `components/monkey/overlay.tsx` | Header, menu, scene copy, decode titles, gigs, form, bottom bar |
| `components/monkey/footer.tsx` | Page footer |
| `components/monkey/street.tsx` | An unused cyberpunk street set, kept for later |
| `app/globals.css` | `.title-x`, `.micro`, `.fine`, `.dots`, `.rise*`, `.pill-dark`, `.card-noir`, `.btn-light`, `.btn-ghost`, `.field-noir` |

---

## 11. Guardrails

- Don't change the lights on the monkey.
- Keep the single black suit; there's no outfit switcher.
- No amber or yellow on the landing; accents stay cream or white.
- The walk must never glide. Anything that moves with the world reads `travel.z`.
- Keep scenes few and well placed. Add copy inside an existing scene before adding a scroll section.
- Check every change on phone and desktop widths with no console errors. The page takes 30–50 s to load in the in-app browser.
