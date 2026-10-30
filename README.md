# AI Bharat — website frontend

Vite + React 19 + TypeScript + Tailwind CSS v4, React Router 7, GSAP ScrollTrigger, Three.js (hero only) and @xyflow/react (Workflow Studio demo).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

## Before going live

Edit `src/lib/config.ts`:

- `formEndpoint` — a POST URL that accepts JSON. Until it is set, the Build With Us and Contact forms finish in the browser and offer copy/download instead of claiming to send.
- `contactEmail` — shown on the Contact page when set.
- `social` — footer links appear only for the profiles you fill in.

The site is a client-side SPA, so the host must rewrite unknown paths to `index.html`.

## Illustrative content

These are demonstrations, labelled as such on the page, and need real data before commercial use:

- GPU catalogue tiers, VRAM, availability and ₹ prices — `src/components/gpu/GpuCatalogue.tsx`
- Model routing decisions and provider names ("Hosted provider A/B/C") — `src/components/orchestration/ModelRouter.tsx`
- Workflow Studio runs are simulated in the browser — `src/components/workflow-studio/`
- The developer code sample — `src/pages/Developers.tsx`

## Where things live

| Area | Path |
| --- | --- |
| Design tokens, motion helpers | `src/styles/index.css` |
| Architecture layer content | `src/lib/layers.ts` |
| Industries & use cases | `src/lib/content.ts` |
| Hero 3D scene | `src/components/hero/heroScene.ts` |
| Layered architecture (signature) | `src/components/architecture/` |
| Workflow Studio demo & workflows | `src/components/workflow-studio/` |
| Brief composer rules | `src/lib/brief.ts` |
| Routes | `src/router.tsx` |

## Design system (v2 — semi-light)

- **Tokens** live in `src/styles/index.css`. The default theme is semi-light (blue-grey page, off-white/white surfaces, navy text). Add `surface-dark` to a section to re-scope the same tokens to deep navy; `surface-light` forces the light set (used by the Workflow Studio shell inside the navy band).
- **Type:** Manrope (UI and headings), Instrument Serif (accent words only), IBM Plex Mono (technical data only).
- **Radius scale:** 6px controls · 8px buttons · 10–12px cards · 14–16px large containers. Pills only for chips.
- **Buttons:** `src/components/ui/Button.tsx` — primary, secondary, tertiary, destructive, icon; supports `loading`.
- **Brand mark:** `src/components/ui/BrandMark.tsx` — the AI BHARAT typographic shadow (flat face, stepped extrusion, saffron edge, soft shadow). Use sparingly: brand statement and footer.
