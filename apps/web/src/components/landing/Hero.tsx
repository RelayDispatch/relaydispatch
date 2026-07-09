import { motion } from 'motion/react';
import LiveFeed from './LiveFeed';

const ease = [0.16, 1, 0.3, 1] as const;

export default function Hero() {
  return (
    <section id="strategy" className="relative pt-40 pb-20 md:pt-56 md:pb-32 overflow-hidden textured-bg">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20 items-center">
          <div className="lg:col-span-12 xl:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
              className="flex items-center gap-6 mb-12"
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_10px_rgba(192,57,43,0.3)]" />
                <span className="font-mono text-[10px] font-bold text-ink-primary tracking-[0.3em] uppercase">AI Email Dispatch</span>
              </div>
              <div className="h-4 w-[1px] bg-border" />
              <div className="font-mono text-[10px] font-bold text-gold tracking-[0.3em] uppercase">
                Est. MMXXVI
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="display-heading mb-12"
            >
              Your jobs <span className="italic font-normal opacity-50">book</span> themselves. <br />
              <motion.span
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, duration: 1, ease }}
                className="text-accent italic font-normal"
              >
                While you sleep.
              </motion.span>
            </motion.h1>

            <div className="flex flex-col md:flex-row md:items-end gap-16 md:gap-24">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease }}
                className="text-lg md:text-2xl text-ink-secondary font-light leading-relaxed max-w-xl"
              >
                RelayDispatch reads your customer emails, understands the job, and books a technician — automatically. Stop losing leads to slow response times.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.6, ease }}
                className="flex flex-col gap-4 self-start md:self-end"
              >
                <a href="#pilot" className="bg-ink-primary text-white px-10 py-5 rounded-md font-bold text-xs uppercase tracking-widest hover:bg-accent transition-all active:scale-95 shadow-2xl shadow-black/20">
                  Request Private Onboarding
                </a>
                <a
                  href="#efficiency"
                  className="bg-transparent border border-border text-ink-primary px-10 py-5 rounded-md font-bold text-xs uppercase tracking-widest hover:border-gold transition-all active:scale-95"
                >
                  See the Data
                </a>
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1.2, ease }}
            className="lg:col-span-12 xl:col-span-4 relative mt-12 xl:mt-0"
          >
            <LiveFeed />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-32 pt-12 border-t border-border flex flex-wrap items-center gap-x-20 gap-y-10"
        >
          <div className="space-y-2">
            <div className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Response Time</div>
            <div className="font-mono text-xs font-bold text-ink-primary">&lt; 60 Seconds</div>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Availability</div>
            <div className="font-mono text-xs font-bold text-ink-primary">24/7 Always-On</div>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Data Security</div>
            <div className="font-mono text-xs font-bold text-green-success uppercase">End-to-End Encrypted</div>
          </div>
          <div className="space-y-2 ml-auto">
            <div className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Pilot Slots</div>
            <div className="font-mono text-xs font-bold text-ink-primary tabular-nums">Q3 2026 — Limited</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

