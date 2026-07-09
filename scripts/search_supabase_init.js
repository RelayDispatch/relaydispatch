import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

console.log('--- Supabase Client Initialization in API ---');
lines.forEach((line, index) => {
  if (line.includes('createClient(') || line.includes('createClient ') || line.includes('createUserSupabase') || line.includes('createWebhookSupabase')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
