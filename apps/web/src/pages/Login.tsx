import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth.tsx";
import { Shield, Loader2, ArrowRight } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const sanitizedEmail = email.replace(/^["']|["']$/g, "").trim();
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      navigate("/dashboard");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || "Invalid login credentials.");
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
            <Shield size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center">
            Sign in to <span className="text-accent-primary font-light italic">RelayDispatch</span>
          </h1>
          <p className="text-text-secondary text-xs mt-2 font-mono uppercase tracking-widest">
            Autonomous Dispatch Systems
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
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
              placeholder="operations@RelayDispatch.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">
              Security Phrase / Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-void border border-border-dim focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 rounded-md py-3 px-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted"
              placeholder="••••••••••••"
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
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Establish Connection</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-border-dim pt-6">
          <p className="text-text-secondary text-xs">
            Don't have an operator console?{" "}
            <Link to="/signup" className="text-accent-primary hover:underline font-medium">
              Create an organization
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

