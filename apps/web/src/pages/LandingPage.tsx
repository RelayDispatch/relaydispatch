import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth.tsx";
import { apiClient } from "../lib/apiClient";
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Stats from '../components/landing/Stats';
import Audit from '../components/landing/Audit';
import ROICalculator from '../components/landing/ROICalculator';
import PilotForm from '../components/landing/PilotForm';
import Footer from '../components/landing/Footer';
import { ShieldAlert, Sparkles } from "lucide-react";

export default function LandingPage() {
  const { user, logout } = useAuth();
  const [org, setOrg] = useState<any>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (user) {
      apiClient.getOrgSettings()
        .then(res => setOrg(res.org))
        .catch(err => console.error("Landing page failed to load org status:", err));
    }
  }, [user]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await apiClient.createCheckoutSession();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      console.error("Failed to create checkout session:", err);
    } finally {
      setUpgrading(false);
    }
  };

  const daysRemaining = (() => {
    if (!org?.trial_ends_at) return 0;
    const diffTime = new Date(org.trial_ends_at).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  })();

  const isExpired = org && org.plan === 'starter' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date();
  const isActiveTrial = org && org.plan === 'starter' && !isExpired;

  return (
    <div className="min-h-screen bg-bg-main selection:bg-gold-soft selection:text-gold">
      {/* Dynamic Trial Banner */}
      {isActiveTrial && (
        <div className="bg-gold/10 border-b border-gold/20 py-2.5 px-6 text-center text-[10px] font-bold tracking-widest text-gold-soft flex items-center justify-center gap-3 z-[100] relative">
          <Sparkles className="w-4 h-4 animate-pulse shrink-0 text-gold-soft" />
          <span>Your free trial is active — {daysRemaining} days remaining. <a href="/dashboard" className="underline font-semibold">Open your dashboard →</a></span>
          <a href="/dashboard" className="px-3 py-1 bg-ink-primary hover:bg-gold text-white hover:text-bg-void rounded font-mono text-[9px] uppercase tracking-wider transition-all shrink-0">
            Go to Dashboard
          </a>
        </div>
      )}

      {isExpired && (
        <div className="bg-red-500/10 border-b border-red-500/20 py-2.5 px-6 text-center text-[10px] font-bold tracking-widest text-red-400 flex items-center justify-center gap-3 z-[100] relative">
          <ShieldAlert className="w-4 h-4 animate-bounce shrink-0 text-red-400" />
          <span>Your trial has ended. Upgrade to continue using RelayDispatch.</span>
          <button 
            onClick={handleUpgrade}
            disabled={upgrading}
            className="px-3 py-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white rounded font-mono text-[9px] uppercase tracking-wider transition-all shrink-0 cursor-pointer"
          >
            {upgrading ? "Processing..." : "Upgrade Now"}
          </button>
          <button 
            onClick={logout}
            className="text-[9px] text-ink-secondary hover:text-ink-primary underline shrink-0 font-mono cursor-pointer uppercase tracking-wider"
          >
            Sign Out
          </button>
        </div>
      )}

      <Navbar />
      <main className={isActiveTrial || isExpired ? "pt-10" : ""}>
        <Hero />
        <Stats />
        <Audit />
        <ROICalculator />
        <PilotForm />
      </main>
      <Footer />
    </div>
  );
}

