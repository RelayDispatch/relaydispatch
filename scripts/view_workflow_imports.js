import fs from 'fs';

const content = fs.readFileSync('backend/workflows/dispatchWorkflow.ts', 'utf-8');
const lines = content.split('\n');

for (let i = 45; i <= 75; i++) {
  if (lines[i]) {
    console.log(`[${i + 1}] ${lines[i]}`);
  }
}
