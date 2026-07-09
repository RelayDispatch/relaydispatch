import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.tsx";
import { ShieldAlert, Loader2, ArrowRight, Building } from "lucide-react";

export function Signup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Prefill details from pilot application if they exist in sessionStorage
  const [email, setEmail] = useState(() => sessionStorage.getItem("pilot_email") || "");
  const [companyName, setCompanyName] = useState(() => sessionStorage.getItem("pilot_company") || "");
  const [fullName, setFullName] = useState(() => sessionStorage.getItem("pilot_contact") || "");
  
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1); // Step 1: Account details, Step 2: Bootstrapping Org

  // If already authenticated and organization setup is complete, redirect to dashboard
  useEffect(() => {
    if (user && step === 1) {
      navigate("/dashboard");
    }
  }, [user, navigate, step]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Sign up user
      const sanitizedEmail = email.replace(/^["']|["']$/g, "").trim();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) throw new Error("Authentication failed - User not created.");

      setStep(2); // Transition to bootstrapping UI state

      // 2. Create organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: companyName || `${fullName}'s Firm`,
          plan: "starter",
        })
        .select()
        .single();

      if (orgError) throw orgError;
      if (!orgData) throw new Error("Bootstrapping organization failed.");

      // 3. Create org member as Owner
      const { error: memberError } = await supabase
        .from("org_members")
        .insert({
          org_id: orgData.id,
          user_id: authData.user.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      // Clear temporary session items on success
      sessionStorage.removeItem("pilot_email");
      sessionStorage.removeItem("pilot_company");
      sessionStorage.removeItem("pilot_contact");

      // Redirect to dashboard
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Signup / Organization Bootstrapping failed:", err);
      setError(err.message || "Bootstrapping failed. Check permissions.");
      setStep(1); // revert back to form step
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-void text-text-primary flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Neon Accent Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-glow rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-ai-dim rounded-full blur-[100px] pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-bg-raised/70 backdrop-blur-md border border-border-dim rounded-lg p-8 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-full border border-accent-primary/30 flex items-center justify-center text-accent-primary mb-4 bg-accent-primary/5">
            <Building size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center">
            Create your <span className="text-accent-primary font-light italic">Firm Console</span>
          </h1>
          <p className="text-text-secondary text-xs mt-2 font-mono uppercase tracking-widest">
            Bootstrap RelayDispatch Infrastructure
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded font-medium flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-bg-void border border-border-dim focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 rounded-md py-3 px-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted"
                  placeholder="Elizabeth Warren"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
                  Firm / Business Name
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-bg-void border border-border-dim focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 rounded-md py-3 px-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted"
                  placeholder="Elite Climate Systems"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
                Operator Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg-void border border-border-dim focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 rounded-md py-3 px-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted"
                placeholder="operations@elitehvac.com"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
                Console Security Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-void border border-border-dim focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 rounded-md py-3 px-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold py-4 rounded-md text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-accent-primary/10"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Provisioning Account...</span>
                </>
              ) : (
                <>
                  <span>Bootstrap Console</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center py-12 space-y-6">
            <Loader2 className="animate-spin text-accent-primary" size={48} />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-text-primary">Configuring Org Infrastructure</h2>
              <p className="text-text-secondary text-xs mt-2 max-w-xs mx-auto">
                Setting up schemas, establishing your team cluster, and generating cryptographic owner access tokens. Please do not close this window.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center border-t border-border-dim pt-6">
          <p className="text-text-secondary text-xs">
            Already have a console account?{" "}
            <Link to="/login" className="text-accent-primary hover:underline font-medium">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

