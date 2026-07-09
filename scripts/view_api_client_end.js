import fs from 'fs';

const content = fs.readFileSync('src/lib/apiClient.ts', 'utf-8');
const lines = content.split('\n');

for (let i = 320; i < lines.length; i++) {
  console.log(`[${i + 1}] ${lines[i]}`);
}
