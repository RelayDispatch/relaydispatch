import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'How It Works', href: '#strategy' },
  { label: 'The Problem', href: '#efficiency' },
  { label: 'Security', href: '#integrity' },
  { label: 'Get Started', href: '#pilot' },
];

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 w-full z-50 bg-bg-main/80 backdrop-blur-xl border-b border-border h-20">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 h-full flex justify-between items-center">
        <div className="flex items-center gap-16">
          <a href="/" className="font-serif text-3xl font-bold tracking-tighter text-ink-primary">
            RelayDispatch<span className="text-accent">.</span>
          </a>
          <div className="hidden lg:flex items-center gap-10">
            {NAV_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-secondary hover:text-accent transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/dashboard')}
            className="bg-transparent border border-border text-ink-primary px-5 py-2.5 rounded-md text-[11px] font-bold tracking-[0.15em] hover:border-accent hover:text-accent transition-all uppercase"
          >
            Client Login
          </motion.button>
          <motion.a
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            href="#pilot"
            className="bg-ink-primary text-white px-6 py-3 rounded-md text-[11px] font-bold tracking-[0.15em] hover:bg-accent transition-all uppercase"
          >
            Request Onboarding
          </motion.a>
        </div>
      </div>
    </nav>
  );
}

