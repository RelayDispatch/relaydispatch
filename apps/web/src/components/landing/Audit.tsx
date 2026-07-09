import { motion } from 'motion/react';

const AUDITS = [
  {
    tag: 'Prompt Defense',
    title: 'Adversarial Shielding',
    desc: 'The AI resists attempts to manipulate it into responding outside its intended role — protecting your business from abuse.',
  },
  {
    tag: 'Containment',
    title: 'Domain-Restricted Responses',
    desc: 'Strictly responds only to HVAC and field service topics. Refuses unrelated requests automatically.',
  },
  {
    tag: 'Identity',
    title: 'Session Continuity',
    desc: 'Caller context is maintained throughout multi-message conversations, ensuring accurate follow-up and dispatch.',
  },
  {
    tag: 'Fairness',
    title: 'Unbiased Response Audit',
    desc: 'Response quality is consistent regardless of the customer\'s location, language style, or communication method.',
  },
  {
    tag: 'Privacy',
    title: 'PII Protection',
    desc: 'Customer names, addresses, and contact details are automatically masked before any AI processing occurs.',
  },
  {
    tag: 'Resilience',
    title: 'High-Load Performance',
    desc: 'The platform maintains full responsiveness during peak booking periods — no slowdowns during your busiest hours.',
  }
];

export default function Audit() {
  return (
    <section id="integrity" className="py-32 md:py-48 overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="flex flex-col lg:flex-row justify-between items-end gap-12 mb-24">
          <div className="max-w-2xl">
            <span className="eyebrow-label mb-6 block">Security</span>
            <h2 className="display-heading !text-[clamp(2.5rem,5vw,5rem)] mb-8">
              Adversarially <br /><span className="italic font-normal opacity-50">tested. Always.</span>
            </h2>
            <p className="text-xl text-ink-secondary font-light max-w-md leading-relaxed">
              Our AI is continuously tested against manipulation, edge cases, and bad actors — so it behaves correctly every time.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="font-mono text-[9px] font-bold text-ink-primary tracking-widest uppercase">Encryption Standard</span>
              <span className="font-mono text-[10px] font-bold text-green-success">AES-256-GCM</span>
            </div>
            <div className="w-12 h-[1px] bg-border" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-border bg-white/20">
          {AUDITS.map((audit, i) => (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.8 }}
              key={i}
              className="group p-12 border-r border-b border-border hover:bg-surface transition-all cursor-crosshair relative"
            >
              <div className="flex justify-between items-start mb-12">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-1 rounded-full bg-accent" />
                  <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-accent uppercase">
                    {audit.tag}
                  </span>
                </div>
                <span className="font-mono text-[9px] font-bold text-ink-tertiary opacity-40">0{i + 1}</span>
              </div>

              <h3 className="font-serif text-2xl text-ink-primary mb-4 leading-tight group-hover:text-accent transition-colors">{audit.title}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity font-medium">
                {audit.desc}
              </p>

              <div className="mt-12 pt-6 border-t border-border opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                <span className="font-mono text-[9px] font-bold text-ink-tertiary uppercase tracking-widest">Status: Verified</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
