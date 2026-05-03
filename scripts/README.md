# Tabbit Build & Utility Scripts

This directory contains scripts used for asset generation, build packaging, and local development utilities.

---

## 1. Swipe Animation Generator (`generateSwipeAnimation.js`)

This script pre-computes an animated SVG for the "Swipe" action in the `TutorialOverlay` component. By using a standalone image instead of DOM-bound infinite CSS animations, we remove layout and styling recalculation overhead for the browser.

### Why pre-compute?
CSS animations running endlessly inside the main DOM tree can cause consistent performance overhead. Compiling it directly into `.svg` shifts this rendering step entirely into the browser's image decoding pipeline, saving CPU/GPU cycles.

### Usage
To regenerate the `swipe-animation.svg`, simply navigate to the root directory of the repository and run:

```bash
node scripts/generateSwipeAnimation.js
```

### Customization
If you need to change the timing, colors, or the icon completely:
1. Open up `scripts/generateSwipeAnimation.js`.
2. Edit the `keyframes` string to change rotation or translation.
3. Edit the `iconSVG` string to use a different Phosphor icon (or any SVG).
4. Run the script again to overwrite `src/components/Tutorial/swipe-animation.svg`.

---

## 2. Audio Loop Generator (`gen-audio.cjs`)

Tabbit features a generative music engine. This script uses a step-sequencer approach to generate the PCM WAV files used for the different music layers (kick, snare, bass, melody, etc.).

### Usage
```bash
pnpm gen-audio
# or
node scripts/gen-audio.cjs
```

The script will output `.wav` files into `public/audio/`. These files are then loaded by the `GenerativeMusicEngine` in the app.

---

## 3. Distribution Packager (`zip-dist.js`)

A simple utility to package the compiled extension into a `.zip` file for Chrome Web Store submission.

### Usage
```bash
pnpm build:zip
```

This will run the Vite build and then execute `node scripts/zip-dist.js`, which creates a versioned zip file in the root directory (e.g., `Tabbit-v0.1.1.zip`).
