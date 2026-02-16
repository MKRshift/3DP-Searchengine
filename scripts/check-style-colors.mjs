import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const offenders = [];
const hexColorPattern = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.name.endsWith('.css')) {
      continue;
    }

    const relativePath = path.relative(root, fullPath).replaceAll('\\', '/');
    if (relativePath.endsWith('/tokens.css')) {
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const matches = [...content.matchAll(hexColorPattern)];
    if (matches.length) {
      offenders.push({ file: relativePath, values: [...new Set(matches.map((match) => match[0]))] });
    }
  }
}

walk(path.join(root, 'web'));

if (offenders.length) {
  console.error('Found hardcoded hex colors outside token definition files:');
  for (const offender of offenders) {
    console.error(`- ${offender.file}: ${offender.values.join(', ')}`);
  }
  process.exit(1);
}

console.log('No hardcoded hex colors found outside token definition files.');
