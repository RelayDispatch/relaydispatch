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

  // Create user-scoped client
  const userClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
    }
  );

  console.log("Querying org_members using user JWT...");
  const { data: mem, error: memErr } = await userClient.from("org_members").select("*");
  console.log("org_members result:", mem);
  console.log("org_members error:", memErr);

  console.log("\nQuerying current_org_id() RPC using user JWT...");
  const { data: rpcVal, error: rpcErr } = await userClient.rpc("current_org_id");
  console.log("current_org_id() result:", rpcVal);
  console.log("current_org_id() error:", rpcErr);

  console.log("\nQuerying organizations using user JWT...");
  const { data: orgs, error: orgsErr } = await userClient.from("organizations").select("*");
  console.log("organizations result:", orgs);
  console.log("organizations error:", orgsErr);
}

main().catch(console.error);
