import fs from 'fs';

const content = fs.readFileSync('backend/db/schema.sql', 'utf-8');
const lines = content.split('\n');

let print = false;
let count = 0;
lines.forEach((line, index) => {
  if (line.includes('CREATE TABLE public.messages') || line.includes('CREATE TABLE messages')) {
    print = true;
  }
  if (print) {
    console.log(`[${index + 1}] ${line}`);
    count++;
    if (line.includes(');') || count > 40) {
      print = false;
    }
  }
});
