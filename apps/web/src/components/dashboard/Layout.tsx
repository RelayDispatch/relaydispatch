import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  Users,
  Settings,
  Search,
  Bell,
  LogOut,
  Zap,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Loader2,
  Phone
} from "lucide-react";

import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { clearAuthenticated } from "../../lib/auth.ts";
import { apiClient } from "../../lib/apiClient";
import { NewJobModal } from "./NewJobModal";
import { useToast } from "./Toast";

interface LayoutProps {
  children: React.ReactNode;
}

interface AlertItem {
  id: string;
  type: "integration_error" | "hallucination_risk";
  source: string;
  title: string;
  description: string;
  retry_count: number;
  created_at: string;
  resolved: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Inbox, label: "Intake", href: "/dashboard/intake" },
  { icon: Briefcase, label: "Jobs", href: "/dashboard/jobs" },
  { icon: Users, label: "Clients", href: "/dashboard/clients" },
  { icon: Phone, label: "Calls", href: "/dashboard/calls" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];


export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [org, setOrg] = useState<any>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [upgrading] = useState(false);
  const handleUpgrade = () => {
    toast.error(
      "Upgrade Unavailable",
      "Billing and upgrades are managed by your system administrator in this self-hosted deployment."
    );
  };

  const handleLogout = () => {
    clearAuthenticated();
    navigate("/");
  };

  const fetchAlerts = async () => {
    try {
      const res = await apiClient.listAlerts();
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error("Failed to load alerts feed:", err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await apiClient.getOrgSettings();
        setOrg(res.org);
      } catch (err) {
        console.error("Failed to fetch organization settings in Layout:", err);
      }
    };
    fetchOrg();
  }, []);

  // Close alerts popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
    };
    if (isAlertsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAlertsOpen]);

  const handleResolveAlert = async (id: string) => {
    setResolvingId(id);
    try {
      await apiClient.resolveAlert(id);
      await fetchAlerts();
      toast.success("Alert Resolved", "System notification dismissed successfully.");
    } catch (err: any) {
      toast.error("Resolution Failed", err.message);
    } finally {
      setResolvingId(null);
    }
  };

  const activeAlertsCount = alerts.filter(a => !a.resolved).length;

  const handleNewJobSuccess = () => {
    // Notify the Jobs component to reload data if it's currently rendered
    window.dispatchEvent(new CustomEvent("manual-job-created"));
    
    // Auto navigate to the jobs tab so they can see the manual entry
    if (location.pathname !== "/dashboard/jobs") {
      navigate("/dashboard/jobs");
    }
  };

  const isTrialExpired = org && org.plan === 'starter' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date();

  return (
    <div className="flex h-screen bg-bg-void font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border-dim bg-bg-raised flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-[18px] tracking-tight text-text-primary">RelayDispatch</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto subtle-scroll">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-[10px] px-3 py-2 rounded-md transition-all group",
                  isActive
                    ? "bg-accent-glow text-accent-primary"
                    : "text-text-secondary hover:bg-bg-hover"
                )}
              >
                <item.icon className={cn("w-[20px] h-[20px]", isActive ? "text-accent-primary" : "text-text-secondary group-hover:text-text-muted")} />
                <span className="font-medium text-[13px]">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="ml-auto w-1 h-4 bg-accent-primary rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border-dim bg-bg-base/30">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-bg-inset/50">
            <div className="w-8 h-8 rounded-full bg-border-strong flex items-center justify-center font-bold text-xs text-text-primary">
              RD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text-primary truncate">RelayDispatch Client</p>
              <p className="text-[11px] text-text-secondary truncate">Agent Mode</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Topbar */}
        <header className="h-[56px] border-b border-border-dim bg-bg-raised flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search jobs, clients, requests..."
                className="w-full bg-bg-inset border border-border-dim rounded-md pl-10 pr-4 py-1.5 text-[13px] focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-text-muted text-text-primary"
                id="global-search"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* Notification Bell Button */}
            <button
              onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              className="relative p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              id="notifications-btn"
            >
              <Bell className="w-5 h-5" />
              {activeAlertsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-bg-raised animate-pulse"></span>
              )}
            </button>

            {/* Notification Popover Dropdown */}
            <AnimatePresence>
              {isAlertsOpen && (
                <motion.div
                  ref={popoverRef}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-24 top-12 w-96 bg-bg-raised border border-border-dim rounded-xl shadow-2xl p-4 z-[99] flex flex-col overflow-hidden glass-panel"
                >
                  <div className="flex justify-between items-center pb-3 border-b border-border-dim mb-3">
                    <span className="text-xs font-bold text-text-primary">System Compliance Alerts</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                      {activeAlertsCount} Unresolved
                    </span>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-3 subtle-scroll pr-1">
                    {alerts.length > 0 ? (
                      alerts.map((alert) => {
                        const isRisk = alert.type === "hallucination_risk";
                        return (
                          <div
                            key={alert.id}
                            className={cn(
                              "p-3 rounded-lg border flex flex-col gap-2 bg-bg-inset/40",
                              alert.resolved
                                ? "border-border-dim/40 opacity-70"
                                : isRisk
                                ? "border-red-500/20 bg-red-500/5"
                                : "border-amber-500/20 bg-amber-500/5"
                            )}
                          >
                            <div className="flex items-start gap-2.5 justify-between">
                              <div className="flex gap-2">
                                {isRisk ? (
                                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                )}
                                <div className="space-y-0.5">
                                  <h4 className="text-[11px] font-bold text-text-primary leading-tight">
                                    {alert.title}
                                  </h4>
                                  <p className="text-[10px] text-text-muted leading-relaxed">
                                    {alert.description}
                                  </p>
                                </div>
                              </div>

                              {!alert.resolved && !isRisk && (
                                <button
                                  onClick={() => handleResolveAlert(alert.id)}
                                  disabled={resolvingId === alert.id}
                                  className="text-[10px] px-2 py-1 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary hover:bg-accent-primary hover:text-bg-void rounded font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                                >
                                  {resolvingId === alert.id ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  ) : (
                                    "Resolve"
                                  )}
                                </button>
                              )}

                              {isRisk && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold tracking-widest bg-bg-inset border border-border-dim text-text-muted uppercase shrink-0">
                                  Audit
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-mono text-text-muted mt-1 pt-1.5 border-t border-border-dim/20">
                              <span>Source: {alert.source.toUpperCase()}</span>
                              <span>
                                {new Date(alert.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-xs italic text-text-muted flex flex-col items-center gap-2">
                        <CheckCircle className="w-8 h-8 text-green-500 stroke-1" />
                        <span>All integrations operating normally.</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-4 w-px bg-border-dim mx-2"></div>
            
            {/* Global New Job Button */}
            <button
              onClick={() => setIsNewJobModalOpen(true)}
              className="px-4 py-2 bg-accent-primary text-white text-sm font-medium rounded-md hover:bg-accent-secondary transition-colors shadow-lg shadow-accent-primary/20 cursor-pointer"
              id="create-new-btn"
            >
              New Job
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-bg-base subtle-scroll">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-8 max-w-7xl mx-auto w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global Manual Job Modal */}
      <NewJobModal
        isOpen={isNewJobModalOpen}
        onClose={() => setIsNewJobModalOpen(false)}
        onSuccess={handleNewJobSuccess}
      />

      {/* Trial Expired Lock Overlay */}
      {isTrialExpired && (
        <div className="absolute inset-0 bg-bg-void/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-bg-raised border border-border-dim rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center relative overflow-hidden"
          >
            {/* Ambient gold glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-accent-glow rounded-full blur-[60px] pointer-events-none" />
            
            <div className="w-16 h-16 rounded-full bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center text-accent-primary mb-6 relative z-10">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-text-primary mb-3 relative z-10">
              Trial Period Expired
            </h2>
            
            <p className="text-[13px] text-text-secondary leading-relaxed mb-6 relative z-10">
              Your 14-day trial of RelayDispatch AI Dispatcher has ended. To resume instant email triage, automated customer replies, and CRM job dispatches, please upgrade to our Pro plan.
            </p>

            {/* Quota overview */}
            <div className="w-full bg-bg-inset border border-border-dim rounded-xl p-4 mb-6 text-left relative z-10 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Plan</span>
                <span className="font-mono text-text-primary font-bold uppercase">Starter (Trial)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Expiration Date</span>
                <span className="font-mono text-text-primary font-medium">
                  {org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "Expired"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-border-dim/50 pt-2.5">
                <span className="text-text-secondary">Includes</span>
                <span className="text-accent-primary font-medium text-[11px]">Autonomous dispatch + Jobber sync</span>
              </div>
            </div>

            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full py-3.5 bg-accent-primary hover:bg-accent-secondary disabled:opacity-50 text-bg-void font-bold rounded-lg text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-accent-primary/20 mb-3"
            >
              {upgrading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </span>
              ) : (
                <span>Upgrade to Pro ($49/mo)</span>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-2 bg-transparent text-text-secondary hover:text-text-primary text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};
