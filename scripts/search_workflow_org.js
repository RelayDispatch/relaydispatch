import fs from 'fs';
import path from 'path';

function searchInFile(filePath, term) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(term)) {
      console.log(`${filePath}:${index + 1}: ${line.trim()}`);
    }
  });
}

searchInFile('backend/workflows/activities.ts', 'organizations');
searchInFile('backend/workflows/dispatchWorkflow.ts', 'organizations');
