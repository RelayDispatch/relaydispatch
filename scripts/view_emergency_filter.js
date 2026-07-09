import fs from 'fs';

const content = fs.readFileSync('backend/workflows/activities.ts', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('emergencyPreFilterActivity')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 35 lines after
    for (let i = index; i <= Math.min(lines.length - 1, index + 35); i++) {
      console.log(`  [${i + 1}] ${lines[i]}`);
    }
  }
});
