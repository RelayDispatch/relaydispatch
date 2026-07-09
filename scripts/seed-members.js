import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORG_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  console.log("Seeding organization memberships...");

  // 1. Get all auth users
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    throw usersErr;
  }

  const users = usersData.users;
  console.log(`Found ${users.length} authenticated users.`);

  for (const user of users) {
    console.log(`Checking membership for user: ${user.email} (${user.id})`);

    // Check if membership already exists
    const { data: existing, error: checkErr } = await supabase
      .from("org_members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkErr) {
      console.error(`Error checking membership: ${checkErr.message}`);
      continue;
    }

    if (existing) {
      console.log(`User ${user.email} is already a member.`);
    } else {
      console.log(`Inserting 'owner' membership for ${user.email} in organization: ${ORG_ID}`);
      const { error: insertErr } = await supabase
        .from("org_members")
        .insert({
          org_id: ORG_ID,
          user_id: user.id,
          role: "owner"
        });

      if (insertErr) {
        console.error(`Failed to insert membership: ${insertErr.message}`);
      } else {
        console.log(`Successfully registered ${user.email} as owner.`);
      }
    }
  }

  // 2. Also, let's make sure we have at least a couple of technicians and pricing rules seeded so that the UI is extremely rich!
  console.log("\nChecking technicians...");
  const { data: techs, error: techsErr } = await supabase
    .from("technicians")
    .select("id");

  if (!techsErr && (!techs || techs.length === 0)) {
    console.log("No technicians found. Seeding default technicians...");
    const defaultTechs = [
      {
        org_id: ORG_ID,
        name: "Marcus Thorne",
        skills: ["hvac", "diagnostics", "repair"],
        is_active: true
      },
      {
        org_id: ORG_ID,
        name: "Sarah Lin",
        skills: ["electrical", "boilers", "triage"],
        is_active: true
      },
      {
        org_id: ORG_ID,
        name: "David Miller",
        skills: ["ventilation", "ducts", "maintenance"],
        is_active: true
      }
    ];

    const { error: insertTechErr } = await supabase
      .from("technicians")
      .insert(defaultTechs);

    if (insertTechErr) {
      console.error(`Failed to seed technicians: ${insertTechErr.message}`);
    } else {
      console.log("Successfully seeded default technicians.");
    }
  } else {
    console.log("Technicians already present.");
  }
}

main().catch(console.error);
