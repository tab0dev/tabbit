// Node ESM loader that resolves extensionless .js imports (like Vite does)
// Usage: node --loader ./src/tests/loader.mjs src/tests/domainGrouping.test.js

import { resolve as nodeResolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
    // Only handle relative imports that lack an extension
    if (specifier.startsWith('.') && !specifier.match(/\.\w+$/)) {
        const parentDir = new URL('.', context.parentURL).pathname;
        const candidate = nodeResolve(parentDir, specifier + '.js');
        if (existsSync(candidate)) {
            return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
    }
    return nextResolve(specifier, context);
}
