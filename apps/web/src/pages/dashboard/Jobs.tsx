import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Calendar,
  User,
  MoreVertical,
  ChevronDown,
  Hammer,
  Truck,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Check
} from "lucide-react";
import { cn } from "../../lib/utils";
import { apiClient } from "../../lib/apiClient";
import { useToast } from "../../components/dashboard/Toast";
import type { Job, Technician, JobStatus } from "../../types";

const StatusBadge = ({ status }: { status: JobStatus }) => {
  const configs: Record<JobStatus, { icon: any; class: string; label: string }> = {
    new: { icon: Clock, class: "bg-slate-500/10 text-slate-500 border-slate-500/20", label: "New" },
    triaged: { icon: Clock, class: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", label: "Triaged" },
    ready_for_dispatch: { icon: Clock, class: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Ready" },
    scheduled: { icon: Calendar, class: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Scheduled" },
    assigned: { icon: User, class: "bg-teal-500/10 text-teal-400 border-teal-500/20", label: "Assigned" },
    in_progress: { icon: Hammer, class: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "In Progress" },
    completed: { icon: CheckCircle, class: "bg-green-500/10 text-green-400 border-green-500/20", label: "Completed" },
    cancelled: { icon: X, class: "bg-red-500/10 text-red-400 border-red-500/20", label: "Cancelled" }
  };

  const config = configs[status] || configs.new;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border", config.class)}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
};

export const Jobs: React.FC = () => {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ready" | "assigned" | "in_progress" | "completed">("all");
  
  // Dispatch drawer states
  const [selectedJobForDispatch, setSelectedJobForDispatch] = useState<Job | null>(null);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState("09:00"); // 24h HH:mm

  const [dispatching, setDispatching] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  
  // Status transition states
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsRes, techsRes] = await Promise.all([
        apiClient.listJobs(),
        apiClient.listTechnicians(),
      ]);
      setJobs(jobsRes.jobs || []);
      setTechnicians(techsRes.technicians || []);
    } catch (err: any) {
      console.error("Failed to load jobs/techs:", err);
      setError("Unable to load jobs. Please refresh the page. If the problem persists, contact uzair.shaikh.sec@outlook.com");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to manual job creation from global topbar
    window.addEventListener("manual-job-created", loadData);
    return () => {
      window.removeEventListener("manual-job-created", loadData);
    };
  }, []);

  // When dispatching drawer opens, generate a unique idempotency key
  const handleOpenDispatch = (job: Job) => {
    setSelectedJobForDispatch(job);
    setSelectedTechId(technicians[0]?.id || "");
    // Default to tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split("T")[0]);
    setScheduledTimeSlot("09:00 AM");
    setIdempotencyKey(Math.random().toString(36).substring(2, 15).toUpperCase());
  };

  const handleCloseDispatch = () => {
    setSelectedJobForDispatch(null);
    setSelectedTechId("");
    setScheduledDate("");
    setScheduledTimeSlot("09:00");
    setIdempotencyKey("");
  };


  // Submit dispatch action
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobForDispatch || !selectedTechId || !scheduledDate) return;
    
    setDispatching(true);
    const tech = technicians.find(t => t.id === selectedTechId);
    
    const scheduledIso = new Date(`${scheduledDate}T${scheduledTimeSlot}:00`).toISOString();

    
    try {
      await apiClient.dispatchJob(
        selectedJobForDispatch.id,
        {
          technician_id: selectedTechId,
          scheduled_at: scheduledIso,
          // Enforce expected workload snapshot to prevent drift
          expected_technician_open_jobs: tech?.active_assigned_jobs ?? 0
        },
        idempotencyKey
      );
      
      toast.success("Job Dispatched", "Job successfully scheduled and assigned.");
      handleCloseDispatch();
      await loadData();
    } catch (err: any) {
      toast.error("Dispatch Failed", err.message);
    } finally {
      setDispatching(false);
    }
  };

  // Transition job status (in_progress, completed, etc.)
  const handleStatusTransition = async (jobId: string, newStatus: JobStatus) => {
    setUpdatingStatusId(jobId);
    const jobKey = Math.random().toString(36).substring(2, 15).toUpperCase();
    try {
      await apiClient.updateJobStatus(
        jobId,
        {
          status: newStatus
        },
        jobKey
      );
      await loadData();
      toast.success("Status Updated", "Job advanced successfully.");
    } catch (err: any) {
      toast.error("Transition Failed", err.message);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Aggregates calculation
  const totalActiveJobs = jobs.filter(j => j.status !== "completed" && j.status !== "cancelled").length;
  const totalUnassigned = jobs.filter(j => j.status === "ready_for_dispatch" || j.status === "new" || j.status === "triaged").length;
  const completedToday = jobs.filter(j => j.status === "completed").length;

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (filter === "ready") return job.status === "ready_for_dispatch" || job.status === "new" || job.status === "triaged";
    if (filter === "assigned") return job.status === "assigned" || job.status === "scheduled";
    if (filter === "in_progress") return job.status === "in_progress";
    if (filter === "completed") return job.status === "completed";
    return true; // all
  });

  return (
    <div className="space-y-8 relative overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Active Jobs & Fleet Control</h1>
          <p className="text-text-secondary mt-1 text-sm">Manage dispatching and technician status in real-time.</p>
        </div>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-bg-inset border border-border-dim rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          Refresh Feed
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
          <Loader2 className="animate-spin text-accent-primary mb-4" size={32} />
          <span className="text-xs font-mono tracking-widest uppercase">Opening dispatch ledger...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-6 min-h-0">
          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Active Jobs", value: totalActiveJobs, color: "text-blue-400" },
              { label: "Needs Dispatch", value: totalUnassigned, color: "text-orange-400" },
              { label: "Completed (24h)", value: completedToday, color: "text-green-400" },
              { label: "Average Triage", value: "14m", color: "text-indigo-400" },
            ].map((stat, i) => (
              <div key={i} className="kpi-card !p-4 !rounded-lg bg-bg-raised">
                <p className="text-[10px] uppercase font-bold text-text-muted tracking-widest">{stat.label}</p>
                <p className={cn("text-2xl font-mono mt-1 font-semibold", stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-6 border-b border-border-dim">
            {([
              { key: "all", label: "All Jobs" },
              { key: "ready", label: "Ready for Dispatch" },
              { key: "assigned", label: "Assigned / Scheduled" },
              { key: "in_progress", label: "In Progress" },
              { key: "completed", label: "Completed" }
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  "pb-4 text-[13px] font-medium transition-all relative capitalize outline-none cursor-pointer",
                  filter === tab.key ? "text-accent-primary" : "text-text-secondary hover:text-text-primary"
                )}
              >
                {tab.label}
                {filter === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                )}
              </button>
            ))}
          </div>

          {/* Job Grid */}
          <div className="flex-1 overflow-y-auto subtle-scroll pb-6">
            {filteredJobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredJobs.map((job) => {
                  const isUnassigned = job.status === "ready_for_dispatch" || job.status === "new" || job.status === "triaged";
                  const isAssigned = job.status === "assigned" || job.status === "scheduled";
                  const isInProgress = job.status === "in_progress";
                  const isUpdating = updatingStatusId === job.id;

                  return (
                    <div 
                      key={job.id} 
                      className="glass-panel rounded-xl group hover:border-border-strong transition-all overflow-hidden flex flex-col bg-bg-raised border border-border-dim shadow-md"
                    >
                      {/* Card Header */}
                      <div className="p-5 border-b border-border-dim flex justify-between items-start bg-bg-base/30">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={job.status} />
                            <span className="text-[10px] font-mono text-text-muted">{job.id.substring(0, 8)}</span>
                          </div>
                          <h3 className="text-[13px] font-bold text-text-primary group-hover:text-accent-primary transition-colors line-clamp-1">
                            {job.service_type || "Standard Service"}
                          </h3>
                        </div>
                      </div>

                      {/* Card Details */}
                      <div className="p-5 flex-1 space-y-4">
                        {/* Client details */}
                        <div className="flex items-center gap-3 text-[12px] text-text-secondary">
                          <div className="w-8 h-8 rounded bg-bg-inset flex items-center justify-center border border-border-dim text-text-muted">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest leading-none mb-1">Client Address / Contact</p>
                            <p className="font-medium text-text-primary">
                              {job.contacts?.email || "Residential Customer"}
                            </p>
                          </div>
                        </div>

                        {/* Assignee / Technician details */}
                        <div className="flex items-center gap-3 text-[12px] text-text-secondary">
                          <div className="w-8 h-8 rounded bg-bg-inset flex items-center justify-center border border-border-dim text-text-muted">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest leading-none mb-1">Field Tech</p>
                            <p className={cn("font-medium", job.technicians?.name ? "text-text-primary" : "text-orange-500 italic")}>
                              {job.technicians?.name || "Ready for Dispatch"}
                            </p>
                          </div>
                        </div>

                        {/* Scheduled At details */}
                        {job.scheduled_at && (
                          <div className="flex items-center gap-3 text-[12px] text-text-secondary">
                            <div className="w-8 h-8 rounded bg-bg-inset flex items-center justify-center border border-border-dim text-text-muted">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest leading-none mb-1">Scheduled At</p>
                              <p className="font-mono text-text-primary text-[11px]">
                                {new Date(job.scheduled_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Notes details */}
                        {(() => {
                          const cleanNotes = job.notes
                            ? job.notes
                                // Strip inline [Lifecycle transition to ...] brackets
                                .replace(/\[\s*Lifecycle transition to[^\]]*\]/gi, "")
                                // Also remove any bare lines that start with lifecycle text
                                .split("\n")
                                .filter((line) => !/Lifecycle transition to/i.test(line))
                                .join("\n")
                                .trim()
                            : "";

                          if (!cleanNotes) return null;
                          return (
                            <div className="bg-bg-inset/40 p-3 border border-border-dim/40 rounded text-[11px] text-text-secondary leading-relaxed">
                              <span className="font-bold text-text-muted">Job Notes:</span> {cleanNotes}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="px-5 py-3.5 bg-bg-base/50 border-t border-border-dim flex justify-between items-center">
                        <span className="flex items-center gap-2 text-[10px] font-bold text-text-muted uppercase tracking-wider font-mono">
                          <MapPin className="w-3 h-3 text-accent-primary" />
                          Service Grid
                        </span>

                        <div className="flex items-center gap-2">
                          {isUnassigned && (
                            <button
                              onClick={() => handleOpenDispatch(job)}
                              className="px-3 py-1.5 bg-accent-primary hover:bg-accent-secondary text-bg-void rounded text-[11px] font-bold transition-all cursor-pointer shadow-md"
                            >
                              Dispatch Job
                            </button>
                          )}

                          {isAssigned && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleStatusTransition(job.id, "in_progress")}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            >
                              {isUpdating ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                              Start Job
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleStatusTransition(job.id, "completed")}
                              className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/30 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            >
                              {isUpdating ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                              Complete Job
                            </button>
                          )}

                          {!isUnassigned && job.status !== "completed" && job.status !== "cancelled" && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleOpenDispatch(job)}
                              className="p-1.5 bg-bg-inset border border-border-dim hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded transition-all cursor-pointer"
                              title="Reassign Tech"
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted space-y-2 opacity-50 bg-bg-raised border border-border-dim rounded-xl">
                <Hammer className="w-12 h-12 stroke-1" />
                <p className="text-sm">No jobs match the active filter.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DISPATCH DRAWER (RIGHT SLIDE-OVER) */}
      <AnimatePresence>
        {selectedJobForDispatch && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDispatch}
              className="fixed inset-0 bg-bg-void/60 backdrop-blur-sm z-40 cursor-pointer"
            />

            {/* Slide-over Content */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-full max-w-md bg-bg-raised border-l border-border-dim shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-border-dim flex justify-between items-center bg-bg-base/30">
                <div>
                  <h3 className="font-bold text-text-primary text-base">Dispatch Technician</h3>
                  <p className="text-xs text-text-secondary mt-1">Assign crew and sync workloads</p>
                </div>
                <button
                  onClick={handleCloseDispatch}
                  className="p-1.5 rounded bg-bg-inset hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleDispatchSubmit} className="flex-1 flex flex-col justify-between p-6 overflow-y-auto subtle-scroll">
                <div className="space-y-6">
                  {/* Job Details Recap */}
                  <div className="p-4 bg-bg-inset border border-border-dim rounded-lg space-y-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-text-muted">Job Context</span>
                    <h4 className="font-bold text-text-primary text-sm">
                      {selectedJobForDispatch.service_type || "HVAC Maintenance"}
                    </h4>
                    <p className="text-xs text-text-secondary">
                      Client: {selectedJobForDispatch.contacts?.email || "Residential Customer"}
                    </p>
                  </div>

                  {/* Technician selection */}
                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Select Fleet Technician
                    </label>
                    <div className="space-y-3">
                      {technicians.filter(t => t.is_active).map((tech) => {
                        const isSelected = selectedTechId === tech.id;
                        return (
                          <div
                            key={tech.id}
                            onClick={() => setSelectedTechId(tech.id)}
                            className={cn(
                              "p-4 border rounded-lg cursor-pointer flex justify-between items-center transition-all hover:bg-bg-hover",
                              isSelected 
                                ? "bg-accent-glow/5 border-accent-primary" 
                                : "bg-bg-void/50 border-border-dim"
                            )}
                          >
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-text-primary">{tech.name}</p>
                              <div className="flex items-center gap-1.5">
                                {tech.skills.map((s, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 bg-bg-inset rounded text-[8px] font-mono text-text-muted capitalize">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-mono text-text-muted uppercase font-bold">Active Load</p>
                              <p className={cn("text-sm font-mono font-bold mt-0.5", tech.active_assigned_jobs && tech.active_assigned_jobs >= 3 ? "text-amber-500" : "text-accent-primary")}>
                                {tech.active_assigned_jobs ?? 0} jobs
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Schedule Time */}
                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Scheduled Date & Time
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          type="date"
                          required
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-3 text-xs text-text-primary outline-none transition-all cursor-pointer"
                        />
                      </div>
                        <div>
                          <input
                            type="time"
                            required
                            value={scheduledTimeSlot}
                            onChange={(e) => setScheduledTimeSlot(e.target.value)}
                            className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-3 text-xs text-text-primary outline-none transition-all cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>

                    </div>
                  </div>

                  {/* Idempotency Recap */}
                  <div className="text-[9px] font-mono text-text-muted flex justify-between">
                    <span>TRANSACTION_KEY:</span>
                    <span>{idempotencyKey}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-border-dim">
                  <button
                    type="submit"
                    disabled={dispatching || !selectedTechId || !scheduledDate}
                    className="w-full bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold py-4 rounded-md text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-accent-primary/15"
                  >
                    {dispatching ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        <span>Synchronizing Workloads...</span>
                      </>
                    ) : (
                      <span>Commit Dispatch Assignment</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

