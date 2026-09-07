"use client";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Clock, Building2, Users, LogIn, LogOut, Search, UserPlus, QrCode, Phone, MapPin, AlertTriangle, Package, HeartHandshake, Car, Wifi, WifiOff, RefreshCw, FileText, CheckCircle2, XCircle, History, RotateCcw, Trash2 } from "lucide-react";
import {
  cacheApprovedInvites,
  findCachedInvite,
  queueOfflineEntry,
  getPendingOfflineEntries,
  getAllOfflineQueueEntries,
  markEntrySynced,
  markEntryFailed,
  retryFailedEntry,
  dismissFailedEntry,
  clearSyncedEntries,
  cacheActiveInside,
  getCachedInside,
  removeCachedInside,
  cacheDailyHelp,
  getCachedDailyHelp,
  findCachedDailyHelp,
  OfflineEntry,
} from "@/lib/offline/db";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function GuardConsole() {
  const [society, setSociety] = useState<any>(null);
  const [gates, setGates] = useState<any[]>([]);
  const [selectedGate, setSelectedGate] = useState<string>("");
  const [guard, setGuard] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [time, setTime] = useState(new Date());
  const [code, setCode] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [expected, setExpected] = useState<any[]>([]);
  const [inside, setInside] = useState<any[]>([]);
  const [walkin, setWalkin] = useState({ visitorName:"", phone:"", purpose:"Guest", unitId:"" });
  const [residentQuery, setResidentQuery] = useState("");
  const [residentResults, setResidentResults] = useState<any[]>([]);
  const [activeWalkinIndex, setActiveWalkinIndex] = useState(-1);
  const [tab, setTab] = useState("verify");
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [deliveryForm, setDeliveryForm] = useState({ courierName:"", awb:"", unitId:"" });
  const [deliveryQuery, setDeliveryQuery] = useState("");
  const [deliveryResults, setDeliveryResults] = useState<any[]>([]);
  const [activeDeliveryIndex, setActiveDeliveryIndex] = useState(-1);
  const [helpList, setHelpList] = useState<any[]>([]);
  const [helpAttendance, setHelpAttendance] = useState<any[]>([]);
  const [helpQuery, setHelpQuery] = useState("");
  const [helpSearchResults, setHelpSearchResults] = useState<any[]>([]);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleResults, setVehicleResults] = useState<any[]>([]);
  const [vehiclesInside, setVehiclesInside] = useState<any[]>([]);
  const [filterOverstayOnly, setFilterOverstayOnly] = useState(false);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [unitList, setUnitList] = useState<any[]>([]);
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<OfflineEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [manualPassOpen, setManualPassOpen] = useState(false);
  const [manualPassForm, setManualPassForm] = useState({
    name: "",
    phone: "",
    unitId: "",
    purpose: "Delivery / Service",
    vehicleNumber: "",
    notes: "",
  });
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);
  const prevEmergencyCount = useRef<number>(0);

  async function refreshPendingCount() {
    const list = await getPendingOfflineEntries();
    setPendingCount(list.length);
    const all = await getAllOfflineQueueEntries();
    setQueueItems(all);
  }

  async function openSyncDrawer() {
    await refreshPendingCount();
    setSyncDrawerOpen(true);
  }

  async function handleRetryFailed(key: string) {
    await retryFailedEntry(key);
    toast.info("Entry reset to pending status for next sync");
    await refreshPendingCount();
  }

  async function handleDismissFailed(key: string) {
    await dismissFailedEntry(key);
    toast.info("Entry dismissed from queue");
    await refreshPendingCount();
  }

  async function clearSyncedEntriesHandler() {
    await clearSyncedEntries();
    toast.success("Cleared synced entries from local store");
    await refreshPendingCount();
  }

  async function submitManualPass() {
    if (!manualPassForm.name.trim()) return toast.error("Enter visitor name");
    if (!manualPassForm.phone.trim()) return toast.error("Enter phone number");
    if (!manualPassForm.unitId) return toast.error("Select destination unit");

    setIsSubmittingPass(true);
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      name: manualPassForm.name.trim(),
      phone: manualPassForm.phone.trim(),
      unitId: manualPassForm.unitId,
      purpose: manualPassForm.purpose,
      vehicleNumber: manualPassForm.vehicleNumber.trim() || undefined,
      gateId: selectedGate || undefined,
      notes: manualPassForm.notes.trim() || undefined,
      offlineTimestamp: new Date().toISOString(),
      idempotencyKey,
    };

    if (!navigator.onLine) {
      await queueOfflineEntry({
        idempotencyKey,
        entryType: "MANUAL_PASS",
        actionType: "MANUAL_PASS",
        payload,
        notes: `Unit: ${unitList.find(u => u.id === manualPassForm.unitId)?.number || "Flat"} • ${manualPassForm.name}`,
        timestamp: new Date().toISOString(),
      });
      const destUnit = unitList.find(u => u.id === manualPassForm.unitId);
      const newInside: any = {
        entry: { id: idempotencyKey, checkIn: new Date().toISOString(), isOffline: true },
        visitor: { name: manualPassForm.name, phone: manualPassForm.phone, vehicleNumber: manualPassForm.vehicleNumber },
        unit: { number: destUnit?.number || "General" },
        type: "VISITOR",
        isOfflineManual: true,
      };
      setInside(prev => [newInside, ...prev]);
      await refreshPendingCount();
      setIsSubmittingPass(false);
      setManualPassOpen(false);
      setManualPassForm({ name: "", phone: "", unitId: "", purpose: "Delivery / Service", vehicleNumber: "", notes: "" });
      toast.success("Emergency Manual Pass recorded in offline queue. Access granted.");
      return;
    }

    try {
      const res = await fetch("/api/guard/manual-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Failed to create manual pass");
      } else {
        toast.success("Emergency Manual Pass issued. Entry recorded.");
        setManualPassOpen(false);
        setManualPassForm({ name: "", phone: "", unitId: "", purpose: "Delivery / Service", vehicleNumber: "", notes: "" });
        loadInside();
      }
    } catch {
      await queueOfflineEntry({
        idempotencyKey,
        entryType: "MANUAL_PASS",
        actionType: "MANUAL_PASS",
        payload,
        notes: `Unit: ${unitList.find(u => u.id === manualPassForm.unitId)?.number || "Flat"} • ${manualPassForm.name}`,
        timestamp: new Date().toISOString(),
      });
      toast.warning("Network interrupted. Pass saved to offline queue.");
      setManualPassOpen(false);
      refreshPendingCount();
    } finally {
      setIsSubmittingPass(false);
    }
  }

  async function syncOfflineQueue() {
    const list = await getPendingOfflineEntries();
    if (list.length === 0) return;
    setIsSyncing(true);
    toast.info(`Syncing ${list.length} offline operation(s)...`);
    let syncedCount = 0;
    let failedCount = 0;

    for (const item of list) {
      try {
        let res: Response | null = null;
        if (!item.actionType || item.actionType === "VISITOR_CHECKIN") {
          res = await fetch("/api/guard/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inviteId: item.inviteId,
              gateId: item.gateId,
              idempotencyKey: item.idempotencyKey,
              offlineTimestamp: item.timestamp,
              isOffline: true,
            }),
          });
        } else if (item.actionType === "VISITOR_CHECKOUT" && item.entryId) {
          res = await fetch("/api/guard/check-out", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entryId: item.entryId,
              idempotencyKey: item.idempotencyKey,
              offlineTimestamp: item.timestamp,
              isOffline: true,
            }),
          });
        } else if (item.actionType === "MANUAL_PASS") {
          res = await fetch("/api/guard/manual-pass", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload || {}),
          });
        } else if (item.actionType === "DELIVERY_LOG") {
          res = await fetch("/api/deliveries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload || {}),
          });
        } else if (item.actionType === "HELP_CHECKIN" || item.actionType === "HELP_CHECKOUT") {
          res = await fetch("/api/help/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload || {}),
          });
        }

        if (res) {
          if (res.ok || res.status === 409) {
            await markEntrySynced(item.idempotencyKey);
            syncedCount++;
          } else if (res.status >= 400) {
            const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            const reason = errData.error || `HTTP ${res.status}`;
            await markEntryFailed(item.idempotencyKey, reason);
            failedCount++;
            toast.error(`Sync failed for ${item.entryType || item.actionType || "entry"}: ${reason}`);
          }
        }
      } catch (err: any) {
        console.error("[SYNC ERROR]", err);
      }
    }
    setIsSyncing(false);
    await refreshPendingCount();
    loadExpected();
    loadInside();
    loadDeliveries();
    loadHelpAttendance();
    if (failedCount > 0) {
      toast.warning(`Sync finished: ${syncedCount} synced, ${failedCount} failed`);
    } else {
      toast.success("Offline queue sync complete");
    }
  }

  useEffect(() => {
    const t = setInterval(()=>setTime(new Date()), 1000);
    fetch("/api/auth/me").then(r=>r.json()).then(d=> {
      setGuard(d.user);
      if (Array.isArray(d.roles)) setUserRoles(d.roles.map((r: any) => r.role));
    }).catch(()=>{});
    fetch("/api/societies").then(r=>r.json()).then(d=> setSociety(Array.isArray(d)? d[0]: null)).catch(()=>{});
    fetch("/api/gates").then(r=>r.json()).then(d=>{ if(Array.isArray(d)){ setGates(d); if(d[0]) setSelectedGate(d[0].id); }}).catch(()=>{});
    loadExpected(); loadInside(); loadDeliveries(); loadHelp(); loadHelpAttendance(); loadVehiclesInside();
    refreshPendingCount();

    const saved = localStorage.getItem("guard_gate");
    if (saved) setSelectedGate(saved);

    // P0 FIX: Web Audio API synthesized siren sound for physical security cabins.
    const playEmergencySiren = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch {}
    };

    // P0 FIX: Emergency polling — 5 second interval for life-safety responsiveness.
    const fetchEmergencies = async () => {
      try {
        const res = await fetch("/api/emergency");
        const data = await res.json();
        if (Array.isArray(data)) {
          const openAlerts = data.filter((a: any) => a.status === "OPEN");
          setEmergencies(openAlerts);
          if (openAlerts.length > 0) {
            playEmergencySiren();
          }
          // Trigger browser notification + vibration when NEW emergencies appear
          if (openAlerts.length > 0 && prevEmergencyCount.current === 0) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("🚨 EMERGENCY ALERT", {
                body: `${openAlerts[0].type} — Acknowledge immediately`,
                requireInteraction: true,
              });
            } else if ("Notification" in window && Notification.permission === "default") {
              Notification.requestPermission();
            }
            if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
          }
          prevEmergencyCount.current = openAlerts.length;
        }
      } catch {}
    };
    fetchEmergencies();
    const emergencyInterval = setInterval(fetchEmergencies, 5000);
    const onFocus = () => fetchEmergencies();
    const onVisibility = () => { if (document.visibilityState === "visible") fetchEmergencies(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const handleOnline = () => { setIsOnline(true); toast.success("Online connection restored"); syncOfflineQueue(); };
    const handleOffline = () => { setIsOnline(false); toast.warning("Connection lost. Operating in Offline Mode (24h Allowlist Active)"); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator && process.env.NODE_ENV !== "test") {
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    }

    return () => {
      clearInterval(t);
      clearInterval(emergencyInterval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(()=>{ if(selectedGate) localStorage.setItem("guard_gate", selectedGate); }, [selectedGate]);

  async function loadExpected(){
    try {
      const res = await fetch("/api/guard/expected");
      const d = await res.json();
      if (Array.isArray(d)) {
        setExpected(d);
        // Pre-cache 24h expected visitors into IndexedDB for offline gate resilience
        cacheApprovedInvites(d.map((item: any) => ({
          id: item.invite.id,
          code: item.invite.code,
          qrToken: item.invite.qrToken,
          visitorName: item.visitor?.name || "Guest",
          visitorPhone: item.visitor?.phone,
          unitNumber: item.unit?.number,
          purpose: item.invite.purpose,
          validFrom: item.invite.validFrom,
          validTo: item.invite.validTo,
          status: item.invite.status,
          cachedAt: Date.now(),
        })));
      }
    } catch {}
  }
  async function loadInside() {
    try {
      const res = await fetch("/api/guard/inside");
      const d = await res.json();
      if (Array.isArray(d)) {
        setInside(d);
        cacheActiveInside(
          d.map((item: any) => ({
            id: item.entry.id,
            inviteId: item.entry.inviteId,
            name: item.visitor?.name || "Visitor",
            phone: item.visitor?.phone,
            type: item.type || "VISITOR",
            unit: item.unit ? `${item.unit.number} (${item.building?.name || ""})` : "General",
            checkIn: item.entry.checkIn,
            vehicleNumber: item.visitor?.vehicleNumber,
            cachedAt: Date.now(),
          }))
        );
      }
    } catch {
      if (!navigator.onLine) {
        const cached = await getCachedInside();
        if (cached.length > 0) {
          setInside(
            cached.map((c) => ({
              entry: { id: c.id, checkIn: c.checkIn, inviteId: c.inviteId },
              visitor: { name: c.name, phone: c.phone, vehicleNumber: c.vehicleNumber },
              unit: { number: c.unit },
              type: c.type,
              isOfflineCached: true,
            }))
          );
        }
      }
    }
  }

  async function loadDeliveries() {
    try {
      const res = await fetch("/api/deliveries");
      const d = await res.json();
      if (Array.isArray(d)) setDeliveries(d);
    } catch {}
  }

  async function loadHelp() {
    try {
      const res = await fetch("/api/help");
      const d = await res.json();
      if (Array.isArray(d)) {
        setHelpList(d);
        cacheDailyHelp(
          d.map((h: any) => ({
            id: h.id,
            name: h.fullName,
            phone: h.phone,
            serviceType: h.serviceType,
            agency: h.agency,
            passcode: h.passcode,
            cachedAt: Date.now(),
          }))
        );
      }
    } catch {
      if (!navigator.onLine) {
        const cached = await getCachedDailyHelp();
        if (cached.length > 0) {
          setHelpList(
            cached.map((c) => ({
              id: c.id,
              fullName: c.name,
              phone: c.phone,
              serviceType: c.serviceType,
              agency: c.agency,
            }))
          );
        }
      }
    }
  }

  async function loadHelpAttendance() {
    try {
      const res = await fetch("/api/help/attendance");
      const d = await res.json();
      if (Array.isArray(d)) setHelpAttendance(d);
    } catch {}
  }

  async function verify(){
    if (!code.trim()) return toast.error("Enter pass code");
    setVerifyResult(null); setVerifyError(null);
    const cleanCode = code.trim().toUpperCase();

    if (!navigator.onLine) {
      const cached = await findCachedInvite(cleanCode);
      if (cached) {
        setVerifyResult({
          invite: { id: cached.id, code: cached.code, purpose: cached.purpose },
          visitor: { name: cached.visitorName, phone: cached.visitorPhone },
          unit: { number: cached.unitNumber || "N/A" },
          isOffline: true,
        });
        toast.warning("Verified from 24h offline cache");
        return;
      } else {
        setVerifyError("Pass not in offline cache (online connection required for un-cached passes)");
        toast.error("Pass not in offline cache");
        return;
      }
    }

    try {
      const res = await fetch("/api/guard/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        const cached = await findCachedInvite(cleanCode);
        if (cached) {
          setVerifyResult({
            invite: { id: cached.id, code: cached.code, purpose: cached.purpose },
            visitor: { name: cached.visitorName, phone: cached.visitorPhone },
            unit: { number: cached.unitNumber || "N/A" },
            isOffline: true,
          });
          toast.warning("Verified from 24h offline cache");
          return;
        }
        setVerifyError(data.error || "Not found");
        toast.error(data.error || "Not found");
      } else {
        setVerifyResult(data);
        toast.success("Visitor verified");
      }
    } catch {
      const cached = await findCachedInvite(cleanCode);
      if (cached) {
        setVerifyResult({
          invite: { id: cached.id, code: cached.code, purpose: cached.purpose },
          visitor: { name: cached.visitorName, phone: cached.visitorPhone },
          unit: { number: cached.unitNumber || "N/A" },
          isOffline: true,
        });
        toast.warning("Verified from 24h offline cache");
      } else {
        setVerifyError("Network unavailable and pass not in offline cache");
        toast.error("Network unavailable");
      }
    }
  }

  async function checkIn(){
    if (!verifyResult?.invite) return;

    if (!navigator.onLine || verifyResult.isOffline) {
      const idempotencyKey = crypto.randomUUID();
      await queueOfflineEntry({
        idempotencyKey,
        code: verifyResult.invite.code,
        inviteId: verifyResult.invite.id,
        gateId: selectedGate || undefined,
        entryType: "VISITOR",
        timestamp: new Date().toISOString(),
      });
      toast.success("Entry saved to offline queue. Will sync automatically when online.");
      setVerifyResult(null);
      setCode("");
      refreshPendingCount();
      return;
    }

    try {
      const res = await fetch("/api/guard/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: verifyResult.invite.id, gateId: selectedGate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Check-in failed");
      } else {
        toast.success("Entry recorded");
        setVerifyResult(null);
        setCode("");
        loadExpected();
        loadInside();
      }
    } catch {
      const idempotencyKey = crypto.randomUUID();
      await queueOfflineEntry({
        idempotencyKey,
        code: verifyResult.invite.code,
        inviteId: verifyResult.invite.id,
        gateId: selectedGate || undefined,
        entryType: "VISITOR",
        timestamp: new Date().toISOString(),
      });
      toast.success("Connection dropped. Entry saved to offline queue.");
      setVerifyResult(null);
      setCode("");
      refreshPendingCount();
    }
  }

  async function checkOut(entryId: string) {
    if (!navigator.onLine) {
      const idempotencyKey = crypto.randomUUID();
      await queueOfflineEntry({
        idempotencyKey,
        entryId,
        entryType: "VISITOR",
        actionType: "VISITOR_CHECKOUT",
        timestamp: new Date().toISOString(),
      });
      await removeCachedInside(entryId);
      toast.info("Check-out saved to offline queue (will sync when online)");
      setInside((prev) => prev.filter((item) => item.entry.id !== entryId));
      refreshPendingCount();
      return;
    }
    const res = await fetch("/api/guard/check-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Failed");
    } else {
      toast.success("Checked out");
      loadInside();
    }
  }

  async function searchResident() {
    if (residentQuery.length < 2) return;
    const res = await fetch(`/api/guard/resident-search?q=${encodeURIComponent(residentQuery)}`);
    const d = await res.json();
    setResidentResults(Array.isArray(d) ? d : []);
    setActiveWalkinIndex(-1);
  }

  function handleWalkinSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (residentResults.length > 0 && activeWalkinIndex >= 0) {
        setWalkin({ ...walkin, unitId: residentResults[activeWalkinIndex].unit.id });
        setResidentResults([]);
        setActiveWalkinIndex(-1);
      } else {
        searchResident();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveWalkinIndex(prev => Math.min(prev + 1, residentResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveWalkinIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setResidentResults([]);
      setActiveWalkinIndex(-1);
    }
  }

  async function doWalkIn() {
    if (!walkin.visitorName || !walkin.phone || !walkin.unitId) return toast.error("Fill visitor, phone, unit");
    const res = await fetch("/api/guard/walk-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorName: walkin.visitorName,
        phone: walkin.phone,
        purpose: walkin.purpose,
        unitId: walkin.unitId,
        gateId: selectedGate || undefined,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      toast.error(d.error || "Walk-in failed");
    } else {
      toast.success(`Walk-in requested: Pass ${d.invite.code} sent to resident for approval.`);
      setWalkin({ visitorName: "", phone: "", purpose: "Guest", unitId: "" });
      loadExpected();
    }
  }
  async function searchDeliveryUnit(){
    if (deliveryQuery.length<2) return;
    const res = await fetch(`/api/guard/resident-search?q=${encodeURIComponent(deliveryQuery)}`);
    const d = await res.json();
    setDeliveryResults(Array.isArray(d)? d : []);
    setActiveDeliveryIndex(-1);
  }

  function handleDeliverySearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (deliveryResults.length > 0 && activeDeliveryIndex >= 0) {
        setDeliveryForm({ ...deliveryForm, unitId: deliveryResults[activeDeliveryIndex].unit.id });
        setDeliveryResults([]);
        setActiveDeliveryIndex(-1);
      } else {
        searchDeliveryUnit();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveDeliveryIndex(prev => Math.min(prev + 1, deliveryResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveDeliveryIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setDeliveryResults([]);
      setActiveDeliveryIndex(-1);
    }
  }
  async function recordDelivery(){
    if (!deliveryForm.courierName || !deliveryForm.unitId) return toast.error("Enter courier and unit");
    const res = await fetch("/api/deliveries", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ courierName: deliveryForm.courierName, awb: deliveryForm.awb || undefined, unitId: deliveryForm.unitId }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error||"Failed"); else { toast.success(`Delivery for ${d.courierName} recorded`); setDeliveryForm({ courierName:"", awb:"", unitId:""}); setDeliveryQuery(""); setDeliveryResults([]); loadDeliveries(); }
  }
  async function searchHelp(){
    if (helpQuery.length<2) return;
    const q = helpQuery.toLowerCase();
    const filtered = helpList.filter((h:any)=> h.help.name.toLowerCase().includes(q) || h.help.phone.includes(q));
    setHelpSearchResults(filtered);
  }
  async function helpCheckIn(helpId: string, unitId: string){
    const res = await fetch("/api/help/attendance", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ helpId, unitId, gateId: selectedGate || undefined }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error||"Check-in failed"); else { toast.success("Help checked in"); loadHelpAttendance(); }
  }
  async function helpCheckOut(attendanceId: string){
    const res = await fetch("/api/help/attendance", { method:"POST", headers:{ "Content-Type":"application/json"}, body: JSON.stringify({ attendanceId }) });
    const d = await res.json();
    if (!res.ok) toast.error(d.error||"Check-out failed"); else { toast.success("Checked out"); loadHelpAttendance(); }
  }
  async function searchVehicle(){
    if (vehicleQuery.length<2) return;
    const res = await fetch(`/api/guard/vehicle-search?q=${encodeURIComponent(vehicleQuery)}`);
    const d = await res.json();
    setVehicleResults(Array.isArray(d)? d : []);
    if (!res.ok) toast.error(d.error||"Search failed");
  }

  async function loadVehiclesInside() {
    try {
      const res = await fetch("/api/guard/vehicle-entry");
      const d = await res.json();
      if (Array.isArray(d)) setVehiclesInside(d);
    } catch {}
  }

  async function vehicleCheckIn(numberPlate: string, unitId?: string, vehicleId?: string) {
    try {
      const res = await fetch("/api/guard/vehicle-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numberPlate,
          unitId: unitId || undefined,
          vehicleId: vehicleId || undefined,
          gateId: selectedGate || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Vehicle check-in failed");
      } else {
        toast.success(`Vehicle ${numberPlate} admitted`);
        loadVehiclesInside();
      }
    } catch {
      toast.error("Failed to check in vehicle");
    }
  }

  async function vehicleCheckOut(entryId: string) {
    try {
      const res = await fetch("/api/guard/vehicle-entry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Vehicle check-out failed");
      } else {
        toast.success("Vehicle checked out");
        loadVehiclesInside();
      }
    } catch {
      toast.error("Failed to check out vehicle");
    }
  }

  return (
    <AppShell>
      {emergencies.length > 0 && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-red-600 text-white px-4 py-3 flex items-center gap-3 shadow-2xl animate-pulse">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-sm">
              ACTIVE EMERGENCY — {emergencies.length} alert{emergencies.length > 1 ? "s" : ""} OPEN
            </span>
            <span className="ml-3 text-xs opacity-90">
              {emergencies[0]?.type}{emergencies[0]?.location ? ` — ${emergencies[0].location}` : ""}
            </span>
          </div>
          <button
            className="text-xs font-bold underline whitespace-nowrap bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
            onClick={() => setTab("verify")}
          >
            Acknowledge
          </button>
        </div>
      )}
      <div className={`max-w-6xl mx-auto space-y-4${emergencies.length > 0 ? " pt-14" : ""}`}>
        {/* Cockpit Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2 text-foreground">
                <Shield className="h-5 w-5 text-primary" />
                Gate Terminal
              </h1>
              <button
                type="button"
                onClick={openSyncDrawer}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wider font-semibold border transition-all cursor-pointer ${
                  isOnline
                    ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800"
                    : "border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:border-amber-700 animate-pulse"
                }`}
                title="Click to inspect Offline Queue & Local Allowlist"
              >
                {isOnline ? <Wifi className="h-3 w-3 text-emerald-600" /> : <WifiOff className="h-3 w-3 text-amber-600" />}
                {isOnline ? "ONLINE • 24H ALLOWLIST" : "OFFLINE MODE ACTIVE"}
              </button>

              <button
                type="button"
                onClick={openSyncDrawer}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wider font-semibold border border-border/80 bg-secondary/80 hover:bg-secondary text-foreground cursor-pointer transition-colors"
                title="View sync queue details"
              >
                <History className="h-3 w-3 text-primary" />
                <span>SYNC QUEUE</span>
                {pendingCount > 0 ? (
                  <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                    {pendingCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[10px]">0</span>
                )}
              </button>

              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setManualPassOpen(true)}
                className="h-7 text-xs font-mono font-semibold border-dashed border-primary/50 text-primary hover:bg-primary/10 gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" /> Emergency Pass
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {society?.name || "Green Acres"} • {gates.find(g => g.id === selectedGate)?.name || "Main Gate"} • Security Officer: {guard?.fullName || "On Duty"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-secondary/70 px-3 py-1.5 rounded-lg border border-border/60">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{time.toLocaleTimeString()}</span>
              <span className="text-border/80">•</span>
              <span>{time.toLocaleDateString()}</span>
            </div>
            <Select value={selectedGate} onValueChange={setSelectedGate}>
              <SelectTrigger className="w-44 h-8 text-xs font-medium">
                <SelectValue placeholder="Select gate" />
              </SelectTrigger>
              <SelectContent>
                {gates.map(g => (
                  <SelectItem key={g.id} value={g.id} className="text-xs font-mono">
                    {g.name} ({g.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {userRoles.length > 0 && !userRoles.some(r => ["GUARD", "SECURITY_MANAGER", "SUPER_ADMIN", "SOCIETY_ADMIN"].includes(r)) && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                You are currently signed in as <strong>{guard?.fullName || "Resident"} ({userRoles.join(", ")})</strong>. Pass verification and check-ins require security guard credentials.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 shrink-0 border-amber-400 bg-white dark:bg-amber-900 hover:bg-amber-100"
              onClick={() => window.location.href = "/auth/sign-in"}
            >
              Switch to Guard (8888888888)
            </Button>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto gap-1 h-11 p-1 justify-start bg-secondary/60 rounded-xl border border-border/70">
            <TabsTrigger value="verify" className="text-xs font-medium px-3.5 h-9 rounded-lg">
              <QrCode className="h-3.5 w-3.5 mr-1.5" /> Verify Pass
            </TabsTrigger>
            <TabsTrigger value="expected" className="text-xs font-medium px-3.5 h-9 rounded-lg">
              Expected {expected.length > 0 && <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-primary text-primary-foreground">{expected.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="inside" className="text-xs font-medium px-3.5 h-9 rounded-lg">
              Inside {inside.length > 0 && <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-600 text-white">{inside.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="text-xs font-medium px-3.5 h-9 rounded-lg">
              Deliveries {deliveries.filter((d: any) => d.status === "AT_GATE").length > 0 && <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-600 text-white">{deliveries.filter((d: any) => d.status === "AT_GATE").length}</span>}
            </TabsTrigger>
            <TabsTrigger value="help" className="text-xs font-medium px-3.5 h-9 rounded-lg">
              Domestic Staff
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="text-xs font-medium px-3.5 h-9 rounded-lg">
              Vehicles
            </TabsTrigger>
            <TabsTrigger value="walkin" className="text-xs font-medium px-3.5 h-9 rounded-lg">
              Walk-in
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verify" className="space-y-4 mt-5">
            <Card className="border border-border/80 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    High-Speed Visitor Verification
                  </CardTitle>
                  <span className="text-[11px] text-muted-foreground font-mono">6-DIGIT CODE / QR TOKEN</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <Label htmlFor="guard-verify-code" className="sr-only">Visitor pass code</Label>
                <div className="flex gap-2.5 max-w-xl mx-auto">
                  <Input
                    id="guard-verify-code"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") verify(); }}
                    placeholder="ENTER PASS CODE"
                    className="h-16 text-2xl sm:text-3xl font-mono tracking-widest text-center font-bold border-2 focus-visible:ring-primary"
                    autoFocus
                    aria-label="Visitor pass code"
                  />
                  <Button
                    onClick={verify}
                    className="h-16 px-8 text-sm font-semibold tracking-wider uppercase font-mono"
                    aria-label="Verify visitor code"
                  >
                    Verify Pass
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground font-mono">
                  Server-authoritative verification • Local 24h fallback cache automatically active during network loss
                </p>
              </CardContent>
            </Card>

            {verifyError && (
              <div className="rounded-xl border border-red-300 bg-red-50/90 dark:bg-red-950/30 p-4 flex gap-3 shadow-sm">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-950 dark:text-red-100">{verifyError}</p>
                  <p className="text-xs text-red-800/80 dark:text-red-300/80 mt-1">
                    {verifyError.includes("expired")
                      ? "Pass expired — advise visitor to request a new invite from the host resident."
                      : verifyError.includes("cancelled")
                      ? "Invitation was cancelled by the host resident. Deny access."
                      : verifyError.includes("already")
                      ? "Visitor is already marked inside the society."
                      : "Check the code carefully or search resident flat directly."}
                  </p>
                </div>
              </div>
            )}

            {verifyResult && (
              <Card className="border-2 border-emerald-500/40 bg-card shadow-[0_4px_20px_rgba(16,185,129,0.08)]">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider uppercase text-emerald-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Credential Verified • Ready For Entry
                    </span>
                    <Badge variant="outline" className="font-mono text-xs border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                      PASS: {verifyResult.invite.code}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Visitor Name</p>
                      <p className="text-xl font-bold tracking-tight text-foreground">{verifyResult.visitor.name}</p>
                      <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {verifyResult.visitor.phone}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Destination Flat</p>
                      <p className="text-xl font-bold tracking-tight text-foreground">
                        Unit {verifyResult.unit?.number || verifyResult.invite.unitId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Purpose: <span className="font-medium text-foreground">{verifyResult.invite.purpose}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground font-mono">
                    Validity Window: {new Date(verifyResult.invite.validFrom).toLocaleDateString()} {new Date(verifyResult.invite.validFrom).toLocaleTimeString()} → {new Date(verifyResult.invite.validTo).toLocaleTimeString()}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <Button
                      variant="outline"
                      className="h-14 text-sm font-semibold border-border/80 hover:bg-secondary"
                      onClick={() => setVerifyResult(null)}
                    >
                      Deny Entry
                    </Button>
                    <Button
                      className="h-14 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      onClick={checkIn}
                    >
                      <LogIn className="mr-2 h-5 w-5" /> Admit & Check In
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="expected" className="space-y-3 mt-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Expected Visitors</h2><Button variant="ghost" size="sm" onClick={loadExpected}>Refresh</Button></div>
            {expected.length===0 ? <Card><CardContent className="py-10 text-center"><Users className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm font-medium mt-2">No expected visitors</p><p className="text-xs text-muted-foreground">Invites from residents appear here.</p></CardContent></Card> : (
              <div className="grid md:grid-cols-2 gap-3">
                {expected.map((e:any)=>(
                  <Card key={e.invite.id} className="hover:bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{e.visitor.name}</p>
                          <p className="text-xs text-muted-foreground">{e.visitor.phone} • {e.invite.purpose}</p>
                          <p className="text-xs flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{e.unit?.number} • {new Date(e.invite.validTo).toLocaleTimeString()}</p>
                        </div>
                        <Badge variant="outline" className="h-fit font-mono">{e.invite.code}</Badge>
                      </div>
                      <Button size="sm" className="w-full mt-3 h-10" onClick={()=>{ setCode(e.invite.code); setTab("verify"); setTimeout(verify, 100); }}>Verify & Allow</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="inside" className="space-y-3 mt-4">
            {(() => {
              const now = Date.now();
              const isOverstay = (it: any) => it.invite?.validTo && new Date(it.invite.validTo).getTime() < now;
              const overstayCount = inside.filter(isOverstay).length;
              const displayed = filterOverstayOnly ? inside.filter(isOverstay) : inside;

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold">Inside — Currently in Society</h2>
                      <Badge variant="secondary">{inside.length} total</Badge>
                      {overstayCount > 0 && (
                        <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {overstayCount} Overstaying
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {overstayCount > 0 && (
                        <Button
                          size="sm"
                          variant={filterOverstayOnly ? "destructive" : "outline"}
                          className="text-xs h-8"
                          onClick={() => setFilterOverstayOnly(!filterOverstayOnly)}
                        >
                          {filterOverstayOnly ? "Show All Inside" : `⚠️ Filter Overstaying (${overstayCount})`}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={loadInside} className="h-8 text-xs">
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {displayed.length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-sm font-medium mt-2">
                          {filterOverstayOnly ? "No overstaying visitors" : "No one inside"}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {displayed.map((it: any) => {
                        const overstayed = isOverstay(it);
                        return (
                          <Card
                            key={it.entry.id}
                            className={overstayed ? "border-2 border-red-500 bg-red-50/50 dark:bg-red-950/20" : ""}
                          >
                            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`h-10 w-10 rounded-full flex items-center justify-center font-medium ${
                                    overstayed ? "bg-red-100 text-red-700 font-bold" : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {it.visitor.name[0]}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold">{it.visitor.name}</p>
                                    <Badge variant="outline" className="text-xs">
                                      Unit {it.unit?.number || "—"}
                                    </Badge>
                                    {overstayed && (
                                      <Badge variant="destructive" className="text-[10px]">
                                        OVERSTAY
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    In since {new Date(it.entry.checkIn).toLocaleTimeString()} (
                                    {Math.floor((now - new Date(it.entry.checkIn).getTime()) / 60000)} min)
                                    {it.invite?.validTo && (
                                      <span className={overstayed ? " text-red-600 font-semibold ml-1" : " ml-1"}>
                                        • Pass valid till {new Date(it.invite.validTo).toLocaleTimeString()}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={overstayed ? "destructive" : "outline"}
                                className="h-10 shrink-0"
                                onClick={() => checkOut(it.entry.id)}
                              >
                                <LogOut className="h-4 w-4 mr-1" />
                                Check out
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" />Record Delivery at Gate</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="guard-delivery-courier">Courier / Provider *</Label><Input id="guard-delivery-courier" value={deliveryForm.courierName} onChange={e=>setDeliveryForm({...deliveryForm, courierName:e.target.value})} placeholder="Amazon, Flipkart, BlueDart" /></div>
                  <div className="space-y-1"><Label htmlFor="guard-delivery-awb">AWB / Tracking (optional)</Label><Input id="guard-delivery-awb" value={deliveryForm.awb} onChange={e=>setDeliveryForm({...deliveryForm, awb:e.target.value})} placeholder="AWB123456" /></div>
                </div>
                <div className="space-y-1"><Label htmlFor="guard-delivery-unit">Destination Unit *</Label><Input id="guard-delivery-unit" value={deliveryForm.unitId} onChange={e=>setDeliveryForm({...deliveryForm, unitId:e.target.value})} placeholder="Unit ID or search below" className="font-mono text-xs" /></div>
                <div className="flex gap-2">
                  <Label htmlFor="guard-delivery-search" className="sr-only">Search unit for delivery</Label>
                  <Input id="guard-delivery-search" value={deliveryQuery} onChange={e=>setDeliveryQuery(e.target.value)} onKeyDown={handleDeliverySearchKeyDown} placeholder="Search unit e.g. A-101" className="flex-1" aria-label="Search unit for delivery" />
                  <Button type="button" variant="outline" onClick={searchDeliveryUnit} aria-label="Find unit for delivery"><Search className="h-4 w-4 mr-1" aria-hidden />Find</Button>
                </div>
                {deliveryResults.length>0 && (
                  <div className="rounded-lg border divide-y max-h-40 overflow-auto" role="listbox">
                    {deliveryResults.map((r:any, idx: number)=>(
                      <button key={r.unit.id} onClick={()=>{setDeliveryForm({...deliveryForm, unitId: r.unit.id}); setDeliveryResults([]); setActiveDeliveryIndex(-1);}} className={`w-full text-left px-3 py-2 hover:bg-muted flex justify-between transition-colors ${idx === activeDeliveryIndex ? "bg-accent text-accent-foreground font-semibold" : ""}`} role="option" aria-selected={idx === activeDeliveryIndex}>
                        <span className="text-sm font-medium">{r.unit.number} • {r.residents[0]?.user?.fullName || "Resident"}</span>
                        <span className="text-xs text-muted-foreground">{r.unit.type}</span>
                      </button>
                    ))}
                  </div>
                )}
                <Button onClick={recordDelivery} className="w-full h-12 text-base"><Package className="mr-2 h-5 w-5" />Record Delivery</Button>
                <p className="text-xs text-muted-foreground">Creates notification for all residents of the unit. Status AT_GATE → resident collects.</p>
              </CardContent>
            </Card>
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Recent Deliveries</h2><Button variant="ghost" size="sm" onClick={loadDeliveries}>Refresh</Button></div>
            {deliveries.length===0 ? <Card><CardContent className="py-8 text-center"><Package className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm font-medium mt-2">No deliveries yet</p></CardContent></Card> : (
              <div className="space-y-2">
                {deliveries.slice(0,10).map((d:any)=>(
                  <Card key={d.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold">{d.courierName}</p>
                        <p className="text-xs text-muted-foreground">{d.awb || "No AWB"} • {new Date(d.createdAt).toLocaleString()}</p>
                        <p className="text-xs">Unit {d.unitId.slice(0,8)} • {d.status}</p>
                      </div>
                      <Badge variant={d.status==="AT_GATE" ? "default" : "secondary"} className={d.status==="AT_GATE" ? "bg-amber-600" : ""}>{d.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="help" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HeartHandshake className="h-4 w-4" />Domestic Help — Attendance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Label htmlFor="guard-help-search" className="sr-only">Search domestic help</Label>
                  <Input id="guard-help-search" value={helpQuery} onChange={e=>setHelpQuery(e.target.value)} placeholder="Search name or phone e.g. Lakshmi" className="flex-1" aria-label="Search domestic help" />
                  <Button type="button" variant="outline" onClick={searchHelp} aria-label="Find domestic help"><Search className="h-4 w-4 mr-1" aria-hidden />Find</Button>
                  <Button type="button" variant="ghost" onClick={()=>{ setHelpQuery(""); setHelpSearchResults([]); loadHelp(); }}>All</Button>
                </div>
                {(helpSearchResults.length>0 ? helpSearchResults : helpList).length===0 ? <p className="text-sm text-muted-foreground text-center py-4">No domestic help found</p> : (
                  <div className="space-y-2 max-h-[45vh] overflow-auto">
                    {(helpSearchResults.length>0 ? helpSearchResults : helpList).slice(0,20).map((item:any)=> {
                      const isInside = helpAttendance.some((a:any)=> a.help?.id===item.help.id && !a.attendance.checkOut);
                      const att = helpAttendance.find((a:any)=> a.help?.id===item.help.id && !a.attendance.checkOut);
                      return (
                        <Card key={item.help.id} className="border">
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-medium">{item.help.name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.help.name} • {item.help.category}</p>
                              <p className="text-xs text-muted-foreground">{item.help.phone} • {item.links.length} unit(s) {isInside && "• Inside"}</p>
                            </div>
                            {isInside ? <Button size="sm" variant="outline" onClick={()=>helpCheckOut(att.attendance.id)}><LogOut className="h-4 w-4 mr-1" />Out</Button> : <Button size="sm" onClick={()=>helpCheckIn(item.help.id, item.links[0]?.unitId)}><LogIn className="h-4 w-4 mr-1" />In</Button>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Check-in creates attendance per unit. Guard verifies link belongs to society. RLS enforced.</p>
              </CardContent>
            </Card>
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Help Inside Now</h2><Badge variant="secondary">{helpAttendance.filter((h:any)=>!h.attendance.checkOut).length} inside</Badge></div>
            {helpAttendance.filter((h:any)=>!h.attendance.checkOut).length===0 ? <p className="text-sm text-muted-foreground text-center py-4">No help inside</p> : (
              <div className="space-y-2">
                {helpAttendance.filter((h:any)=>!h.attendance.checkOut).map((it:any)=>(
                  <Card key={it.attendance.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1"><p className="text-sm font-medium">{it.help?.name} • {it.unit?.number}</p><p className="text-xs text-muted-foreground">In since {new Date(it.attendance.checkIn).toLocaleTimeString()} • Gate {it.attendance.gateId?.slice(0,6) || "—"}</p></div>
                      <Button size="sm" variant="outline" onClick={()=>helpCheckOut(it.attendance.id)}><LogOut className="h-4 w-4 mr-1" />Out</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vehicles" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicle Gate Entry & Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Search number plate or flat to verify registered resident vehicles or admit visitor vehicles at the gate.</p>
                <div className="flex gap-2">
                  <Label htmlFor="guard-vehicle-search" className="sr-only">Search vehicle</Label>
                  <Input
                    id="guard-vehicle-search"
                    value={vehicleQuery}
                    onChange={e => setVehicleQuery(e.target.value.toUpperCase())}
                    placeholder="KA01AB1234 or A-101"
                    className="font-mono flex-1 uppercase"
                    aria-label="Search vehicle by number or unit"
                  />
                  <Button type="button" onClick={searchVehicle} aria-label="Verify vehicle">
                    <Search className="h-4 w-4 mr-1" aria-hidden />
                    Verify / Search
                  </Button>
                </div>

                {vehicleResults.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matching Registered Vehicles</p>
                    {vehicleResults.map((r: any) => (
                      <Card key={r.vehicle.id} className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-mono font-bold">{r.vehicle.numberPlate}</span>
                              <Badge variant="secondary">{r.vehicle.type}</Badge>
                              <Badge variant="outline" className="text-emerald-700 border-emerald-400">Authorized</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Unit {r.unit?.number || "—"} • Owner {r.owner?.fullName || "Resident"} {r.owner?.phone && `(${r.owner.phone})`}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                            onClick={() => vehicleCheckIn(r.vehicle.numberPlate, r.unit?.id, r.vehicle.id)}
                          >
                            <LogIn className="h-4 w-4 mr-1" /> Admit Entry
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {vehicleQuery && vehicleResults.length === 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-300">Unregistered / Guest Vehicle: {vehicleQuery}</p>
                      <p className="text-amber-700 dark:text-amber-400">Not currently registered to any resident profile.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-400 shrink-0"
                      onClick={() => vehicleCheckIn(vehicleQuery)}
                    >
                      <LogIn className="h-4 w-4 mr-1" /> Log Visitor Entry
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Vehicles Inside Society Now</h2>
                <Badge variant="secondary">{vehiclesInside.length} logged</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={loadVehiclesInside} className="h-8 text-xs">
                Refresh
              </Button>
            </div>

            {vehiclesInside.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Car className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium mt-2">No active vehicle entries logged</p>
                  <p className="text-xs text-muted-foreground">Logged vehicle admissions will appear here with exit tracking.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {vehiclesInside.map((v: any) => (
                  <Card key={v.entry.id} className="border">
                    <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold">{v.entry.numberPlate}</span>
                          {v.entry.isVisitor ? (
                            <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">
                              VISITOR
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              RESIDENT
                            </Badge>
                          )}
                          {v.unit?.number && (
                            <span className="text-xs text-muted-foreground">Unit {v.unit.number}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Admitted at {new Date(v.entry.checkIn).toLocaleTimeString()} (
                          {Math.floor((Date.now() - new Date(v.entry.checkIn).getTime()) / 60000)} min inside)
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0"
                        onClick={() => vehicleCheckOut(v.entry.id)}
                      >
                        <LogOut className="h-4 w-4 mr-1" /> Log Exit
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="walkin" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" />Walk-in Visitor (no invite)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="guard-walkin-name">Visitor name *</Label><Input id="guard-walkin-name" value={walkin.visitorName} onChange={e=>setWalkin({...walkin, visitorName:e.target.value})} placeholder="Name" /></div>
                  <div className="space-y-1"><Label htmlFor="guard-walkin-phone">Phone *</Label><Input id="guard-walkin-phone" value={walkin.phone} onChange={e=>setWalkin({...walkin, phone:e.target.value})} placeholder="98765 43210" /></div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="guard-walkin-purpose">Purpose *</Label><Input id="guard-walkin-purpose" value={walkin.purpose} onChange={e=>setWalkin({...walkin, purpose:e.target.value})} placeholder="Guest / Delivery" /></div>
                  <div className="space-y-1"><Label htmlFor="guard-walkin-unit">Host unit *</Label>
                    <div className="flex gap-2">
                      <Input id="guard-walkin-unit" value={walkin.unitId} onChange={e=>setWalkin({...walkin, unitId:e.target.value})} placeholder="Unit ID or search below" className="font-mono text-xs" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Label htmlFor="guard-walkin-search" className="sr-only">Search unit or resident</Label>
                  <Input id="guard-walkin-search" value={residentQuery} onChange={e=>setResidentQuery(e.target.value)} onKeyDown={handleWalkinSearchKeyDown} placeholder="Search unit / resident e.g. A-101" className="flex-1" aria-label="Search unit or resident for walk-in" />
                  <Button type="button" variant="outline" onClick={searchResident} aria-label="Find resident unit"><Search className="h-4 w-4 mr-1" aria-hidden />Find</Button>
                </div>
                {residentResults.length>0 && (
                  <div className="rounded-lg border divide-y max-h-40 overflow-auto" role="listbox">
                    {residentResults.map((r:any, idx: number)=>(
                      <button key={r.unit.id} onClick={()=>{setWalkin({...walkin, unitId: r.unit.id}); setResidentResults([]); setActiveWalkinIndex(-1);}} className={`w-full text-left px-3 py-2 hover:bg-muted flex justify-between transition-colors ${idx === activeWalkinIndex ? "bg-accent text-accent-foreground font-semibold" : ""}`} role="option" aria-selected={idx === activeWalkinIndex}>
                        <span className="text-sm font-medium">{r.unit.number} • {r.residents[0]?.user?.fullName || "Resident"}</span>
                        <span className="text-xs text-muted-foreground">{r.unit.type}</span>
                      </button>
                    ))}
                  </div>
                )}
                <Button onClick={doWalkIn} className="w-full h-12 text-base"><LogIn className="mr-2 h-5 w-5" />Request Resident Approval for Walk-in</Button>
                <p className="text-xs text-muted-foreground">Walk-in generates a pass and requests real-time resident approval via notification. Once approved by the resident, the pass appears in Expected Visitors for fast check-in.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* OFFLINE SYNC QUEUE DRAWER */}
      <Sheet open={syncDrawerOpen} onOpenChange={setSyncDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-5 border-b border-border/70">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Offline Terminal & Sync Queue
              </SheetTitle>
              <Badge variant={isOnline ? "default" : "destructive"} className="text-[10px] font-mono">
                {isOnline ? "ONLINE" : "OFFLINE"}
              </Badge>
            </div>
            <SheetDescription className="text-xs">
              All transactions logged during network drops are stored with cryptographic UUID idempotency and automatic server-wins sync.
            </SheetDescription>
          </SheetHeader>

          <div className="p-4 bg-muted/40 border-b border-border/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs font-mono">
              <span className="text-amber-600 font-semibold">{queueItems.filter(i => !i.synced && !i.failed).length} Pending</span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold">{queueItems.filter(i => i.synced).length} Synced</span>
              {queueItems.filter(i => i.failed).length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-red-600 font-semibold">{queueItems.filter(i => i.failed).length} Failed</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={clearSyncedEntriesHandler}
                className="h-7 text-xs gap-1"
                disabled={queueItems.filter(i => i.synced).length === 0}
              >
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
              <Button
                size="sm"
                onClick={syncOfflineQueue}
                disabled={isSyncing || !isOnline || queueItems.filter(i => !i.synced && !i.failed).length === 0}
                className="h-7 text-xs gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {queueItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs font-mono">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
                Queue is completely clear. No pending offline transactions.
              </div>
            ) : (
              queueItems.map((item) => (
                <div
                  key={item.idempotencyKey}
                  className="rounded-lg border border-border/70 p-3 bg-card space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded bg-muted">
                      {item.actionType || item.entryType}
                    </span>
                    {item.synced ? (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> SYNCED
                      </Badge>
                    ) : item.failed ? (
                      <Badge variant="destructive" className="text-[10px]">
                        <XCircle className="h-2.5 w-2.5 mr-1" /> FAILED
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/40">
                        <Clock className="h-2.5 w-2.5 mr-1" /> PENDING
                      </Badge>
                    )}
                  </div>

                  <div className="text-muted-foreground font-mono text-[11px]">
                    Time: {new Date(item.timestamp).toLocaleTimeString()} • {new Date(item.timestamp).toLocaleDateString()}
                  </div>

                  {item.notes && (
                    <div className="text-foreground font-medium text-xs">
                      {item.notes}
                    </div>
                  )}

                  {item.failed && item.failReason && (
                    <div className="text-destructive font-mono text-[11px] bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900">
                      Reason: {item.failReason}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
                    <span>UUID: {item.idempotencyKey.slice(0, 8)}...</span>
                    {item.failed && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismissFailed(item.idempotencyKey)}
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetryFailed(item.idempotencyKey)}
                          className="h-6 px-2 text-[10px] gap-1"
                        >
                          <RotateCcw className="h-2.5 w-2.5" /> Retry
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* EMERGENCY MANUAL PASS DIALOG */}
      <Dialog open={manualPassOpen} onOpenChange={setManualPassOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Emergency Manual Gate Pass
            </DialogTitle>
            <DialogDescription className="text-xs">
              Issue an urgent manual pass during network outage or for unscheduled visitors. Saves locally if offline and syncs automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Visitor Full Name *</Label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={manualPassForm.name}
                onChange={(e) => setManualPassForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Phone Number *</Label>
              <Input
                placeholder="e.g. 9876543210"
                value={manualPassForm.phone}
                onChange={(e) => setManualPassForm(f => ({ ...f, phone: e.target.value }))}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Destination Unit *</Label>
                <Select
                  value={manualPassForm.unitId}
                  onValueChange={(val) => setManualPassForm(f => ({ ...f, unitId: val }))}
                >
                  <SelectTrigger className="h-9 text-xs font-mono">
                    <SelectValue placeholder="Select Flat" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {unitList.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs font-mono">
                        Flat {u.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Purpose</Label>
                <Select
                  value={manualPassForm.purpose}
                  onValueChange={(val) => setManualPassForm(f => ({ ...f, purpose: val }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Delivery / Service" className="text-xs">Delivery / Service</SelectItem>
                    <SelectItem value="Guest / Family" className="text-xs">Guest / Family</SelectItem>
                    <SelectItem value="Maintenance / Repair" className="text-xs">Maintenance / Repair</SelectItem>
                    <SelectItem value="Emergency / Medical" className="text-xs">Emergency / Medical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Vehicle Number (Optional)</Label>
              <Input
                placeholder="e.g. MH12AB1234"
                value={manualPassForm.vehicleNumber}
                onChange={(e) => setManualPassForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))}
                className="h-9 text-xs font-mono uppercase"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Guard Notes</Label>
              <Input
                placeholder="e.g. Verified Aadhaar card / Amazon package delivery"
                value={manualPassForm.notes}
                onChange={(e) => setManualPassForm(f => ({ ...f, notes: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualPassOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitManualPass}
              disabled={isSubmittingPass}
              className="text-xs font-semibold"
            >
              {isSubmittingPass ? "Logging Pass..." : "Authorize Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
