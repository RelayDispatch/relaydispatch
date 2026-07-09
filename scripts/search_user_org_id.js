import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('function getUserOrgId') || line.includes('const getUserOrgId')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 20 lines after
    for (let i = index; i <= Math.min(lines.length - 1, index + 20); i++) {
      console.log(`  [${i + 1}] ${lines[i]}`);
    }
  }
});
