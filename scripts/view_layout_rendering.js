import fs from 'fs';

const content = fs.readFileSync('src/components/dashboard/Layout.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 310; i < lines.length; i++) {
  console.log(`[${i + 1}] ${lines[i]}`);
}
