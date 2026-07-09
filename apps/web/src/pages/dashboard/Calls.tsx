import { motion } from "motion/react";
import { Phone, Bot, PhoneIncoming, Clock, FileText, Zap, Lock } from "lucide-react";

const FEATURES = [
  {
    icon: <PhoneIncoming size={20} />,
    title: "AI-Powered Inbound Handling",
    description: "Every inbound call is triaged by AI in real time. Service type, urgency, and customer intent are extracted before a human ever picks up.",
  },
  {
    icon: <Bot size={20} />,
    title: "Autonomous Booking by Voice",
    description: "The AI can collect job details, confirm availability, and book service appointments end-to-end without any human involvement.",
  },
  {
    icon: <Clock size={20} />,
    title: "24/7 After-Hours Coverage",
    description: "Never miss an emergency call at 2 AM. RelayDispatch Voice handles after-hours calls with the same quality as a live agent.",
  },
  {
    icon: <FileText size={20} />,
    title: "Automatic Call Transcripts",
    description: "Every call is transcribed and summarized. Your team gets a full record of what was said and what action was taken.",
  },
  {
    icon: <Zap size={20} />,
    title: "Instant CRM Sync",
    description: "Voice-booked jobs flow directly into your Jobber or ServiceTitan account — no manual data entry.",
  },
  {
    icon: <Lock size={20} />,
    title: "Compliant Call Recording",
    description: "All recordings are stored with proper consent disclosures and AES-256 encryption, meeting GDPR and CCPA requirements.",
  },
];

export function Calls() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Phone Intelligence</h1>
          <p className="text-text-secondary mt-1 text-sm">
            AI-powered voice handling — coming soon to your dashboard.
          </p>
        </div>
        <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Coming Q4 2026</span>
        </div>
      </div>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative glass-panel rounded-xl overflow-hidden border border-border-dim"
      >
        {/* Gradient glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 p-10 md:p-16 flex flex-col md:flex-row items-center gap-10">
          {/* Icon */}
          <div className="w-24 h-24 rounded-2xl bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center shrink-0">
            <Phone size={40} className="text-accent-primary" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-4">
              <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">In Development</span>
            </div>
            <h2 className="text-3xl font-bold text-text-primary mb-4 tracking-tight">
              RelayDispatch Voice
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed max-w-2xl">
              An always-on AI that answers every call, books jobs, and updates your CRM — automatically. No hold music, no missed calls, no after-hours leads lost.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Feature Grid Preview */}
      <div>
        <p className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-6">What's Coming</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className="glass-panel rounded-lg p-6 space-y-3 border border-border-dim hover:border-accent-primary/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
                {feature.icon}
              </div>
              <h3 className="font-bold text-text-primary text-sm">{feature.title}</h3>
              <p className="text-text-secondary text-xs leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Simulated Call Log Preview */}
      <div className="glass-panel rounded-xl overflow-hidden border border-border-dim">
        <div className="p-5 border-b border-border-dim bg-bg-base/50 flex justify-between items-center">
          <h3 className="font-bold text-text-primary">Example: AI Call Log</h3>
          <span className="text-[10px] font-mono text-text-secondary uppercase tracking-widest opacity-50">Preview only</span>
        </div>
        <div className="divide-y divide-border-dim">
          {[
            { from: '+1 (972) 555-0147', service: 'Emergency AC repair', status: 'Booked', time: 'Today, 11:42 PM', ai: true },
            { from: '+1 (214) 555-0293', service: 'Annual maintenance', status: 'Scheduled', time: 'Today, 10:15 PM', ai: true },
            { from: '+1 (469) 555-0082', service: 'Heating system quote', status: 'Follow-up sent', time: 'Today, 9:02 PM', ai: true },
          ].map((call, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4 opacity-60">
              <div className="w-9 h-9 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                <PhoneIncoming size={16} className="text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{call.from}</p>
                <p className="text-xs text-text-secondary">{call.service}</p>
              </div>
              {call.ai && (
                <span className="px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/20 rounded text-[9px] text-accent-primary font-bold uppercase">AI Handled</span>
              )}
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-green-400 uppercase block">{call.status}</span>
                <span className="text-[10px] text-text-tertiary">{call.time}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-5 bg-bg-inset/50 border-t border-border-dim">
          <p className="text-xs text-text-secondary text-center">
            This is a preview of what RelayDispatch Voice will look like in your dashboard.{' '}
            <a href="mailto:uzair.shaikh.sec@outlook.com" className="text-accent-primary hover:underline">Contact us</a> to get early access.
          </p>
        </div>
      </div>
    </div>
  );
}

