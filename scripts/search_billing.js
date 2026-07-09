import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

console.log('--- Search results for "stripe" and "trial" ---');
lines.forEach((line, index) => {
  const lineNum = index + 1;
  if (line.toLowerCase().includes('stripe') || line.toLowerCase().includes('trial') || line.toLowerCase().includes('plan')) {
    console.log(`Line ${lineNum}: ${line.trim()}`);
  }
});
