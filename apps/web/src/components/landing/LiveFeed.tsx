import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useRef } from 'react';

const MOCK_EVENTS = [
  {
    id: 1,
    loc: 'Customer Email',
    time: '2:02 AM',
    op: 'Job Booked Automatically',
    desc: 'AC unit not cooling. Tech dispatched for 8:00 AM. Confirmation sent to customer.',
    status: 'DONE',
  },
  {
    id: 2,
    loc: 'Customer Email',
    time: '11:58 PM',
    op: 'Quote Request Triaged',
    desc: 'Commercial HVAC replacement inquiry. Routed to senior technician. Reply sent in 45 seconds.',
    status: 'SENT',
  },
  {
    id: 3,
    loc: 'Customer Email',
    time: '10:45 PM',
    op: 'Follow-Up Scheduled',
    desc: 'Heating system service. Customer replied. Appointment confirmed for Friday 10 AM.',
    status: 'DONE',
  },
];

export default function LiveFeed() {
  const [events, setEvents] = useState(MOCK_EVENTS);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => {
        const next = [...prev];
        const last = next.pop()!;
        return [{ ...last, id: Date.now() }, ...next];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div ref={containerRef} className="bg-ink-primary text-white p-1 rounded-sm shadow-2xl overflow-hidden border border-white/5 relative">
      {/* Scanning Line Effect */}
      <motion.div
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 right-0 h-[1px] bg-accent/20 z-10 pointer-events-none"
      />

      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/2">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] font-bold text-white/40 tracking-[0.3em] uppercase">Live Inbox</span>
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        </div>
        <span className="font-mono text-[9px] font-bold text-gold tracking-[0.2em] uppercase">AI Active</span>
      </div>

      <div className="min-h-[440px] bg-black/20 p-2">
        <AnimatePresence mode="popLayout">
          {events.map((event, i) => (
            <motion.div
              layout
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`p-5 mb-1 border-l border-white/5 hover:bg-white/5 transition-colors group ${i === 0 ? 'bg-white/5' : ''}`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="font-mono text-[10px] font-bold text-accent tracking-widest">{event.loc}</span>
                <span className="font-mono text-[9px] text-white/30 tabular-nums">{event.time}</span>
              </div>
              <div className="font-serif text-sm italic text-white/90 mb-1 opacity-80 group-hover:opacity-100 transition-opacity">
                {event.op}
              </div>
              <p className="font-mono text-[10px] text-white/50 leading-relaxed max-w-[240px]">
                {event.desc}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="w-8 h-[1px] bg-white/10" />
                <span className="font-mono text-[8px] font-bold text-gold/60 uppercase tracking-widest">{event.status}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-2 border-t border-white/5 bg-black/40">
        <div className="p-5 border-r border-white/5">
          <div className="font-mono text-[9px] text-white/30 font-bold uppercase tracking-[0.2em] mb-1">Avg. Response</div>
          <div className="font-mono text-lg font-medium text-white tabular-nums tracking-tighter">&lt; 60s</div>
        </div>
        <div className="p-5">
          <div className="font-mono text-[9px] text-white/30 font-bold uppercase tracking-[0.2em] mb-1">Accuracy</div>
          <div className="font-mono text-lg font-medium text-green-success tabular-nums tracking-tighter">99.2%</div>
        </div>
      </div>
    </div>
  );
}
