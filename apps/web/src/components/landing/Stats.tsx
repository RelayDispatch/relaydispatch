import { motion } from 'motion/react';

const STATS = [
  {
    value: '67%',
    label: 'Emails Left Unanswered',
    description: 'Of inbound service request emails go unresponded to within the first hour — the window where customers are most likely to book with a competitor.',
  },
  {
    value: '$124k',
    label: 'Annual Revenue Lost',
    description: 'Baseline revenue leak for mid-market HVAC firms from slow or missed email responses, after-hours inquiries, and manual dispatch delays.',
  },
  {
    value: '82%',
    label: 'Overhead Reduction',
    description: 'Reduction in manual triage and dispatch work when RelayDispatch handles the inbox — your team focuses on the job, not the inbox.',
  },
];

export default function Stats() {
  return (
    <section id="efficiency" className="bg-bg-main py-32 border-y border-border">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="max-w-4xl mb-24">
          <span className="eyebrow-label mb-6 block">The Problem</span>
          <h2 className="display-heading !text-[clamp(2.5rem,5vw,5rem)]">
            The email you didn't reply to <span className="italic font-normal opacity-50">just became</span> your competitor's job.
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border border-border bg-surface/30">
          {STATS.map((stat, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              key={i}
              className="p-16 border-r border-border last:border-r-0 hover:bg-white/50 transition-colors"
            >
              <div className="font-serif text-[clamp(4rem,6vw,6rem)] leading-none mb-8 text-accent font-bold">
                {stat.value}
              </div>
              <div className="space-y-4">
                <span className="font-mono text-[10px] font-bold text-ink-tertiary tracking-[0.2em] uppercase block">
                  {stat.label}
                </span>
                <p className="text-base text-ink-secondary leading-relaxed font-medium">
                  {stat.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

