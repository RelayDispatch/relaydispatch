import fs from 'fs';
import path from 'path';

function walk(dir, results = []) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walk(fullPath, results);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk('.');
let found = false;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  if (content.toLowerCase().includes('trial')) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('trial')) {
        console.log(`${file}:${index + 1}: ${line.trim()}`);
        found = true;
      }
    });
  }
});

if (!found) {
  console.log('No matches for "trial" found anywhere in the source files.');
}
