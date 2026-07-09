import fs from 'fs';

const content = fs.readFileSync('backend/workflows/activities.ts', 'utf-8');
const lines = content.split('\n');

for (let i = 370; i <= 430; i++) {
  if (lines[i]) {
    console.log(`[${i + 1}] ${lines[i]}`);
  }
}
