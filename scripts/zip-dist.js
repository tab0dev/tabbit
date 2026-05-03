import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const name = pkg.name || 'extension';
const version = pkg.version || '0.0.0';
const outFile = resolve(root, `${name}-v${version}.zip`);

execSync(`cd "${resolve(root, 'dist')}" && zip -r "${outFile}" .`);
console.log(`\n📦 Zipped extension → ${name}-v${version}.zip\n`);
