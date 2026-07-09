import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function main() {
  console.log("Signing in...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "test@relaydispatch.com",
    password: "password123"
  });

  if (error) {
    console.error("Sign in failed:", error.message);
    return;
  }

  const userClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
    }
  );

  console.log("Querying pricing_rules using user JWT...");
  const { data: pricing, error: pricingErr } = await userClient
    .from("pricing_rules")
    .select("service_code, service_label, category, pricing_type, base_price_usd, min_price_usd, max_price_usd, unit_label");
  
  console.log("pricing result:", pricing);
  console.log("pricing error:", pricingErr);
}

main().catch(console.error);
