"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Flame, ShieldAlert, HeartPulse, PhoneCall, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EmergencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units?: Array<{ id: string; number: string }>;
  onSuccess?: () => void;
}

const EMERGENCY_TYPES = [
  {
    id: "MEDICAL",
    label: "Medical Emergency",
    desc: "Ambulance, sudden illness, cardiac, injury",
    icon: HeartPulse,
    color: "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
  },
  {
    id: "FIRE",
    label: "Fire Alert",
    desc: "Smoke, electrical fire, kitchen fire, gas leak",
    icon: Flame,
    color: "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400",
  },
  {
    id: "LIFT",
    label: "Lift / Elevator Stuck",
    desc: "Passenger trapped inside elevator car",
    icon: AlertCircle,
    color: "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  },
  {
    id: "SECURITY",
    label: "Security Incident",
    desc: "Intruder, gate breach, altercation, theft",
    icon: ShieldAlert,
    color: "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400",
  },
];

export function EmergencyModal({ open, onOpenChange, units = [], onSuccess }: EmergencyModalProps) {
  const [type, setType] = useState("MEDICAL");
  const [unitId, setUnitId] = useState(units[0]?.id || "");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          unitId: unitId || undefined,
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to raise emergency alert");

      setSubmittedId(data.id);
      toast.error(`🚨 Emergency alert sounded! Guards & Admins notified.`, { duration: 8000 });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Could not sound alert");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSubmittedId(null);
    setDescription("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!loading) { onOpenChange(val); if (!val) setSubmittedId(null); } }}>
      <DialogContent className="sm:max-w-md">
        {submittedId ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <CheckCircle2 className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl text-red-600 dark:text-red-400">Emergency Alert Broadcasted</DialogTitle>
              <DialogDescription>
                Security personnel, society staff, and estate managers have received an instant broadcast on their consoles.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/50 p-3 text-left text-xs space-y-1">
              <p><span className="font-semibold">Alert Reference:</span> {submittedId.slice(0, 13)}</p>
              <p><span className="font-semibold">Category:</span> {type}</p>
              {description && <p><span className="font-semibold">Note:</span> {description}</p>}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Immediate Emergency Helpline</p>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:108" className="flex items-center justify-center gap-2 rounded-lg border bg-card p-2 text-xs font-medium hover:bg-muted">
                  <PhoneCall className="h-3.5 w-3.5 text-red-600" /> Ambulance (108)
                </a>
                <a href="tel:101" className="flex items-center justify-center gap-2 rounded-lg border bg-card p-2 text-xs font-medium hover:bg-muted">
                  <PhoneCall className="h-3.5 w-3.5 text-orange-600" /> Fire Service (101)
                </a>
                <a href="tel:100" className="flex items-center justify-center gap-2 rounded-lg border bg-card p-2 text-xs font-medium hover:bg-muted">
                  <PhoneCall className="h-3.5 w-3.5 text-blue-600" /> Police (100)
                </a>
                <a href="tel:112" className="flex items-center justify-center gap-2 rounded-lg border bg-card p-2 text-xs font-medium hover:bg-muted">
                  <PhoneCall className="h-3.5 w-3.5 text-purple-600" /> National Emergency (112)
                </a>
              </div>
            </div>

            <Button onClick={handleReset} className="w-full mt-4" variant="outline">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" /> Raise Emergency Alert
              </DialogTitle>
              <DialogDescription>
                Trigger an urgent panic broadcast to all gate guards, security supervisors, and society administrators.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emergency Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {EMERGENCY_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = type === t.id;
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected ? `${t.color} border-2 shadow-sm` : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <span className="text-xs font-semibold">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-1">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {units.length > 1 && (
              <div className="space-y-1">
                <Label htmlFor="unit-select" className="text-xs">Select Flat / Unit</Label>
                <select
                  id="unit-select"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>Unit {u.number}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="emergency-notes" className="text-xs">Details / Specific Location (Optional)</Label>
              <Input
                id="emergency-notes"
                placeholder="e.g. Tower B, 4th floor corridor, smoke coming from meter box"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-semibold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Sounding Alarm...
                  </>
                ) : (
                  "🚨 Sound Alarm Now"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
