# Sunalyse

An interactive 3D solar magnetic field viewer built with React, Three.js, and PFSS (Potential Field Source Surface) extrapolation. Visualises the Sun's coronal magnetic field structure for all 181 Carrington Rotations from CR 2096 to CR 2285 (roughly 2010–2024), covering a full solar cycle.

---

## What It Does

Sunalyse lets you navigate through 14 years of solar magnetic field data and explore three layers of solar physics:

**Photosphere** — the solar surface magnetic field, shown as a colour-mapped texture derived from HMI synoptic FITS maps. Orange/red regions have strong outward field, green regions have strong inward field, grey near the neutral line. Supports fixed-scale and auto-scale display with adjustable min/max Gauss values. A visible-light mode renders the Sun as it appears to the eye — orange-yellow with dark sunspots at active regions.

**Coronal field lines** — 3D magnetic field lines traced using PFSS extrapolation from spherical harmonic coefficients (lmax=85). Lines are seeded from the strongest photospheric field regions and colour-coded by local field strength — dark red/green at weak points, bright orange-yellow/lime at strong points. Tracing uses Euler integration with step_size=0.01 and max_steps=1000. Filterable by open/closed polarity and by apex height (1.0–2.5 Rs). Footpoints on the photosphere can be shown as a point cloud.

**Source surface polarity** — the heliospheric current sheet (HCS) visualised as a coloured transparent surface at 2.5 solar radii. Warm regions (red/orange) are positive polarity (outward Br), cool regions (green) are negative polarity (inward Br). The boundary between them is the HCS — the large-scale structure that divides the inner solar system into magnetic sectors and influences space weather.

---

## Architecture

```
HMI FITS files (HF: aniruddhballal/fits-data)
    ↓ alm_calc.py
Spherical harmonic coefficients (HF: aniruddhballal/alm-values)
    ↓ kaggle_seed_generation.py
Adaptive photospheric seeds (HF: aniruddhballal/seed-data)
    ↓ kaggle_pfss_from_precomputed_alms.py
Coronal JSON files (HF: aniruddhballal/coronal-data)
    ↓
React + Three.js frontend (Vercel)
```

**Frontend stack:** React + TypeScript + Vite + Three.js  
**Data pipeline:** Python (NumPy, SciPy, astropy) on Kaggle  
**Data hosting:** Hugging Face Datasets  
**Deployment:** Vercel

---

## Data Pipeline Details

### FITS → ALM coefficients
HMI synoptic magnetograms (`hmi.Synoptic_Mr_small.xxxx.fits`) are loaded and integrated against spherical harmonics up to lmax=85, producing `values_xxxx.csv` files with 7396 complex coefficients per Carrington Rotation.

### ALM → Seed locations
`kaggle_seed_generation.py` reads each FITS file, finds the top 500 pixels by |Br| magnitude, and applies O(n²) haversine clustering with 0.08 rad minimum separation to spread seeds across distinct active regions. Outputs `seeds_xxxx.csv` with `theta, phi, br_strength, polarity_sign`.

### ALM + Seeds → Coronal JSON
`kaggle_pfss_from_precomputed_alms.py` runs on Kaggle (4 CPUs):
- Loads alm coefficients and converts to NumPy arrays for vectorised `sph_harm` calls
- Computes the source surface Br grid (60×120) for the polarity texture
- Traces 500 field lines using multiprocessing.Pool across all cores
- Exports to `cr_xxxx_coronal.json` with `fieldLines` and `polarityGrid`

Approximate timing per CR: ~100s for Br grid + ~270s for field line tracing = ~6 minutes total. Full dataset (181 CRs) took ~20 hours on Kaggle.

---

## Frontend Architecture

The frontend is fully modular, organised into single-responsibility layers:

