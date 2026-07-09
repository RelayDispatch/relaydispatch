import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Plus,
  Trash2,
  Search,
  Mail,
  Phone,
  FileText,
  Loader2,
  AlertCircle,
  Link2,
  CheckCircle,
  X,
  UserPlus
} from "lucide-react";
import { cn } from "../../lib/utils";
import { apiClient } from "../../lib/apiClient";
import { useToast } from "../../components/dashboard/Toast";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  jobber_client_id: string | null;
  created_at: string;
}

export const Clients: React.FC = () => {
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.listContacts();
      setContacts(res.contacts || []);
    } catch (err: any) {
      console.error("Failed to load contacts:", err);
      setError("Unable to load client contacts. Please refresh the page or contact support if this continues.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await apiClient.createContact({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined
      });

      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setIsAddModalOpen(false);
      toast.success("Contact Saved", "Client contact created successfully.");
      await loadContacts();
    } catch (err: any) {
      toast.error("Failed to Create Contact", err.message || "Failed to create client contact.");
      setFormError(err.message || "Failed to create client contact.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete confirmation state
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [deleteContactName, setDeleteContactName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteContact = (id: string, name: string) => {
    setDeleteContactId(id);
    setDeleteContactName(name);
  };

  const confirmDeleteContact = async () => {
    if (!deleteContactId) return;
    setIsDeleting(true);
    try {
      await apiClient.deleteContact(deleteContactId);
      toast.success("Contact Removed", "Client contact deleted successfully.");
      setDeleteContactId(null);
      setDeleteContactName("");
      await loadContacts();
    } catch (err: any) {
      toast.error("Deletion Failed", err.message || "Failed to remove client contact.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered contacts list
  const filteredContacts = contacts.filter((c) => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      c.first_name.toLowerCase().includes(term) ||
      c.last_name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term))
    );
  });

  const totalClients = contacts.length;
  const crmLinkedCount = contacts.filter(c => c.jobber_client_id).length;

  return (
    <div className="space-y-8 relative overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Client Contact Directory</h1>
          <p className="text-text-secondary mt-1 text-sm">Manage CRM client records and coordinate communications metadata.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-accent-primary text-white text-sm font-medium rounded-md hover:bg-accent-secondary transition-colors shadow-lg shadow-accent-primary/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
          <Loader2 className="animate-spin text-accent-primary mb-4" size={32} />
          <span className="text-xs font-mono tracking-widest uppercase">Fetching client registry...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-6 min-h-0">
          {/* KPI Quota cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="kpi-card !p-4 !rounded-lg bg-bg-raised">
              <p className="text-[10px] uppercase font-bold text-text-muted tracking-widest">Total Active Clients</p>
              <p className="text-2xl font-mono mt-1 font-semibold text-accent-primary">{totalClients}</p>
            </div>
            <div className="kpi-card !p-4 !rounded-lg bg-bg-raised">
              <p className="text-[10px] uppercase font-bold text-text-muted tracking-widest">CRM CRM Synced</p>
              <p className="text-2xl font-mono mt-1 font-semibold text-blue-400">
                {crmLinkedCount} <span className="text-xs text-text-secondary">clients</span>
              </p>
            </div>
            <div className="kpi-card !p-4 !rounded-lg bg-bg-raised">
              <p className="text-[10px] uppercase font-bold text-text-muted tracking-widest">Pipeline Health</p>
              <p className="text-2xl font-mono mt-1 font-semibold text-green-400 flex items-center gap-1">
                <CheckCircle size={20} />
                <span>100%</span>
              </p>
            </div>
          </div>

          {/* Search bar & utility */}
          <div className="flex items-center gap-4 bg-bg-raised border border-border-dim rounded-xl p-3 shadow-md">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search clients by name, email, or telephone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-bg-inset border border-border-dim rounded-md pl-10 pr-4 py-2 text-[13px] focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-text-muted text-text-primary"
              />
            </div>
          </div>

          {/* Clients Listing Grid */}
          <div className="flex-1 overflow-y-auto subtle-scroll pb-6">
            {filteredContacts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="glass-panel rounded-xl group hover:border-border-strong transition-all overflow-hidden flex flex-col bg-bg-raised border border-border-dim shadow-md"
                  >
                    {/* Header */}
                    <div className="p-5 border-b border-border-dim flex justify-between items-start bg-bg-base/30">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                          {contact.first_name} {contact.last_name}
                        </h3>
                        <span className="text-[9px] font-mono text-text-muted uppercase">
                          CLIENT_ID: {contact.id.substring(0, 8)}
                        </span>
                      </div>
                      
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase border tracking-wider",
                        contact.jobber_client_id
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {contact.jobber_client_id ? "Jobber Synced" : "Pending CRM"}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="p-5 flex-1 space-y-4">
                      {/* Email */}
                      <div className="flex items-center gap-3 text-[12px] text-text-secondary">
                        <div className="w-8 h-8 rounded bg-bg-inset flex items-center justify-center border border-border-dim text-text-muted">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest leading-none mb-1">Email Mailbox</p>
                          <p className="font-medium text-text-primary truncate">{contact.email}</p>
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-3 text-[12px] text-text-secondary">
                        <div className="w-8 h-8 rounded bg-bg-inset flex items-center justify-center border border-border-dim text-text-muted">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-text-muted tracking-widest leading-none mb-1">Telephone</p>
                          <p className="font-medium text-text-primary">
                            {contact.phone || "No phone listed"}
                          </p>
                        </div>
                      </div>

                      {/* Notes */}
                      {contact.notes && (
                        <div className="bg-bg-inset/40 p-3 border border-border-dim/40 rounded text-[11px] text-text-secondary leading-relaxed flex gap-2">
                          <FileText className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                          <p>
                            <span className="font-bold text-text-muted">Bio Details:</span> {contact.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions footer */}
                    <div className="px-5 py-3 bg-bg-base/50 border-t border-border-dim flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-[9px] font-bold text-text-muted uppercase tracking-wider font-mono">
                        <Link2 className="w-3.5 h-3.5 text-accent-primary" />
                        CRM Core
                      </span>

                      <button
                        onClick={() => handleDeleteContact(contact.id, `${contact.first_name} ${contact.last_name}`)}
                        className="p-1.5 bg-bg-inset hover:bg-red-500/10 text-text-secondary hover:text-red-500 border border-border-dim rounded hover:border-red-500/20 transition-all cursor-pointer"
                        title="Delete Client Record"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted space-y-2 opacity-50 bg-bg-raised border border-border-dim rounded-xl">
                <Users className="w-12 h-12 stroke-1" />
                <p className="text-sm">No clients match your filter query.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD CLIENT MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-bg-void/80 backdrop-blur-md z-[100] cursor-pointer"
            />

            {/* Modal Box */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="w-full max-w-md bg-bg-raised/95 border border-border-dim rounded-xl shadow-2xl p-6 relative overflow-hidden pointer-events-auto"
              >
                {/* Ambient Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-accent-glow rounded-full blur-3xl opacity-30 pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-border-dim mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary text-base">Register Client Contact</h3>
                      <p className="text-[11px] text-text-secondary">Add a new client contact to your directory</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-1.5 rounded bg-bg-inset hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Error Callout */}
                {formError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-2.5 text-xs text-text-primary outline-none transition-all"
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-2.5 text-xs text-text-primary outline-none transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-2.5 text-xs text-text-primary outline-none transition-all"
                      placeholder="john.doe@residential.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-2.5 text-xs text-text-primary outline-none transition-all"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-text-secondary uppercase tracking-widest">
                      Internal Sync Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-bg-void border border-border-dim focus:border-accent-primary rounded-md p-2.5 text-xs text-text-primary outline-none transition-all resize-none"
                      placeholder="Special dispatch instructions..."
                    />
                  </div>

                  <div className="pt-4 border-t border-border-dim flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2 border border-border-dim rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !firstName || !lastName || !email}
                      className="px-5 py-2 bg-accent-primary hover:bg-accent-secondary text-bg-void font-bold rounded-md text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-accent-primary/20"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="animate-spin" size={13} />
                          <span>Registering...</span>
                        </>
                      ) : (
                        <span>Register</span>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteContactId !== null && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isDeleting) {
                  setDeleteContactId(null);
                  setDeleteContactName("");
                }
              }}
              className="fixed inset-0 bg-bg-void/80 backdrop-blur-md z-[100] cursor-pointer"
            />

            {/* Modal Box */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="w-full max-w-md bg-bg-raised/95 border border-red-500/20 rounded-xl shadow-2xl p-6 relative overflow-hidden pointer-events-auto"
              >
                {/* Ambient Red Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-red-500/10 rounded-full blur-3xl opacity-30 pointer-events-none" />

                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-border-dim mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                      <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary text-base">Remove Client Record</h3>
                      <p className="text-[11px] text-text-secondary">This action cannot be undone</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!isDeleting) {
                        setDeleteContactId(null);
                        setDeleteContactName("");
                      }
                    }}
                    className="p-1.5 rounded bg-bg-inset hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4 my-6 text-sm text-text-secondary relative z-10 text-left">
                  <p>
                    Are you sure you want to remove the client contact record for:
                  </p>
                  <div className="p-3 bg-red-500/5 border border-red-500/10 rounded text-center">
                    <span className="font-bold text-text-primary text-base">
                      {deleteContactName}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    This action is destructive and irreversible. The client will be permanently removed from all active dispatches, roster profiles, and pipeline indices.
                  </p>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-border-dim flex justify-end gap-3 relative z-10">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      setDeleteContactId(null);
                      setDeleteContactName("");
                    }}
                    className="px-4 py-2 border border-border-dim rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={confirmDeleteContact}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-md text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/20"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="animate-spin" size={13} />
                        <span>Removing...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        <span>Delete Client</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
