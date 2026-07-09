import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../lib/apiClient";
import type { Thread, Job, Technician } from "../../types";
import { Loader2, AlertCircle, Clock, Users, CheckCircle } from "lucide-react";

export function Overview() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [threadsRes, jobsRes, techsRes] = await Promise.all([
          apiClient.getThreads(undefined, 100),
          apiClient.listJobs(),
          apiClient.listTechnicians(),
        ]);
        
        setThreads(threadsRes.threads || []);
        setJobs(jobsRes.jobs || []);
        setTechnicians(techsRes.technicians || []);
      } catch (err: any) {
        console.error("Failed to load dashboard aggregates:", err);
        setError("Synchronization issue. Verification of system permissions is recommended.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[50vh] text-text-secondary">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
        <span className="text-xs font-mono tracking-widest mt-4 uppercase">Syncing Dashboard Core...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg flex items-center gap-3">
        <AlertCircle size={20} className="text-red-500" />
        <span>{error}</span>
      </div>
    );
  }

  // Calculate live aggregates
  const openThreads = threads.filter(t => t.status !== "closed");
  const openRequestsCount = openThreads.length;
  
  const urgentPending = threads.filter(t => 
    t.status !== "closed" && (t.priority === "urgent" || t.priority === "emergency" || t.priority === "high")
  );
  
  const activeTechs = technicians.filter(t => t.is_active);
  const activeFleetStr = `${activeTechs.length}/${technicians.length}`;
  const utilizationPct = technicians.length > 0 ? Math.round((activeTechs.length / technicians.length) * 100) : 0;
  
  const completedToday = jobs.filter(j => j.status === "completed").length;

  // Render priority queue: open/new, high/urgent/emergency, sorted by created_at desc
  const priorityQueue = threads
    .filter(t => t.status !== "closed" && (t.priority === "urgent" || t.priority === "emergency" || t.priority === "high"))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Overview</h1>
          <p className="text-text-secondary mt-1 text-sm">
            {openRequestsCount > 0 
              ? `There are ${openRequestsCount} open request channels actively monitored by RelayDispatch AI.` 
              : "System normal. All channels synchronized and quiet."}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-bg-inset border border-border-dim rounded-md text-sm text-text-secondary flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Today: <span className="text-accent-primary font-bold">{jobs.length} Jobs Active</span></span>
          </div>
        </div>
      </div>

      {/* KPI Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="kpi-card space-y-2">
          <div className="flex justify-between items-center text-text-secondary">
            <p className="text-[10px] uppercase tracking-widest font-bold">Open Requests</p>
            <Clock size={14} className="text-accent-primary" />
          </div>
          <p className="text-4xl font-mono text-text-primary font-semibold">{openRequestsCount}</p>
          <p className="text-xs text-text-secondary">Awaiting dispatch triage</p>
        </div>

        <div className="kpi-card urgent-card space-y-2">
          <div className="flex justify-between items-center text-text-secondary">
            <p className="text-[10px] uppercase tracking-widest font-bold">Urgent Pending</p>
            <AlertCircle size={14} className="text-red-500" />
          </div>
          <p className="text-4xl font-mono text-red-500 font-semibold">{urgentPending.length}</p>
          <p className="text-xs text-text-secondary">Requires manual dispatch</p>
        </div>

        <div className="kpi-card space-y-2">
          <div className="flex justify-between items-center text-text-secondary">
            <p className="text-[10px] uppercase tracking-widest font-bold">Active Fleet</p>
            <Users size={14} className="text-accent-primary" />
          </div>
          <p className="text-4xl font-mono text-text-primary font-semibold">{activeFleetStr}</p>
          <p className="text-xs text-text-secondary">{utilizationPct}% active fleet status</p>
        </div>

        <div className="kpi-card space-y-2">
          <div className="flex justify-between items-center text-text-secondary">
            <p className="text-[10px] uppercase tracking-widest font-bold">Completed Today</p>
            <CheckCircle size={14} className="text-accent-primary" />
          </div>
          <p className="text-4xl font-mono text-text-primary font-semibold">{completedToday}</p>
          <p className="text-xs text-text-secondary">Closed operational tickets</p>
        </div>
      </div>

      {/* Priority Queue Panel */}
      <div className="glass-panel rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border-dim bg-bg-base/50 flex justify-between items-center">
          <h3 className="font-bold text-text-primary">Priority Intake Queue</h3>
          <Link to="/dashboard/intake" className="text-xs text-accent-primary hover:underline">
            Open Intake Panel
          </Link>
        </div>
        <div className="divide-y divide-border-dim">
          {priorityQueue.length > 0 ? (
            priorityQueue.map((thread) => {
              const formattedTime = new Date(thread.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <Link
                  key={thread.id}
                  to={`/dashboard/intake?thread=${thread.id}`}
                  className="p-4 hover:bg-bg-hover transition-colors flex items-center gap-4 block"
                >
                  <div className={`w-2 h-2 rounded-full ${thread.priority === "emergency" ? "bg-red-600 animate-ping" : "bg-red-500"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      {thread.subject || "Incoming Support Stream"}
                    </p>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Client: {thread.contacts?.email || "Unknown Contact"} • Requested at {formattedTime}
                    </p>
                  </div>
                  <div className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded text-[9px] text-red-500 font-bold uppercase tracking-wider font-mono">
                    {thread.priority}
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="p-8 text-center text-text-secondary text-sm">
              No critical or high-priority requests requiring immediate human takeover.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

