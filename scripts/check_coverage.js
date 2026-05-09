import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatesPath = path.join(__dirname, '../src/components/Card/AutoTabGrouperWorkerCard/templates.js');
const templatesCode = fs.readFileSync(templatesPath, 'utf-8');

// Extract REGION_COVERAGE_MAP using regex
const mapRegex = /export const REGION_COVERAGE_MAP = (\{[\s\S]*?\});/;
const match = templatesCode.match(mapRegex);

if (!match) {
  console.error("Could not find REGION_COVERAGE_MAP in templates.js");
  process.exit(1);
}

// Safely evaluate the object (since it's just a static object)
let REGION_COVERAGE_MAP;
try {
  REGION_COVERAGE_MAP = eval('(' + match[1] + ')');
} catch (e) {
  console.error("Failed to parse REGION_COVERAGE_MAP", e);
  process.exit(1);
}

const globalCategories = REGION_COVERAGE_MAP['global'] || [];

console.log('--- OUTSTANDING CATEGORIES ---');
console.log(`Global categories count: ${globalCategories.length}\n`);

for (const [region, categories] of Object.entries(REGION_COVERAGE_MAP)) {
  if (region === 'global') continue;
  
  const missing = globalCategories.filter(c => !categories.includes(c));
  console.log(`${region} is missing (${missing.length}):`);
  if (missing.length > 0) {
    console.log(`  ${missing.join(', ')}`);
  } else {
    console.log(`  None! Fully covered.`);
  }
  console.log();
}
