import { createClient } from '@supabase/supabase-js';
import { Connection, Client } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? 'relaydispatch-dispatch';

if (!SB_URL || !SB_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY);
const orgId = '00000000-0000-0000-0000-000000000001'; // Default test organization

async function main() {
  console.log('--- Simulating Inbound Job Email ---');

  // 1. Create a simulated customer contact
  const contactId = randomUUID();
  const email = `customer-${Date.now()}@example.com`;
  const { error: contactError } = await supabase.from('contacts').insert({
    id: contactId,
    org_id: orgId,
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: email,
    phone: '555-0199'
  });
  if (contactError) throw contactError;
  console.log(`- Created contact: Sarah Johnson (${email})`);

  // 2. Create a thread
  const threadId = randomUUID();
  const { error: threadError } = await supabase.from('threads').insert({
    id: threadId,
    org_id: orgId,
    contact_id: contactId,
    status: 'new'
  });
  if (threadError) throw threadError;
  console.log(`- Created thread: ${threadId}`);

  // 3. Insert the inbound customer email message
  const bodyText = "Help! My air conditioner is blowing warm air and it's 95 degrees outside. Can you please send a technician to fix it? I'm available anytime today or tomorrow morning.";
  const { error: messageError } = await supabase.from('messages').insert({
    org_id: orgId,
    thread_id: threadId,
    role: 'customer',
    direction: 'inbound',
    body_text: bodyText,
    body_html: `<p>${bodyText}</p>`,
    subject: 'AC blowing warm air - service requested'
  });
  if (messageError) throw messageError;
  console.log('- Inserted inbound message: "AC blowing warm air - service requested"');

  // 4. Start the Temporal workflow
  console.log('- Connecting to Temporal...');
  const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
  const client = new Client({ connection, namespace: TEMPORAL_NAMESPACE });

  console.log('- Starting Temporal dispatchWorkflow...');
  const handle = await client.workflow.start('ethanDispatchWorkflow', {
    taskQueue: 'relaydispatch-dispatch',
    workflowId: threadId,
    args: [{
      threadId,
      orgId,
      emailAddress: 'sandbox@relaydispatch.com',
      historyId: 'hist_' + Date.now(),
      sb243Footer: 'Powered by RelayDispatch AI',
      timezone: 'America/Chicago'
    }]
  });

  console.log(`✅ Success! Inbound job email simulated and workflow started.`);
  console.log(`   Thread ID   : ${threadId}`);
  console.log(`   Workflow ID : ${handle.workflowId}`);
  console.log(`   Temporal UI : http://localhost:8233/namespaces/${TEMPORAL_NAMESPACE}/workflows/${handle.workflowId}`);
  console.log('\nOpen http://localhost:3000/dashboard/intake in your browser to see it in real-time!');

  await connection.close();
}

main().catch(err => {
  console.error('Simulation failed:', err);
});
