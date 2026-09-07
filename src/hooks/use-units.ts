"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Unit } from "@/lib/db/schema";
export function useUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/units").then(r => r.json()).then(setUnits).catch(() => toast.error("Failed to load units")).finally(() => setLoading(false));
  }, []);
  return { units, loading };
}
