import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY);
const testOrgId = '00000000-0000-0000-0000-000000000001';

async function main() {
  const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('organizations')
    .update({ trial_ends_at: expiredDate, plan: 'starter', plan_tier: 'starter' })
    .eq('id', testOrgId);

  if (error) {
    console.error('Failed to set trial to expired:', error);
  } else {
    console.log(`✅ Successfully set trial to EXPIRED for organization ${testOrgId}.`);
    console.log(`   trial_ends_at is set to: ${expiredDate}`);
  }
}

main();
