import fs from 'fs';

const content = fs.readFileSync('src/components/dashboard/Layout.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 145; i <= 165; i++) {
  if (lines[i]) {
    console.log(`[${i + 1}] ${lines[i]}`);
  }
}