```
services/
  api.ts                  — fetch orchestration (HF CDN, stream drain, NaN sanitization)
  coronalTypes.ts         — raw wire-format type definitions
  coronalParser.ts        — NaN/Infinity sanitization + post-parse cleaning
  streamUtils.ts          — ReadableStream drain utility

solar-globe/
  hooks/
    scene/
      useThreeScene.ts        — React hook wiring all scene effects
      sceneInit.ts            — full Three.js scene assembly (one-shot)
      sceneObjects.ts         — pure factory functions (starfield, graticule, glow)
      sceneControls.ts        — pointer/wheel/resize event handling + camera state
      sceneAnimationLoop.ts   — rAF loop, texture + field line transition ticking
      sceneFieldLines.ts      — field line geometry, polarity mesh, footpoints
      sceneTypes.ts           — ThreeSceneRef, TransitionRef interfaces
    data/
      useCoronalFieldLines.ts — coronal fetch + visibility state
      useCarringtonData.ts    — FITS fetch + CR navigation
      useFitsData.ts          — FITS state container
    scene/
      use2DRenderer.ts        — canvas 2D flat map rendering + transitions
```

### Coronal JSON sanitization
Python's `json.dumps` emits bare `NaN` tokens for numpy floats that blow up near the solar poles (sin(theta) → 0 during field line integration). These are valid Python but illegal JSON — `JSON.parse` rejects the whole file. The frontend sanitizes them before parsing: `NaN`/`Infinity`/`-Infinity` are replaced with `null`, then field lines containing any null coordinates are dropped (they have no renderable geometry). This avoids regenerating 20 hours of compute.

### HF CDN fetch reliability
Large coronal JSON files (up to ~1MB) are fetched from Hugging Face CDN with `Accept-Encoding: identity` to prevent partial-gunzip issues on chunked responses. The response body is manually drained via `ReadableStream.getReader()` before parsing — `response.json()` can call `JSON.parse` on a partial body on large payloads.

---

## What Was Built from 13th March 2026 Onwards (project started early December 2025)

### Started from
- Straight radial field lines (Btheta and Bphi were hardcoded to 0)
- Uniform 14×14 seed grid (196 seeds, no physics-based placement)
- Express.js backend proxying to Hugging Face
- Flat green/red field line colours with no strength information
- Monolithic ~1100-line `useThreeScene.ts` hook

### What was fixed and added

**Physics fix** — computed all three PFSS field components correctly (Br, Btheta via finite difference, Bphi via analytic i·m·Ylm derivative). Field lines now curve realistically instead of spiking radially outward.

**Performance** — vectorised `compute_field_at_point` from a nested Python loop over 7396 (l,m) pairs to a single batched `sph_harm` call. 3.3× speedup. Added `multiprocessing.Pool` parallelisation for a further 2.3× on 4 cores (7.6× total vs original).

**Adaptive seeding** — replaced uniform grid with FITS-derived seeds at the strongest |Br| photospheric locations. O(n²) haversine clustering ensures seeds are spread across distinct active regions rather than piling up on one sunspot group.

**Colour by field strength** — per-vertex colour gradient along each field line based on local |B|. Closed loops: dark red (weak) → bright orange-yellow (strong). Open lines: dim green (weak) → bright yellow-green (strong). User-adjustable colour ceiling slider (50–2000G) in the Corona settings panel.

**Polarity surface** — source surface (2.5 Rs) coloured by Br sign and magnitude using a GLSL shader that samples a 60×120 Float32 texture by computing spherical coordinates from the vertex's 3D world position directly — bypassing UV mapping entirely. Toggles between this and the wireframe.

**Backend removal** — eliminated the Express.js server entirely; frontend fetches directly from Hugging Face using native `fetch`.

**Modularisation** — decomposed the monolithic `useThreeScene.ts` into seven focused modules (sceneInit, sceneObjects, sceneControls, sceneAnimationLoop, sceneFieldLines, sceneTypes, useThreeScene). Similarly decomposed `api.ts` into coronalTypes, coronalParser, and streamUtils. Each module has a single responsibility and no cross-cutting concerns.

**Coronal JSON robustness** — fixed a silent data corruption bug where Python-emitted `NaN` tokens in the coronal JSON caused `JSON.parse` to fail at a specific column. Added pre-parse sanitization and post-parse field line filtering so all 181 CRs load correctly without regenerating data.

**Production deployment fix** — resolved a bug where the Three.js scene failed to initialise on the deployed Vercel build but worked fine on localhost. Root cause: the init effect ran before the container had real dimensions in production's async paint timing. Fixed using a `fitsDataRef` pattern that keeps the effect dependency array stable while always reading the latest value.

