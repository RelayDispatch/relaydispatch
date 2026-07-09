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

  console.log("Querying jobs table with contacts join...");
  const { data: jobs, error: jobsErr } = await userClient
    .from("jobs")
    .select("*, technicians(id, name), contacts(id, email, first_name, last_name)")
    .limit(5);

  console.log("jobs result:", jobs);
  console.log("jobs error:", jobsErr);
}

main().catch(console.error);
