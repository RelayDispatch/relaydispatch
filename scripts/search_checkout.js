import fs from 'fs';

const content = fs.readFileSync('src/pages/dashboard/Settings.tsx', 'utf-8');
const lines = content.split('\n');

console.log('--- Checkout/Stripe in Settings.tsx ---');
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('checkout') || line.toLowerCase().includes('stripe') || line.toLowerCase().includes('upgrade')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