**UI additions** — apex height filter (range slider, 1.0–2.5 Rs), footpoint markers, lat/lon graticule, geographic pole axes, visible light toggle, solar cycle timeline bar, field strength legend, CR navigation with prefetching, play/pause solar cycle animation, mobile bottom sheet settings panel with drag-to-resize.

---

## Known Limitations

**Synoptic map seam** — FITS synoptic maps composite one longitude strip per day over 27.3 days. The east and west edges of the map are observed ~27.3 days apart, creating a visible discontinuity. Fixing this requires synchronic maps (JSOC export API) or multi-viewpoint data (STEREO).

**PFSS model limitations** — PFSS assumes a current-free corona (no currents between photosphere and source surface) and a perfectly radial field at the source surface. Real coronal fields have currents, filaments, and dynamic structures that PFSS cannot reproduce.

**Source surface radius** — fixed at 2.5 Rs, the standard value. The actual HCS position varies with solar activity and is better modelled with adaptive source surfaces.

**Euler integration** — field lines use first-order Euler stepping. Runge-Kutta 4 would give smoother, more accurate trajectories with fewer steps, reducing per-line compute time by roughly half.

**Br grid resolution** — polarity surface uses 60×120 grid. Fine structure of the HCS (narrow current sheet folds, streamer belt details) is smoothed out at this resolution.

**CR coverage gap** — no FITS data available for CR 2119–2127 (9 rotations). These are skipped in the dataset.

**Dataset range** — covers CR 2096–2285. HMI data extends to CR 2307; the dataset can be extended by downloading additional FITS files from JSOC.

**NaN field lines** — field lines whose integration drifts to θ ≈ 0 or π (poles) produce NaN Cartesian coordinates. These are sanitized and dropped at load time. The underlying cause is first-order Euler stepping near the poles; RK4 integration would reduce the occurrence.

---

## Planned Features

### Near term
- **Solar flare event markers** — NOAA GOES / HEK API, clickable markers placed at flare lat/lon for the selected CR
- **Active region overlays** — NOAA SWPC daily AR position files, bounding boxes on the photosphere with NOAA AR numbers
- **Neutral line enhancement** — render an explicit bright curve at Br=0 on the polarity surface to mark the HCS position precisely
- **Field line density control** — UI slider for number of seeds (currently fixed at 500)

### Longer term
- **Solar cycle animation** — step through all 181 CRs automatically showing HCS tilt evolving from ~2° at solar minimum to ~60°+ at solar maximum
- **Solar wind speed panel** — OMNI dataset (NASA CDAWeb), correlate open field line regions with fast/slow wind streams
- **Coronal hole detection** — SDO AIA 193Å synoptic maps from JSOC, overlay on photosphere surface
- **EUV texture mode** — AIA 171Å/193Å synoptic maps, same FITS format as HMI, swap or blend with the magnetogram texture
- **Spacecraft trajectory overlay** — show Parker Solar Probe or Solar Orbiter position against the coronal field for the selected CR
- **Synchronic maps** — replace synoptic maps to eliminate the east-west seam discontinuity
- **Higher lmax** — increasing from lmax=85 to lmax=120+ would resolve finer active region structure, at the cost of longer alm computation
- **Open/closed field boundary** — highlight the boundary between open and closed field regions directly on the photosphere
- **Runge-Kutta integration** — replacing Euler with RK4 would halve computation time and reduce pole-proximity NaN events

---

## Running the Project

```bash
cd client
npm install
cp .env.example .env   # set VITE_HF_USER, VITE_HF_FITS, VITE_HF_CORONA
npm run dev
```

The app fetches data directly from Hugging Face — no backend required.

---

## Data Credits

- **HMI Synoptic Maps** — NASA/SDO HMI instrument, JSOC Stanford
- **PFSS method** — Altschuler & Newkirk (1969), Schatten et al. (1969)
- **Spherical harmonic computation** — SciPy `sph_harm`
- **Solar event data** — NOAA Space Weather Prediction Center
- **Solar wind data** — NASA OMNI dataset via CDAWeb (Goddard Space Flight Center)