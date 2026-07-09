import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Sparkles, Briefcase, Mail, Phone, User, FileText } from "lucide-react";
import { apiClient } from "../../lib/apiClient";

interface NewJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const servicePresets = [
  "AC Diagnostic & Triage",
  "AC Refrigerant Recharge",
  "AC Capacitor Replacement",
  "Furnace Diagnostic",
  "Filter Replacement (1 inch)",
  "Filter Replacement (4 inch)",
  "Annual Maintenance assessment",
  "Emergency Leak Triage"
];

export const NewJobModal: React.FC<NewJobModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [serviceType, setServiceType] = useState("");
  const [customServiceType, setCustomServiceType] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    const finalServiceType = serviceType === "custom" ? customServiceType : serviceType;
    if (!finalServiceType) {
      setError("Please select or enter a service type.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.createJob({
        service_type: finalServiceType,
        contactEmail: email.trim(),
        contactName: name.trim() || undefined,
        contactPhone: phone.trim() || undefined,
        notes: notes.trim() || undefined
      });

      // Clear form
      setServiceType("");
      setCustomServiceType("");
      setEmail("");
      setName("");
      setPhone("");
      setNotes("");
      
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Failed to manually create job:", err);
      setError(err.message || "Failed to commit manual job record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bg-void/80 backdrop-blur-md z-[100] cursor-pointer"
          />

          {/* Modal box */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-lg bg-bg-raised/95 border border-border-dim rounded-xl shadow-2xl p-6 relative overflow-hidden pointer-events-auto max-h-[90vh] flex flex-col subtle-scroll"
            >
              {/* Top ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent-glow rounded-full blur-3xl opacity-30 pointer-events-none" />

              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-border-dim mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary text-base">Create Manual Dispatch Job</h3>
                    <p className="text-[11px] text-text-secondary">Bypass AI automated email filters to schedule manually</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded bg-bg-inset hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Error Callout */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 subtle-scroll pr-1">
                {/* Service Type Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                    Service / Issue Type *
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    required
                    className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-2.5 text-xs text-text-primary outline-none transition-all cursor-pointer"
                  >
                    <option value="" disabled>-- Select Service Type Preset --</option>
                    {servicePresets.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                    <option value="custom">Custom Service / Custom Entry...</option>
                  </select>
                </div>

                {/* Custom Service Type Input (if Custom selected) */}
                {serviceType === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-1.5"
                  >
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Custom Service Description *
                    </label>
                    <div className="relative">
                      <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-primary opacity-60" />
                      <input
                        type="text"
                        required
                        value={customServiceType}
                        onChange={(e) => setCustomServiceType(e.target.value)}
                        className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md pl-10 pr-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                        placeholder="e.g. Boiler Heat Exchanger Overhaul"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Client Email Input */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                    Client Contact Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md pl-10 pr-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                      placeholder="client@residential.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Client Name Input */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Client Contact Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md pl-10 pr-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  {/* Client Phone Input */}
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md pl-10 pr-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Job Notes */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                    Internal Operation Notes
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-text-secondary" />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md pl-10 pr-3 py-2 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted resize-none"
                      placeholder="Add detailed directions or compliance requirements..."
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-border-dim flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-2 border border-border-dim rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !email || (!serviceType && !customServiceType)}
                    className="px-5 py-2 bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold rounded-md text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-accent-primary/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" size={13} />
                        <span>Scheduling...</span>
                      </>
                    ) : (
                      <span>Schedule Job</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
