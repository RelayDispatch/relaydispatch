import fs from 'fs';

const content = fs.readFileSync('backend/workflows/activities.ts', 'utf-8');
const lines = content.split('\n');

for (let i = lines.length - 20; i < lines.length; i++) {
  console.log(`[${i + 1}] ${lines[i]}`);
}
