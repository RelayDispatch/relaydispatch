export default function Footer() {
  const currentYear = 2026;

  return (
    <footer className="bg-ink-primary text-white pt-32 pb-12 border-t border-white/5 overflow-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-30" />

      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-20 mb-32">
          <div className="lg:col-span-12 xl:col-span-5 space-y-10">
            <a href="/" className="font-serif text-5xl font-bold tracking-tighter text-white inline-block">
              RelayDispatch<span className="text-accent">.</span>
            </a>
            <p className="text-white/50 text-xl font-light leading-relaxed max-w-sm">
              The AI dispatch engine for HVAC and field service businesses. Stop losing leads. Start booking automatically.
            </p>
          </div>

          <div className="lg:col-span-4 xl:col-span-2 space-y-8">
            <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-[0.2em] block">Product</span>
            <ul className="space-y-4">
              {[
                { label: 'How It Works', href: '#strategy' },
                { label: 'The Problem', href: '#efficiency' },
                { label: 'Security', href: '#integrity' },
                { label: 'Get Started', href: '#pilot' },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm font-medium text-white/70 hover:text-white transition-colors">{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4 xl:col-span-2 space-y-8">
            <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-[0.2em] block">Connect</span>
            <ul className="space-y-4">
              <li>
                <a
                  href="https://www.linkedin.com/company/RelayDispatch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="mailto:uzair.shaikh.sec@outlook.com"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Contact Support
                </a>
              </li>
              <li>
                <a
                  href="mailto:uzair.shaikh.sec@outlook.com"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Sales Inquiries
                </a>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-4 xl:col-span-3 space-y-8">
            <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-[0.2em] block">Platform</span>
            <ul className="space-y-4">
              <li>
                <a href="/privacy" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Privacy Policy</a>
              </li>
              <li>
                <a href="/terms" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Terms of Service</a>
              </li>
              <li>
                <a href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white transition-colors">Client Dashboard</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-12 border-t border-white/5 gap-8">
          <div className="flex items-center gap-10">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] tabular-nums">
              © {currentYear} RelayDispatch All rights reserved.
            </span>
            <div className="flex items-center gap-6">
              <a href="/privacy" className="text-[10px] font-bold text-white/30 uppercase tracking-widest hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms" className="text-[10px] font-bold text-white/30 uppercase tracking-widest hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest">
            Built for HVAC &amp; Field Service Leaders
          </div>
        </div>
      </div>
    </footer>
  );
}

