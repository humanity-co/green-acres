"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Wrench } from "lucide-react";
import { toast } from "sonner";

export default function NewTicket() {
  const router = useRouter();
  const [units, setUnits] = useState<any[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    unitId: "",
    category: "Plumbing",
    title: "",
    description: "",
    priority: "MEDIUM",
  });

  useEffect(() => {
    async function loadUnits() {
      try {
        // Priority: Fetch current user's registered units first
        const meRes = await fetch("/api/me/units");
        const meData = await meRes.json();
        if (Array.isArray(meData) && meData.length > 0) {
          const mapped = meData.map((item: any) => item.unit || item);
          setUnits(mapped);
          setForm((f) => ({ ...f, unitId: mapped[0].id }));
          return;
        }

        // Fallback for staff / admins without a resident unit
        const allRes = await fetch("/api/units");
        const allData = await allRes.json();
        if (Array.isArray(allData) && allData.length > 0) {
          setUnits(allData);
          setForm((f) => ({ ...f, unitId: allData[0].id }));
        }
      } catch (err) {
        console.error("Failed to load units:", err);
      } finally {
        setLoadingUnits(false);
      }
    }
    loadUnits();
  }, []);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!form.unitId) {
      setErrorMessage("Please select a flat/unit to file this complaint.");
      return toast.error("Unit selection is required");
    }
    if (!form.title.trim()) {
      setErrorMessage("Please enter a complaint title or issue summary.");
      return toast.error("Title is required");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/helpdesk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create complaint ticket");
      }
      toast.success("Ticket filed successfully!");
      router.push(`/helpdesk/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create ticket");
      toast.error(err.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <PageHeader
          title="New Complaint"
          description="Describe the issue • assigned directly to society facility staff"
        />

        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <span>Create Helpdesk Ticket</span>
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-medium ml-2">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="unit-select" className="text-xs font-semibold">
                  Unit / Flat *
                </Label>
                {loadingUnits ? (
                  <div className="h-10 rounded-md border border-input bg-muted/40 animate-pulse flex items-center px-3 text-xs text-muted-foreground">
                    Loading registered units...
                  </div>
                ) : units.length === 0 ? (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium">
                    No registered units found for your account in this society.
                  </div>
                ) : (
                  <Select
                    value={form.unitId}
                    onValueChange={(v) => {
                      setErrorMessage(null);
                      setForm({ ...form, unitId: v });
                    }}
                  >
                    <SelectTrigger id="unit-select" className="h-10 text-xs">
                      <SelectValue placeholder="Select flat / unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((u: any) => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">
                          Unit {u.number} • {u.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category-select" className="text-xs font-semibold">
                    Category *
                  </Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger id="category-select" className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Plumbing" className="text-xs">Plumbing</SelectItem>
                      <SelectItem value="Electrical" className="text-xs">Electrical</SelectItem>
                      <SelectItem value="Cleaning" className="text-xs">Cleaning</SelectItem>
                      <SelectItem value="Security" className="text-xs">Security</SelectItem>
                      <SelectItem value="Carpentry" className="text-xs">Carpentry</SelectItem>
                      <SelectItem value="Other" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="priority-select" className="text-xs font-semibold">
                    Priority
                  </Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v })}
                  >
                    <SelectTrigger id="priority-select" className="h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW" className="text-xs">Low (Routine)</SelectItem>
                      <SelectItem value="MEDIUM" className="text-xs">Medium (Standard)</SelectItem>
                      <SelectItem value="HIGH" className="text-xs">High (Prompt)</SelectItem>
                      <SelectItem value="URGENT" className="text-xs">Urgent (Emergency)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket-title" className="text-xs font-semibold">
                  Title / Summary *
                </Label>
                <Input
                  id="ticket-title"
                  value={form.title}
                  onChange={(e) => {
                    setErrorMessage(null);
                    setForm({ ...form, title: e.target.value });
                  }}
                  placeholder="e.g. Water leakage in main balcony drain"
                  maxLength={200}
                  className="h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket-desc" className="text-xs font-semibold">
                  Description
                </Label>
                <Textarea
                  id="ticket-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe location, observations, when it started, and availability for technician inspection..."
                  rows={4}
                  maxLength={2000}
                  className="text-xs resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={submitting || loadingUnits || !form.unitId || !form.title.trim()}
                  className="h-9 px-4 text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Creating Ticket...
                    </>
                  ) : (
                    "Create Ticket"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => router.push("/helpdesk")}
                  className="h-9 px-4 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
