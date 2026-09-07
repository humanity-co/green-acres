"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Share2,
  Building2,
  Calendar,
  ShieldCheck,
  Clock,
  MapPin,
  QrCode as QrIcon,
  MessageCircle,
} from "lucide-react";

export interface VisitorPassDetails {
  code: string;
  visitorName: string;
  visitorPhone?: string;
  unitNumber: string;
  societyName?: string;
  societyAddress?: string;
  purpose?: string;
  validFrom?: string;
  validTo: string;
}

interface VisitorPassCardProps {
  pass: VisitorPassDetails;
  onClose?: () => void;
}

export function VisitorPassCard({ pass, onClose }: VisitorPassCardProps) {
  const [copied, setCopied] = useState(false);

  const formattedValidTo = pass.validTo
    ? new Date(pass.validTo).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Today";

  const shareText = `🎫 *VISITOR PASS — ${pass.societyName || "GREEN ACRES RESIDENCY"}*
👤 Guest: *${pass.visitorName}*
📍 Destination: *Unit ${pass.unitNumber}*
🔑 Gate Pass PIN: *${pass.code}*
⏰ Valid until: *${formattedValidTo}*

👉 Present this 6-digit PIN at Main Gate security terminal for fast-track entry.`;

  async function copyPin() {
    await navigator.clipboard.writeText(pass.code);
    setCopied(true);
    toast.success(`PIN ${pass.code} copied to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
    toast.success("Opening WhatsApp with visitor pass...");
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Visitor Pass ${pass.code} — ${pass.societyName || "Green Acres"}`,
          text: shareText,
        });
        toast.success("Pass shared successfully");
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Pass details copied to clipboard");
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex flex-col">
      {/* Pass Header */}
      <div className="bg-primary text-primary-foreground p-4 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary-foreground/15 flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-tight leading-none">
                {pass.societyName || "Green Acres Residency"}
              </p>
              <p className="text-[10px] text-primary-foreground/75 font-mono mt-0.5">
                Official Security Credential
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono border-primary-foreground/30 text-primary-foreground bg-primary-foreground/10">
            FAST-TRACK PASS
          </Badge>
        </div>
      </div>

      {/* Main Pass Body */}
      <div className="p-5 space-y-5 bg-card text-foreground">
        {/* Pass PIN Hero */}
        <div className="text-center py-2 bg-secondary/50 rounded-xl border border-border/60">
          <p className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground font-semibold">
            Gate Entry PIN
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.25em] text-foreground pl-[0.25em]">
              {pass.code}
            </span>
          </div>
          <button
            onClick={copyPin}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "PIN Copied" : "Click to copy PIN"}</span>
          </button>
        </div>

        {/* QR Code Graphic (High precision architectural SVG) */}
        <div className="flex flex-col items-center justify-center py-1">
          <div className="p-3 bg-white rounded-xl border border-border/80 shadow-inner">
            <svg
              className="w-36 h-36"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Corner squares */}
              <rect x="10" y="10" width="24" height="24" rx="4" fill="#09090B" />
              <rect x="14" y="14" width="16" height="16" rx="2" fill="#FFFFFF" />
              <rect x="18" y="18" width="8" height="8" rx="1" fill="#09090B" />

              <rect x="66" y="10" width="24" height="24" rx="4" fill="#09090B" />
              <rect x="70" y="14" width="16" height="16" rx="2" fill="#FFFFFF" />
              <rect x="74" y="18" width="8" height="8" rx="1" fill="#09090B" />

              <rect x="10" y="66" width="24" height="24" rx="4" fill="#09090B" />
              <rect x="14" y="70" width="16" height="16" rx="2" fill="#FFFFFF" />
              <rect x="18" y="74" width="8" height="8" rx="1" fill="#09090B" />

              {/* Data pattern modules */}
              <rect x="42" y="14" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="52" y="14" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="42" y="24" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="52" y="28" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="42" y="42" width="16" height="16" rx="3" fill="#09090B" />
              <rect x="46" y="46" width="8" height="8" rx="1" fill="#FFFFFF" />
              <rect x="14" y="44" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="24" y="44" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="74" y="44" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="84" y="44" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="66" y="66" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="76" y="66" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="84" y="76" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="66" y="84" width="6" height="6" rx="1" fill="#09090B" />
              <rect x="76" y="84" width="6" height="6" rx="1" fill="#09090B" />
            </svg>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono mt-1.5 flex items-center gap-1">
            <QrIcon className="h-3 w-3" /> Optical Scan / Camera Token
          </span>
        </div>

        {/* Credential Data Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs border-t border-b border-border/60 py-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Guest Name</p>
            <p className="font-semibold text-foreground truncate mt-0.5">{pass.visitorName}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Host Flat</p>
            <p className="font-semibold text-foreground font-mono truncate mt-0.5">Unit {pass.unitNumber}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Purpose</p>
            <p className="text-foreground truncate mt-0.5">{pass.purpose || "Guest Visit"}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Valid Until</p>
            <p className="text-foreground font-mono truncate mt-0.5">{formattedValidTo}</p>
          </div>
        </div>

        {/* Gate Instructions */}
        <div className="rounded-lg bg-secondary/40 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>Present this pass to Main Gate security for automated fast-track entry.</span>
        </div>

        {/* 1-Tap WhatsApp & Native Share Actions */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={shareWhatsApp}
            className="w-full h-11 text-xs font-semibold bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-sm flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4 fill-white" />
            <span>Share via WhatsApp</span>
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={shareNative}
              className="h-9 text-xs font-medium border-border/80"
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              <span>Share Pass</span>
            </Button>
            <Button
              variant="outline"
              onClick={copyPin}
              className="h-9 text-xs font-medium border-border/80"
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              <span>{copied ? "Copied" : "Copy PIN"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisitorPassModal({
  open,
  onOpenChange,
  pass,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pass: VisitorPassDetails | null;
}) {
  if (!pass) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-sm">
        <VisitorPassCard pass={pass} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
