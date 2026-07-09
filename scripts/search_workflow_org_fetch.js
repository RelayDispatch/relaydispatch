import fs from 'fs';

const content = fs.readFileSync('backend/workflows/dispatchWorkflow.ts', 'utf-8');
const lines = content.split('\n');

console.log('--- fetchOrgConfigActivity in dispatchWorkflow.ts ---');
lines.forEach((line, index) => {
  if (line.includes('fetchOrgConfigActivity')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 10 lines after
    for (let i = index; i <= Math.min(lines.length - 1, index + 15); i++) {
      console.log(`  [${i + 1}] ${lines[i]}`);
    }
  }
});
