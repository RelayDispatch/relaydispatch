import fs from 'fs';

const content = fs.readFileSync('backend/db/schema.sql', 'utf-8');
const lines = content.split('\n');

console.log('--- Search results in schema.sql ---');
lines.forEach((line, index) => {
  const lineNum = index + 1;
  if (line.toLowerCase().includes('trial') || line.toLowerCase().includes('plan') || line.toLowerCase().includes('tier') || line.toLowerCase().includes('billing')) {
    console.log(`Line ${lineNum}: ${line.trim()}`);
  }
});
