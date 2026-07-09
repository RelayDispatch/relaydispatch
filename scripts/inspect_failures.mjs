import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SB = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function checkThread(threadId, scenarioName) {
  console.log(`\n=== Scenario: ${scenarioName} (Thread: ${threadId}) ===`);
  const { data: thread } = await SB.from('threads').select('*').eq('id', threadId).single();
  const { data: messages } = await SB.from('messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
  
  console.log('Thread Status:', thread?.status);
  console.log('Thread Escalation Reason:', thread?.escalation_reason);
  console.log('Messages:');
  if (messages) {
    for (const m of messages) {
      console.log(` - Role: ${m.role}, Direction: ${m.direction}`);
      console.log(`   Text: "${m.body_text}"`);
    }
  } else {
    console.log(' No messages found.');
  }
}

async function main() {
  await checkThread('6518fea8-03ef-4aa3-89d3-2ca9ef58e448', 'Indirect emergency phrasing');
  await checkThread('eafc36b7-0e17-447a-8f3c-3ae49538bd50', 'Prompt injection');
}

main().catch(console.error);
