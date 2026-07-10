import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2, Server, ShieldCheck, Cpu } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthenticated } from '../../lib/auth.ts';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../dashboard/Toast';

export default function PilotForm() {
  const toast = useToast();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [appId, setAppId] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');

    const formData = new FormData(e.currentTarget);
    const payload = {
      businessName: String(formData.get('company') || ''),
      contactName: String(formData.get('fullName') || ''),
      phone: String(formData.get('email') || ''), // backend field named 'phone' stores email contact
      software: String(formData.get('crm') || ''),
      weeklyVolume: String(formData.get('volume') || ''),
      consentGranted: formData.get('consent') === 'on',
    };

    try {
      const result = await apiClient.submitPilotApplication(payload);
      if (result.success) {
        setAppId(Math.random().toString(36).substring(2, 11).toUpperCase());
        setStatus('success');

        // Save temporary pilot submission details to sessionStorage for Signup pre-fill
        sessionStorage.setItem('pilot_email', payload.phone);
        sessionStorage.setItem('pilot_company', payload.businessName);
        sessionStorage.setItem('pilot_contact', payload.contactName);
        localStorage.setItem('RelayDispatch_crm', payload.software);

        setAuthenticated();
        setTimeout(() => navigate('/signup'), 2800);
      } else {
        throw new Error(result.message || 'Application failed');
      }
    } catch (error) {
      console.error('Submission failed:', error);
      setStatus('idle');
      toast.error('Submission Failed', error instanceof Error ? error.message : 'Failed to submit application. Please try again or email uzair.shaikh.sec@outlook.com');
    }
  };

  return (
    <section id="pilot" className="py-32 md:py-48 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
          <div className="flex flex-col justify-center">
            <span className="eyebrow-label mb-6 block">Limited Availability</span>
            <h2 className="display-heading !text-[clamp(2.5rem,4vw,4rem)] mb-10 leading-tight">
              Begin your <br /><span className="italic font-normal opacity-50 underline decoration-accent/30 underline-offset-8">autonomous operation.</span>
            </h2>
            <p className="text-xl text-ink-secondary font-light leading-relaxed max-w-lg mb-12">
              We are accepting a limited number of HVAC businesses for Q3 2026 onboarding. Direct setup support and dedicated engineering included.
            </p>

            <ul className="space-y-8">
              {[
                { icon: <Cpu size={20} />, text: 'AI that books and dispatches jobs automatically' },
                { icon: <Server size={20} />, text: 'Connects to your existing software — Jobber, ServiceTitan, and more' },
                { icon: <ShieldCheck size={20} />, text: 'Enterprise-grade security with dedicated onboarding support' },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-5 text-ink-secondary text-sm font-semibold tracking-wide">
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-accent">
                    {item.icon}
                  </div>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface p-12 md:p-20 relative border border-border">
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center py-10"
                >
                  <div className="w-24 h-24 bg-white/50 rounded-full flex items-center justify-center mb-10 border border-border">
                    <CheckCircle2 size={48} className="text-green-success" />
                  </div>
                  <h3 className="font-serif text-4xl text-ink-primary mb-6">Application Received</h3>
                  <p className="text-ink-secondary text-sm mb-8 max-w-xs mx-auto">
                    A member of our team will reach out within 24 business hours to schedule your onboarding call.
                  </p>
                  <div className="bg-white/50 px-10 py-6 border border-border mb-8">
                    <span className="font-mono text-[9px] text-ink-tertiary block mb-2 uppercase font-bold tracking-widest">Reference ID</span>
                    <span className="font-mono text-xl font-bold text-ink-primary tracking-[0.3em] uppercase">{appId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-ink-secondary text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Setting up your dashboard…</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-success animate-pulse" />
                      <span className="font-mono text-[9px] font-bold text-ink-primary uppercase tracking-[0.2em]">Accepting Applications</span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-ink-tertiary opacity-60 uppercase">Q3 2026 Cohort</span>
                  </div>

                  <form className="space-y-8" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Your Name</label>
                        <input
                          name="fullName"
                          required
                          type="text"
                          className="w-full bg-transparent border-b border-border py-3 text-sm outline-none focus:border-accent transition-all font-medium placeholder:text-ink-tertiary/30"
                          placeholder="John Smith"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Business Name</label>
                        <input
                          name="company"
                          required
                          type="text"
                          className="w-full bg-transparent border-b border-border py-3 text-sm outline-none focus:border-accent transition-all font-medium placeholder:text-ink-tertiary/30"
                          placeholder="Premier Climate Systems"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Work Email</label>
                      <input
                        name="email"
                        required
                        type="email"
                        className="w-full bg-transparent border-b border-border py-3 text-sm outline-none focus:border-accent transition-all font-medium placeholder:text-ink-tertiary/30"
                        placeholder="john@premierclimate.com"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Current Software</label>
                        <select
                          name="crm"
                          required
                          className="w-full bg-transparent border-b border-border py-3 text-sm outline-none focus:border-accent transition-all cursor-pointer font-medium appearance-none"
                        >
                          <option value="">Select your CRM...</option>
                          <option value="servicetitan">ServiceTitan</option>
                          <option value="jobber">Jobber</option>
                          <option value="housecallpro">Housecall Pro</option>
                          <option value="other">Other / Custom</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Monthly Call Volume</label>
                        <select
                          name="volume"
                          className="w-full bg-transparent border-b border-border py-3 text-sm outline-none focus:border-accent transition-all cursor-pointer font-medium appearance-none"
                        >
                          <option>50 – 200 calls/month</option>
                          <option>200 – 1,000 calls/month</option>
                          <option>1,000+ calls/month</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mt-4 select-none">
                      <input
                        id="consent"
                        name="consent"
                        required
                        type="checkbox"
                        className="mt-1 accent-accent rounded border-border"
                      />
                      <label htmlFor="consent" className="text-[11px] text-ink-secondary leading-relaxed font-light">
                        I agree to be contacted by RelayDispatch regarding this application. My information will be handled in accordance with the <a href="/privacy" target="_blank" className="underline hover:text-accent font-semibold">Privacy Policy</a>.
                      </label>
                    </div>

                    <motion.button
                      disabled={status === 'loading'}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full bg-ink-primary text-white py-6 rounded-sm font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-accent transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                    >
                      {status === 'loading' ? <Loader2 className="animate-spin" size={16} /> : 'Submit Application'}
                    </motion.button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

