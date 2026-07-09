import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Checking DB schema and tables...");

  const { data: orgs, error: orgsErr } = await supabase.from("organizations").select("*");
  console.log("\n--- Organizations ---");
  if (orgsErr) console.error(orgsErr);
  else console.log(orgs);

  const { data: members, error: memErr } = await supabase.from("org_members").select("*");
  console.log("\n--- Org Members ---");
  if (memErr) console.error(memErr);
  else console.log(members);

  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers();
  console.log("\n--- Auth Users ---");
  if (usersErr) console.error(usersErr);
  else console.log(users.users.map(u => ({ id: u.id, email: u.email })));
}

main().catch(console.error);
