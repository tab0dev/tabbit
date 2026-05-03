/**
 * generateSwipeAnimation.js
 * 
 * Generates an SVG file that contains the infinite CSS animation for the 
 * HandPointing icon. Running this pre-computes the animation into an image format
 * to offload animation overhead from the DOM styling engine to the browser's image decoder.
 * 
 * Usage:
 *   node scripts/generateSwipeAnimation.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output paths
const OUTPUT_DIR = path.join(__dirname, '../src/components/Tutorial');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'swipe-animation.svg');

// Raw SVG path the user wants to use 
// We are replacing "currentColor" with #EFEFEF to ensure it's visible. 
// When using <img> for an SVG, it cannot inherit CSS variables like var(--text-primary).
const color = '#EFEFEF';

// The base SVG (without styling)
// Incorporating your provided HandPointing vector, wrapped inside a scalable viewBox
const iconSVG = `
  <rect width="256" height="256" fill="none"/>
  <path d="M42.68,142a20,20,0,0,1,34.64-20L96,152V44a20,20,0,0,1,40,0v56a20,20,0,0,1,40,0v16a20,20,0,0,1,40,0v36a80,80,0,0,1-80,80C91.82,232,80.19,208,42.68,142Z" fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
`;

// Extracting the keyframes that were originally in TutorialOverlay.module.css
const cssAnimation = `
  .animated-hand {
    animation: swipeSimulate 6s infinite ease-in-out;
    transform-origin: bottom center;
  }

  @keyframes swipeSimulate {
    0% { transform: translateX(0) rotate(0deg); }
    5% { transform: translateX(-16px) rotate(-20deg); }
    10% { transform: translateX(0) rotate(0deg); }
    
    15% { transform: translateX(-16px) rotate(-20deg); }
    20% { transform: translateX(0) rotate(0deg); }
    
    25% { transform: translateX(16px) rotate(20deg); }
    30% { transform: translateX(0) rotate(0deg); }
    
    35% { transform: translateX(16px) rotate(20deg); }
    40% { transform: translateX(0) rotate(0deg); }
    
    45% { transform: translateX(16px) rotate(20deg); }
    50% { transform: translateX(0) rotate(0deg); }
    
    55% { transform: translateX(-16px) rotate(-20deg); }
    60% { transform: translateX(0) rotate(0deg); }
    
    65% { transform: translateX(16px) rotate(20deg); }
    70% { transform: translateX(0) rotate(0deg); }
    
    100% { transform: translateX(0) rotate(0deg); }
  }
`;

function generate() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Combine into a static SVG file, using a group <g> tag to apply the animation
  const finalSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-64 -64 384 384">
  <style>
    ${cssAnimation}
  </style>
  <g class="animated-hand">
    ${iconSVG}
  </g>
</svg>
`.trim();

  fs.writeFileSync(OUTPUT_FILE, finalSVG, 'utf8');
  console.log(`Successfully generated ${OUTPUT_FILE}`);
}

generate();
