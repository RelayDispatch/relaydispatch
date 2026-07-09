import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

console.log('--- Organization endpoints ---');
lines.forEach((line, index) => {
  if (line.includes('/api/organizations') || line.includes('/api/orgs')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 15 lines before and after
    const start = Math.max(0, index - 15);
    const end = Math.min(lines.length - 1, index + 35);
    for (let i = start; i <= end; i++) {
      console.log(`  [${i + 1}] ${lines[i]}`);
    }
  }
});
