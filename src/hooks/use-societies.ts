"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Society } from "@/lib/db/schema";
export function useSocieties() {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    fetch("/api/societies").then(r => r.json()).then(setSocieties).catch(() => toast.error("Failed to load societies")).finally(() => setLoading(false));
  }, []);
  async function create(data: Partial<Society>) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/societies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      const item: Society = await res.json();
      setSocieties(prev => [item, ...prev]);
      toast.success("Society created");
      return item;
    } catch { toast.error("Failed to create society"); } finally { setSubmitting(false); }
  }
  async function remove(id: string) {
    try { const res = await fetch(`/api/societies/${id}`, { method: "DELETE" }); if (!res.ok) throw new Error(); setSocieties(prev => prev.filter(s => s.id !== id)); toast.success("Society deleted"); } catch { toast.error("Failed to delete"); }
  }
  return { societies, loading, submitting, create, remove };
}
