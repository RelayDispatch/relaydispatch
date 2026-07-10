import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Calendar,
  UserCheck,
  ChevronDown
} from "lucide-react";
import { cn } from "../../lib/utils";
import { apiClient } from "../../lib/apiClient";
import { useAuth } from "../../lib/auth.tsx";
import { getSessionToken } from "../../lib/auth.ts";
import { useToast } from "../../components/dashboard/Toast";
import type { Thread, Message, Technician } from "../../types";

export const Intake: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  
  // States
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedThreadDetail, setSelectedThreadDetail] = useState<Thread | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "pending" | "critical">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Action states
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  
  // Manual dispatch / convert to job modal states
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState("09:00 AM");
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Load threads initially
  const loadThreads = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getThreads(undefined, 100);
      setThreads(res.threads || []);
      
      // Auto select first thread if none is selected
      if (res.threads && res.threads.length > 0 && !selectedId) {
        setSelectedId(res.threads[0].id);
      }
    } catch (err: any) {
      console.error("Error loading threads:", err);
      setError("Unable to load messages. Please refresh the page. If the problem persists, contact uzair.shaikh.sec@outlook.com");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  // Fetch thread details when selection changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedThreadDetail(null);
      return;
    }

    async function loadThreadDetail() {
      try {
        setLoadingDetail(true);
        const res = await apiClient.getThread(selectedId!);
        setSelectedThreadDetail(res.thread || null);
      } catch (err) {
        console.error("Error loading thread details:", err);
      } finally {
        setLoadingDetail(false);
      }
    }

    loadThreadDetail();
  }, [selectedId]);

  // Load technicians when dispatch modal is opened
  useEffect(() => {
    if (showDispatchModal) {
      // Default to tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledDate(tomorrow.toISOString().split("T")[0]);
      setScheduledTimeSlot("09:00 AM");
      setIsTimeDropdownOpen(false);

      async function loadTechs() {
        try {
          setLoadingTechs(true);
          const res = await apiClient.listTechnicians();
          setTechnicians(res.technicians || []);
          if (res.technicians && res.technicians.length > 0) {
            setSelectedTechId(res.technicians[0].id);
          }
        } catch (err) {
          console.error("Error loading technicians:", err);
        } finally {
          setLoadingTechs(false);
        }
      }
      loadTechs();
    }
  }, [showDispatchModal]);

  // Action: Takeover
  const handleTakeover = async () => {
    if (!selectedId) return;
    setTakeoverLoading(true);
    try {
      await apiClient.takeoverThread(selectedId, {
        agent_id: user?.id || "manual-operator",
        agent_name: user?.email || "Operator Console",
        reason: "Human dispatcher taking control from intake screen."
      });
      toast.success("Takeover Initiated", "Takeover initiated. Temporal workflow signaled.");
      // Reload thread
      const res = await apiClient.getThread(selectedId);
      setSelectedThreadDetail(res.thread);
    } catch (err: any) {
      toast.error("Takeover Failed", err.message);
    } finally {
      setTakeoverLoading(false);
    }
  };

  // Action: Resolve
  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setResolveLoading(true);
    try {
      await apiClient.resolveThread(selectedId, {
        resolved_by: user?.email || "Operator",
        resolution_note: resolveNote
      });
      setShowResolveModal(false);
      setResolveNote("");
      // Reload list and details
      await loadThreads();
      toast.success("Thread Resolved", "Communication thread successfully closed.");
    } catch (err: any) {
      toast.error("Resolution Failed", err.message);
    } finally {
      setResolveLoading(false);
    }
  };

  const timeSlotMap: Record<string, string> = {
    "08:00 AM": "08:00",
    "09:00 AM": "09:00",
    "10:00 AM": "10:00",
    "11:00 AM": "11:00",
    "12:00 PM": "12:00",
    "01:00 PM": "13:00",
    "02:00 PM": "14:00",
    "03:00 PM": "15:00",
    "04:00 PM": "16:00",
    "05:00 PM": "17:00",
    "06:00 PM": "18:00"
  };

  // Action: Dispatch / Convert to Job
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !selectedTechId || !scheduledDate) return;
    setDispatchLoading(true);

    const time24h = timeSlotMap[scheduledTimeSlot] || "09:00";
    const scheduledIso = new Date(`${scheduledDate}T${time24h}:00`).toISOString();

    try {
      const token = await getSessionToken();
      // Calls manual dispatch endpoint on Hono
      const response = await fetch("http://localhost:3001/api/dispatch/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`
        },
        // We'll call the direct Hono manual dispatch
        body: JSON.stringify({
          threadId: selectedId,
          technicianId: selectedTechId,
          scheduledAt: scheduledIso
        })
      });
      
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Manual dispatch failed");
      }

      setShowDispatchModal(false);
      setSelectedTechId("");
      setScheduledDate("");
      toast.success("Job Dispatched", "Associated thread is now closed.");
      await loadThreads();
    } catch (err: any) {
      toast.error("Manual Dispatch Failed", err.message);
    } finally {
      setDispatchLoading(false);
    }
  };

  // Filter threads
  const filteredThreads = threads.filter((thread) => {
    // Filter type
    if (filterType === "pending" && thread.status === "closed") return false;
    if (filterType === "critical" && (thread.priority !== "urgent" && thread.priority !== "emergency")) return false;

    // Search query
    if (searchQuery.trim()) {
      const matchSubject = thread.subject?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchEmail = thread.contacts?.email?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSubject || matchEmail;
    }

    return true;
  });

  const UrgencyBadge = ({ priority }: { priority: string }) => {
    const colors: Record<string, string> = {
      emergency: "bg-red-500/10 text-red-500 border-red-500/20",
      urgent: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      high: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      normal: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      low: "bg-slate-500/10 text-slate-500 border-slate-500/20"
    };

    return (
      <span className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border", colors[priority] || colors.normal)}>
        {priority}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Intake & Routing</h1>
          <p className="text-text-secondary text-sm">Review Ethan's drafts and classify incoming requests.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Filter inbox..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-bg-inset border border-border-dim rounded-md pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:border-accent-primary/50 text-text-primary placeholder:text-text-muted outline-none transition-all w-60"
            />
          </div>
          <button 
            onClick={() => loadThreads()} 
            className="p-2 bg-bg-inset border border-border-dim rounded-md hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
          <Loader2 className="animate-spin text-accent-primary mb-4" size={32} />
          <span className="text-xs font-mono tracking-widest uppercase">Syncing Comm Clusters...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg flex items-center gap-3">
          <ShieldAlert size={20} className="text-red-500" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-12 gap-6 pb-4">
          {/* Inbox List */}
          <div className="col-span-5 flex flex-col min-h-0 border border-border-dim bg-bg-raised rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border-dim bg-bg-base/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {([
                  { key: "pending", label: "Active" },
                  { key: "all", label: "All Threads" },
                  { key: "critical", label: "Critical" }
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilterType(tab.key)}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest transition-all",
                      filterType === tab.key ? "text-accent-primary font-bold" : "text-text-muted hover:text-text-secondary"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-mono text-text-muted">{filteredThreads.length} channels</span>
            </div>

            <div className="flex-1 overflow-y-auto subtle-scroll divide-y divide-border-dim/50">
              {filteredThreads.length > 0 ? (
                filteredThreads.map((thread) => {
                  const isSelected = selectedId === thread.id;
                  const formattedTime = new Date(thread.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedId(thread.id)}
                      className={cn(
                        "w-full p-4 flex flex-col gap-2 text-left transition-all hover:bg-bg-hover relative",
                        isSelected ? "bg-accent-glow/5 border-l-2 border-l-accent-primary" : ""
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-text-primary text-[13px] truncate pr-4">
                          {thread.contacts?.email || "Inbound Communication"}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono whitespace-nowrap">{formattedTime}</span>
                      </div>
                      <p className="text-[12px] text-text-secondary line-clamp-1 leading-relaxed">
                        {thread.subject || "No subject specified"}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                          <UrgencyBadge priority={thread.priority} />
                          <span className="text-[10px] text-text-muted capitalize font-mono">{thread.channel}</span>
                        </div>
                        <span className="text-[9px] text-text-muted font-mono">{thread.id.substring(0, 8)}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-text-secondary text-sm">
                  No threads matched filter parameters.
                </div>
              )}
            </div>
          </div>

          {/* Detailed View */}
          <div className="col-span-7 flex flex-col min-h-0">
            {loadingDetail ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-secondary bg-bg-raised border border-border-dim rounded-lg">
                <Loader2 className="animate-spin text-accent-primary mb-2" size={24} />
                <span className="text-xs font-mono tracking-widest uppercase">Opening Feed Socket...</span>
              </div>
            ) : selectedThreadDetail ? (
              <div className="flex flex-col h-full space-y-6 min-h-0">
                {/* Header panel */}
                <div className="glass-panel p-5 rounded-lg space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-border-strong flex items-center justify-center font-bold text-text-primary uppercase">
                        {(selectedThreadDetail.contacts?.email || "I")[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-text-primary truncate max-w-sm">
                          {selectedThreadDetail.contacts?.email || "Inbound Stream"}
                        </h3>
                        <p className="text-xs text-text-muted">
                          Subject: {selectedThreadDetail.subject || "Not Specified"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedThreadDetail.status === "closed" ? (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded text-[9px] uppercase font-bold tracking-widest font-mono">
                          RESOLVED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[9px] uppercase font-bold tracking-widest font-mono">
                          ACTIVE INTAKE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI & Messages Split */}
                <div className="flex-1 grid grid-rows-12 gap-4 min-h-0">
                  {/* Messages Feed */}
                  <div className="row-span-7 bg-bg-raised border border-border-dim rounded-lg flex flex-col min-h-0 overflow-hidden">
                    <div className="p-3 border-b border-border-dim bg-bg-base/30 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      Transcript history
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 subtle-scroll space-y-4">
                      {selectedThreadDetail.messages && selectedThreadDetail.messages.length > 0 ? (
                        selectedThreadDetail.messages
                          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                          .map((msg: Message) => {
                            const isInbound = msg.direction === "inbound";
                            return (
                              <div
                                key={msg.id}
                                className={cn("flex flex-col max-w-[80%]", isInbound ? "mr-auto items-start" : "ml-auto items-end")}
                              >
                                <span className="text-[9px] text-text-muted font-mono mb-1">
                                  {isInbound ? "Customer" : msg.role === "agent" ? "Human Dispatcher" : "RelayDispatch AI"}
                                </span>
                                <div
                                  className={cn(
                                    "p-3 rounded-lg text-xs leading-relaxed",
                                    isInbound
                                      ? "bg-bg-inset border border-border-dim text-text-primary"
                                      : msg.role === "agent"
                                      ? "bg-accent-primary text-bg-void font-medium"
                                      : "bg-ai-dim border border-ai-primary/20 text-text-primary"
                                  )}
                                >
                                  {msg.body_text}
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="h-full flex items-center justify-center text-text-muted text-xs italic">
                          No messages registered in this feed.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Classification Card */}
                  <div className="row-span-5 bg-bg-raised border border-border-dim rounded-lg p-5 flex flex-col justify-between min-h-0 overflow-y-auto subtle-scroll">
                    <div className="flex items-center justify-between pb-3 border-b border-border-dim/50">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-ai-primary" />
                        <h4 className="text-[12px] font-bold text-text-primary">Ethan's Classification Engine</h4>
                      </div>
                      {selectedThreadDetail.urgency_score !== undefined && (
                        <div className="text-[10px] font-mono text-text-secondary">
                          Urgency Rank: <span className="text-accent-primary font-bold">{(selectedThreadDetail.urgency_score || 0).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-6 my-4">
                      <div>
                        <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest mb-1">Assigned Priority</p>
                        <UrgencyBadge priority={selectedThreadDetail.priority} />
                      </div>
                      <div>
                        <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest mb-1">Service Category</p>
                        <span className="text-xs text-text-primary capitalize font-mono font-semibold">
                          {selectedThreadDetail.service_category || "Unclassified"}
                        </span>
                      </div>
                    </div>

                    {selectedThreadDetail.status !== "closed" && (
                      <div className="flex gap-3 justify-end pt-2 border-t border-border-dim/50">
                        <button
                          onClick={() => setShowResolveModal(true)}
                          className="px-4 py-2 bg-bg-inset hover:bg-bg-hover border border-border-dim rounded text-text-secondary hover:text-text-primary text-xs font-semibold"
                        >
                          Resolve Channels
                        </button>

                        <button
                          onClick={handleTakeover}
                          disabled={takeoverLoading}
                          className="px-4 py-2 bg-ai-dim hover:bg-ai-primary/20 border border-ai-primary/30 text-text-primary rounded text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
                        >
                          {takeoverLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <UserCheck size={13} className="text-ai-primary" />
                          )}
                          Takeover Control
                        </button>

                        <button
                          onClick={() => setShowDispatchModal(true)}
                          className="px-4 py-2 bg-accent-primary hover:bg-accent-secondary text-bg-void rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          Convert to Job <ArrowRight size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted space-y-2 opacity-50 bg-bg-raised border border-border-dim rounded-lg">
                <MessageSquare className="w-12 h-12 stroke-1 text-text-muted" />
                <p className="text-sm">Select a request thread to begin human routing.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bg-raised border border-border-dim rounded-lg p-6 shadow-2xl space-y-6">
            <h3 className="text-lg font-bold text-text-primary">Resolve & Close Thread</h3>
            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-2">
                  Resolution / Summary Note
                </label>
                <textarea
                  required
                  rows={4}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-3 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                  placeholder="Explain why this request is resolved (e.g. booked manually in other CRM, spam, duplicate, etc.)"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResolveModal(false);
                    setResolveNote("");
                  }}
                  className="px-4 py-2 bg-bg-inset hover:bg-bg-hover rounded text-text-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveLoading}
                  className="px-4 py-2 bg-accent-primary hover:bg-accent-secondary text-bg-void rounded text-xs font-bold flex items-center gap-2"
                >
                  {resolveLoading && <Loader2 size={12} className="animate-spin" />}
                  Archive & Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONVERT TO JOB / DISPATCH MODAL */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-bg-raised border border-border-dim rounded-lg p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-border-dim">
              <h3 className="text-lg font-bold text-text-primary">Manual Tech Dispatch</h3>
              <span className="text-[10px] font-mono text-text-muted">Thread: {selectedId?.substring(0, 8)}</span>
            </div>

            <form onSubmit={handleDispatch} className="space-y-6">
              <div>
                <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-2">
                  Select Field Technician
                </label>
                {loadingTechs ? (
                  <div className="flex items-center gap-2 text-xs text-text-secondary py-3">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Analyzing Fleet availability...</span>
                  </div>
                ) : technicians.length > 0 ? (
                  <select
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md py-3 px-3 text-xs text-text-primary outline-none cursor-pointer"
                  >
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} — Workload: {tech.active_assigned_jobs ?? 0} active jobs (Skills: {tech.skills.join(", ")})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-orange-400 italic">No technicians found. Please add techs in Settings roster.</p>
                )}
              </div>

              <div>
                <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest mb-2">
                  Scheduled Dispatch Time
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md pl-10 pr-3 py-3 text-xs text-text-primary outline-none cursor-pointer"
                    />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                      className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-3 text-xs text-text-primary text-left outline-none transition-all cursor-pointer flex justify-between items-center"
                    >
                      <span>{scheduledTimeSlot}</span>
                      <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform", isTimeDropdownOpen && "rotate-180")} />
                    </button>
                    <AnimatePresence>
                      {isTimeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsTimeDropdownOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto subtle-scroll bg-bg-raised border border-border-strong rounded-lg shadow-xl z-50 p-1"
                          >
                            {["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"].map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  setScheduledTimeSlot(slot);
                                  setIsTimeDropdownOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-xs rounded transition-colors cursor-pointer",
                                  scheduledTimeSlot === slot
                                    ? "bg-accent-primary text-bg-void font-bold"
                                    : "text-text-primary hover:bg-bg-hover"
                                )}
                              >
                                {slot}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border-dim">
                <button
                  type="button"
                  onClick={() => {
                    setShowDispatchModal(false);
                    setSelectedTechId("");
                    setScheduledDate("");
                  }}
                  className="px-4 py-2 bg-bg-inset hover:bg-bg-hover rounded text-text-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatchLoading || !selectedTechId || !scheduledDate}
                  className="px-4 py-2 bg-accent-primary hover:bg-accent-secondary text-bg-void rounded text-xs font-bold flex items-center gap-2"
                >
                  {dispatchLoading && <Loader2 size={12} className="animate-spin" />}
                  Schedule Dispatch & Triage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

