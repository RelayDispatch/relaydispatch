import fs from 'fs';

const content = fs.readFileSync('backend/workflows/dispatchWorkflow.ts', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('ThreadState') || line.includes('interface ThreadState') || line.includes('type ThreadState')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
