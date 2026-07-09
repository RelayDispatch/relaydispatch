import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const threadId = 'b4f9f864-7bf6-4e03-a7bc-77a84d56b3ac';

async function main() {
  const { data: thread } = await supabase.from('threads').select('*').eq('id', threadId).single();
  const { data: messages } = await supabase.from('messages').select('*').eq('thread_id', threadId);
  
  console.log('--- DB State for b4f9f864-7bf6-4e03-a7bc-77a84d56b3ac ---');
  console.log('Thread:', thread);
  console.log('Messages:', messages);
}
main();
