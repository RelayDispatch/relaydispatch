import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data: threads } = await SB.from('threads').select('*').order('created_at', { ascending: false }).limit(6);
  if (!threads || threads.length === 0) {
    console.log('No threads found.');
    return;
  }
  
  for (const t of threads) {
    console.log(`\n=== Thread: ${t.id} | Status: ${t.status} | Escalation: ${t.escalation_reason} ===`);
    const { data: messages } = await SB.from('messages').select('*').eq('thread_id', t.id).order('created_at', { ascending: true });
    if (messages) {
      for (const m of messages) {
        console.log(` - [${m.role}] ${m.direction}: "${m.body_text}"`);
      }
    }
  }
}

main().catch(console.error);
