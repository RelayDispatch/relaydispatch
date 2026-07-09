import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SB_URL, SB_KEY);
const testOrgId = '00000000-0000-0000-0000-000000000001';

async function verify() {
  console.log('--- Subscriptions & Trial Gate Verification ---');

  // 1. Set trial to EXPIRED (1 day ago)
  const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('organizations')
    .update({ trial_ends_at: expiredDate, plan: 'starter', plan_tier: 'starter' })
    .eq('id', testOrgId);
  console.log(`- Set org ${testOrgId} trial to expired (${expiredDate})`);

  // 2. Create a temporary user via admin API and add as member
  const email = `trial-tester-${Date.now()}@gmail.com`;
  const password = 'SecretPassword123!';
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (authError) throw authError;
  const user = authData.user;
  console.log(`- Created test user via admin API: ${email} (${user.id})`);

  const { error: memberError } = await supabase
    .from('org_members')
    .insert({ org_id: testOrgId, user_id: user.id, role: 'owner' });
  if (memberError) throw memberError;
  console.log(`- Linked user to organization ${testOrgId}`);

  // Get session token
  const { data: sessionData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  const token = sessionData.session.access_token;
  console.log('- Logged in test user and obtained JWT token');

  // 3. Query a gated route (GET /api/pricing) and expect 402
  console.log('- Requesting gated route GET /api/pricing...');
  const pricingRes = await fetch('http://localhost:3001/api/pricing', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`- Response status: ${pricingRes.status}`);
  const pricingJson = await pricingRes.json();
  console.log('- Response body:', pricingJson);

  const isGatedOk = pricingRes.status === 402 && pricingJson.code === 'trial_expired';
  console.log(`- Gating status: ${isGatedOk ? '✅ SUCCESS' : '❌ FAILED'}`);

  // 4. Query an excluded route (POST /api/stripe/create-checkout-session) and expect 200 or Stripe session
  console.log('- Requesting stripe checkout session (should bypass gate)...');
  const stripeRes = await fetch('http://localhost:3001/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`- Response status: ${stripeRes.status}`);
  const stripeJson = await stripeRes.json();
  console.log('- Response body:', stripeJson);

  const isBypassOk = stripeRes.status === 200 && stripeJson.url && (stripeJson.url.includes('stripe.com') || stripeJson.url.includes('cs_test_mock'));
  console.log(`- Stripe bypass status: ${isBypassOk ? '✅ SUCCESS' : '❌ FAILED'}`);

  // 5. Clean up: reset org trial to active (+14 days) and delete test user/member
  const activeDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('organizations')
    .update({ trial_ends_at: activeDate, plan: 'starter', plan_tier: 'starter' })
    .eq('id', testOrgId);
  await supabase.from('org_members').delete().eq('user_id', user.id);
  await supabase.auth.admin.deleteUser(user.id);
  console.log('- Cleaned up organization settings and deleted test user successfully');

  if (isGatedOk && isBypassOk) {
    console.log('\n✅ TRIAL GATING VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.log('\n❌ TRIAL GATING VERIFICATION FAILED.');
    process.exit(1);
  }
}

verify().catch(err => {
  console.error('Error in verification:', err);
  process.exit(1);
});
