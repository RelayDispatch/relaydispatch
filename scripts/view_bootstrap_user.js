import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

for (let i = 545; i <= 585; i++) {
  if (lines[i]) {
    console.log(`[${i + 1}] ${lines[i]}`);
  }
}
