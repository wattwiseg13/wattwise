import { useState } from "react";
import { technicians } from "@/mock/technicians";
import { useAlerts } from "@/store/alertsStore";
import { toast } from "sonner";
import { X } from "lucide-react";

export function DispatchModal({
  open, onClose, meterId, address, alertId, summary,
}: {
  open: boolean; onClose: () => void; meterId: string; address: string;
  alertId?: string; summary?: string;
}) {
  const [techId, setTechId] = useState(technicians[0].id);
  const [priority, setPriority] = useState<"urgent" | "normal" | "low">("urgent");
  const [notes, setNotes] = useState("");
  const assign = useAlerts((s) => s.assign);

  if (!open) return null;

  const submit = () => {
    const jobId = `NXM-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const tech = technicians.find((t) => t.id === techId)!;
    if (alertId) assign(alertId, tech.name, jobId);
    toast.success(`Technician dispatched · Job #${jobId} created`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-semibold">Dispatch Technician</h3>
            <p className="text-xs text-muted-foreground mt-0.5"><span className="font-mono">{meterId}</span> · {address}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {summary && (
            <div className="text-xs bg-coral-100 text-coral-600 border border-coral/30 rounded-lg p-3">
              {summary}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5">Technician</label>
            <select value={techId} onChange={(e) => setTechId(e.target.value)} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background">
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {t.activeJobs} active</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Priority</label>
            <div className="flex gap-2">
              {(["urgent", "normal", "low"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border capitalize transition-colors ${
                    priority === p
                      ? p === "urgent" ? "bg-coral text-white border-coral"
                        : p === "normal" ? "bg-amber text-white border-amber"
                        : "bg-teal text-white border-teal"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                >{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5">Instructions</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} placeholder="Approach with caution. Check seal first…"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
          <button onClick={submit} className="flex-1 px-4 py-2 text-sm rounded-lg bg-teal text-navy font-semibold hover:bg-teal-600">Dispatch</button>
        </div>
      </div>
    </div>
  );
}
