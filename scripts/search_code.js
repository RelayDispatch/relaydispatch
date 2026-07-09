import fs from 'fs';
import path from 'path';

const searchTerms = ['stripe', 'trial', 'subscription', 'plan_tier', 'vault_encryption_key', 'api_key', 'security_invoker', 'rls', 'row level security'];
const searchDir = './backend';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.sql')) {
        callback(dirPath);
      }
    }
  });
}

const results = {};
searchTerms.forEach(t => results[t] = []);

walkDir(searchDir, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  searchTerms.forEach(term => {
    const regex = new RegExp(term, 'gi');
    let match;
    let occurrences = [];
    while ((match = regex.exec(content)) !== null) {
      // Find line number
      const lineNum = content.substring(0, match.index).split('\n').length;
      const lines = content.split('\n');
      const lineContent = lines[lineNum - 1].trim();
      occurrences.push({ line: lineNum, text: lineContent });
    }
    if (occurrences.length > 0) {
      results[term].push({ file: filePath, matches: occurrences });
    }
  });
});

console.log(JSON.stringify(results, null, 2));
