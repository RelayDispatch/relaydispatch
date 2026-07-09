import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, description?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (title: string, description?: string) => addToast("success", title, description),
    error: (title: string, description?: string) => addToast("error", title, description),
    warning: (title: string, description?: string) => addToast("warning", title, description),
    info: (title: string, description?: string) => addToast("info", title, description),
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  };

  const borders = {
    success: "border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] bg-green-500/5",
    error: "border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)] bg-red-500/5",
    warning: "border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-amber-500/5",
    info: "border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] bg-blue-500/5",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Floating toasts container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3.5 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className={cn(
                "w-full bg-bg-raised/90 backdrop-blur-md border rounded-xl p-4 flex gap-3 pointer-events-auto shadow-2xl relative overflow-hidden",
                borders[t.type]
              )}
            >
              {/* Type icon */}
              {icons[t.type]}

              {/* Text content */}
              <div className="flex-1 space-y-1 pr-4">
                <h4 className="text-xs font-bold text-text-primary leading-tight">
                  {t.title}
                </h4>
                {t.description && (
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(t.id)}
                className="absolute top-3 right-3 p-1 rounded bg-bg-inset/40 hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-all cursor-pointer"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
