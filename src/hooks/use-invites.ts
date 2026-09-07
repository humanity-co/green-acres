"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { VisitorInvite } from "@/lib/db/schema";
export function useInvites() {
  const [invites, setInvites] = useState<VisitorInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    fetch("/api/invites").then(r => r.json()).then(setInvites).catch(() => toast.error("Failed to load invites")).finally(() => setLoading(false));
  }, []);
  async function create(data: any) {
    setSubmitting(true);
    try { const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!res.ok) throw new Error(); const item: VisitorInvite = await res.json(); setInvites(prev => [item, ...prev]); toast.success("Invite created"); return item; } catch { toast.error("Failed to create invite"); } finally { setSubmitting(false); }
  }
  return { invites, loading, submitting, create };
}
