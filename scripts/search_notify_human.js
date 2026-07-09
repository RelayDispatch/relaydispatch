import fs from 'fs';

const content = fs.readFileSync('backend/workflows/activities.ts', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('export async function notifyHumanAgentActivity')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 15 lines after
    for (let i = index; i <= Math.min(lines.length - 1, index + 25); i++) {
      console.log(`  [${i + 1}] ${lines[i]}`);
    }
  }
});
