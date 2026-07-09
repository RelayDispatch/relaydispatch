import fs from 'fs';

const content = fs.readFileSync('src/pages/dashboard/Settings.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 1445; i <= 1475; i++) {
  if (lines[i]) {
    console.log(`[${i + 1}] ${lines[i]}`);
  }
}
