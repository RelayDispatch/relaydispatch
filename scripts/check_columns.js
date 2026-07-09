import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Test simple query to check connection
  const { data: testData, error: testError } = await supabase.from('org_members').select('*').limit(1);
  console.log('org_members test:', { testData, testError });

  // Test organizations query
  const { data, error } = await supabase.from('organizations').select('*').limit(1);
  console.log('organizations query:', { data, error });
}
check();
