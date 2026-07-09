import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

console.log('--- Middlewares in index.ts ---');
lines.forEach((line, index) => {
  if (line.includes('app.use(') || line.includes('c.req.path') || line.includes('return next()')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
