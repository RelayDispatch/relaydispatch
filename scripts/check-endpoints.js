import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testEndpoint(path, token) {
  const url = `http://localhost:3001${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    console.log(`GET ${path} -> Status: ${res.status}`);
    const text = await res.text();
    try {
      console.log(JSON.parse(text));
    } catch {
      console.log(text);
    }
  } catch (err) {
    console.error(`GET ${path} failed to connect: ${err.message}`);
  }
}

async function main() {
  console.log("Signing in to Supabase as test@relaydispatch.com...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "test@relaydispatch.com",
    password: "password123"
  });

  if (error) {
    console.error("Sign in failed:", error.message);
    return;
  }

  const token = data.session.access_token;
  console.log("Successfully logged in! Access token resolved.");

  console.log("\nTesting Hono API Endpoints...");
  await testEndpoint("/api/technicians", token);
  await testEndpoint("/api/pricing", token);
  await testEndpoint("/api/org/settings", token);
  await testEndpoint("/api/org/shadow-status", token);
  await testEndpoint("/api/jobs", token);
  await testEndpoint("/api/alerts", token);
}

main().catch(console.error);
