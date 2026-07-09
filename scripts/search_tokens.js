import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

console.log('--- Token Storage in API ---');
lines.forEach((line, index) => {
  if (line.includes('jobber_access_token') || line.includes('vault_id') || line.includes('servicetitan_access_token') || line.includes('mail_access_token')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
