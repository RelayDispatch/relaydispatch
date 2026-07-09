import { motion } from 'motion/react';
import { useState } from 'react';

export default function ROICalculator() {
  const [ticketValue, setTicketValue] = useState(850);
  const [missedLeads, setMissedLeads] = useState(45);
  const [dispatchers, setDispatchers] = useState(2);
  const [laborCost, setLaborCost] = useState(5200);

  const monthlyLeak = ticketValue * missedLeads;
  const dispatchOverhead = dispatchers * laborCost;
  const efficiencyGain = (monthlyLeak + dispatchOverhead) * 0.15;
  const netAnnualUplift = (monthlyLeak + dispatchOverhead + (efficiencyGain / 12)) * 12;

  return (
    <section id="efficiency" className="bg-surface/50 py-32 md:py-48 border-y border-border overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-32 items-start">
          <div className="space-y-16">
            <div>
              <span className="eyebrow-label mb-6 block">Revenue Calculator</span>
              <h2 className="display-heading !text-[clamp(2rem,4vw,4rem)] mb-10 leading-tight">
                See how much you could <span className="italic font-normal opacity-50 underline decoration-accent/30 underline-offset-8">recover.</span>
              </h2>
              <p className="text-xl text-ink-secondary font-light leading-relaxed max-w-sm">
                Every slow email reply is a job given to a competitor. Adjust the numbers to match your business.
              </p>
            </div>

            <div className="space-y-12">
              {[
                { label: 'Average Job Value', value: `$${ticketValue}`, min: 200, max: 5000, step: 50, state: ticketValue, setter: setTicketValue },
                { label: 'Missed Email Leads Per Month', value: `${missedLeads}`, min: 0, max: 500, step: 1, state: missedLeads, setter: setMissedLeads },
                { label: 'Dispatch Staff (Headcount)', value: `${dispatchers}`, min: 1, max: 20, step: 1, state: dispatchers, setter: setDispatchers },
                { label: 'Monthly Staff Cost', value: `$${laborCost.toLocaleString()}`, min: 2000, max: 12000, step: 100, state: laborCost, setter: setLaborCost },
              ].map(({ label, value, min, max, step, state, setter }) => (
                <div key={label} className="space-y-6">
                  <div className="flex justify-between items-end">
                    <label className="font-mono text-[9px] font-bold text-ink-tertiary tracking-[0.2em] uppercase">{label}</label>
                    <div className="font-serif text-3xl text-accent font-bold">{value}</div>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={state}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="w-full h-[2px] bg-border rounded-full appearance-none cursor-pointer accent-accent"
                  />
                </div>
              ))}
            </div>
          </div>

          <motion.div layout className="bg-ink-primary text-white p-12 md:p-20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[120px] rounded-full" />

            <div className="relative z-10 space-y-16">
              <div>
                <span className="font-mono text-[9px] font-bold text-white/40 tracking-[0.3em] uppercase block mb-6">
                  Estimated Annual Recovery
                </span>
                <div className="font-serif text-5xl text-white leading-none">Your Revenue Opportunity</div>
              </div>

              <div className="space-y-10">
                <div className="border-b border-white/10 pb-8 flex justify-between items-end">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Revenue from Missed Emails</span>
                    <span className="text-sm font-medium text-white/60">Jobs you're currently not booking</span>
                  </div>
                  <span className="font-mono text-2xl text-white font-bold">${(monthlyLeak * 12).toLocaleString()}</span>
                </div>

                <div className="border-b border-white/10 pb-8 flex justify-between items-end">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Staff Time Saved</span>
                    <span className="text-sm font-medium text-white/60">Manual triage & dispatch overhead</span>
                  </div>
                  <span className="font-mono text-2xl text-white font-bold">${(dispatchOverhead * 12).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center pt-8">
                  <div className="space-y-2">
                    <span className="font-serif text-3xl text-white italic">Net Annual Uplift</span>
                    <span className="text-xs text-white/40 block">Combined efficiency & recovery</span>
                  </div>
                  <motion.span
                    key={netAnnualUplift}
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="font-serif text-6xl text-gold font-bold tabular-nums"
                  >
                    ${netAnnualUplift.toLocaleString()}
                  </motion.span>
                </div>
              </div>

              <a href="#pilot" className="block w-full text-center bg-accent text-white py-6 rounded-sm font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-white hover:text-accent transition-all">
                Get Started — Apply Now
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
