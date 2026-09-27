import { execSync } from 'child_process';

const isQuick = process.argv.includes('--quick');
const isZip = process.argv.includes('--zip');

let cmd = '';

if (!isQuick) {
  cmd += 'pnpm run format && pnpm run typecheck && pnpm run lint && ';
}

cmd += 'vite build';

if (isZip) {
  cmd += ' && node scripts/zip-dist.js';
}

try {
  execSync(cmd, { stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}