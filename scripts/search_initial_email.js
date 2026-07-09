import fs from 'fs';

const content = fs.readFileSync('backend/workflows/dispatchWorkflow.ts', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('if (!initialEmail)')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 5 lines before and after
    const start = Math.max(0, index - 5);
    const end = Math.min(lines.length - 1, index + 5);
    for (let i = start; i <= end; i++) {
      console.log(`  [${i + 1}] ${lines[i]}`);
    }
  }
});
