import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

console.log('--- Search for sanitizedOrg in index.ts ---');
lines.forEach((line, index) => {
  if (line.includes('trial_ends_at: org.trial_ends_at') || line.includes('trial_ends_at: updatedOrg.trial_ends_at')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 5 lines before and after
    const start = Math.max(0, index - 5);
    const end = Math.min(lines.length - 1, index + 5);
    for (let i = start; i <= end; i++) {
      console.log(`  [${i + 1}] ${lines[i]}`);
    }
  }
});
