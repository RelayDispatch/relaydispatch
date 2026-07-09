import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Resetting passwords for local test accounts...");

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    throw usersErr;
  }

  const users = usersData.users;
  const newPassword = "password123";

  for (const user of users) {
    console.log(`Resetting password for ${user.email} to: ${newPassword}`);
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateErr) {
      console.error(`Failed to update password for ${user.email}: ${updateErr.message}`);
    } else {
      console.log(`Successfully updated password for ${user.email}.`);
    }
  }
}

main().catch(console.error);
