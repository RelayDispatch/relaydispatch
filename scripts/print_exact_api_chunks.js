import fs from 'fs';

const content = fs.readFileSync('backend/api/index.ts', 'utf-8');
const lines = content.split('\n');

function printRange(startLine, endLine) {
  console.log(`=== Lines ${startLine}-${endLine} ===`);
  for (let i = startLine - 1; i < endLine; i++) {
    console.log(lines[i]);
  }
}

// Print middleware block
printRange(980, 996);

// Print GET settings sanitization
printRange(3110, 3145);

// Print PATCH settings sanitization
printRange(3207, 3233);
