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
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk('./backend');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  if (content.toLowerCase().includes('vault') || content.toLowerCase().includes('encrypt')) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('vault') || line.toLowerCase().includes('encrypt') || line.toLowerCase().includes('crypto')) {
        console.log(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
});
