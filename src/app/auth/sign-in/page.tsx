"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Phone, Shield, ShieldCheck, ArrowRight, Building2, User, KeyRound } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(targetPhone?: string) {
    const p = targetPhone || phone;
    if (!p) return toast.error("Enter phone number");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Security OTP sent");
      setStep("otp");
    } catch (e: any) {
      toast.error(e.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return toast.error("Enter 6-digit verification code");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Authenticated: Welcome, ${data.user.fullName}!`);
      router.push("/");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(num: string) {
    setPhone(num);
    setOtp("123456");
    requestOtp(num);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Background Architectural Geometry */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/50 via-background to-background pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Crest */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Society OS</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Green Acres Residency</p>
        </div>

        <Card className="border border-border/80 bg-card/95 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <CardHeader className="text-center pb-4 pt-6">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {step === "phone" ? "Mobile Verification" : "Security Passcode"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {step === "phone"
                ? "Enter your registered 10-digit mobile number to access your estate portal."
                : `Verification code dispatched to ${phone}.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pb-6">
            {step === "phone" ? (
              <div className="space-y-3.5">
                <div className="relative">
                  <Input
                    placeholder="Mobile number (e.g. 7777777777)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") requestOtp(); }}
                    className="h-12 pl-3 text-sm font-mono tracking-wider text-foreground border-border/80 focus-visible:ring-primary"
                    autoFocus
                  />
                </div>

                <Button
                  onClick={() => requestOtp()}
                  disabled={loading || !phone}
                  className="w-full h-11 text-xs font-semibold uppercase tracking-wider font-mono shadow-sm"
                >
                  {loading ? "Requesting OTP..." : "Continue with OTP"}
                  {!loading && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center py-2">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-12 w-10 sm:w-11 rounded-lg border border-border/90 text-lg font-mono font-bold"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Code: <strong className="font-mono text-foreground">123456</strong> (Mock Active)</span>
                  <button
                    onClick={() => setStep("phone")}
                    className="text-primary hover:underline font-medium"
                  >
                    Change phone
                  </button>
                </div>

                <Button
                  onClick={verifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="w-full h-11 text-xs font-semibold uppercase tracking-wider font-mono shadow-sm"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => requestOtp()}
                  disabled={loading}
                >
                  Resend Security Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demo Quick-Switch Shortcuts (Convenient Silicon Valley Testing Deck) */}
        <div className="rounded-xl border border-border/70 bg-secondary/40 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-mono font-semibold text-muted-foreground text-center">
            One-Click Role Demonstration
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <button
              onClick={() => fillDemo("7777777777")}
              className="px-2 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-secondary text-[11px] font-medium text-foreground transition-colors"
            >
              Resident
              <span className="block text-[9px] text-muted-foreground font-mono">7777777777</span>
            </button>
            <button
              onClick={() => fillDemo("8888888888")}
              className="px-2 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-secondary text-[11px] font-medium text-foreground transition-colors"
            >
              Gate Guard
              <span className="block text-[9px] text-muted-foreground font-mono">8888888888</span>
            </button>
            <button
              onClick={() => fillDemo("9999999999")}
              className="px-2 py-1.5 rounded-lg border border-border/60 bg-card hover:bg-secondary text-[11px] font-medium text-foreground transition-colors"
            >
              Estate Admin
              <span className="block text-[9px] text-muted-foreground font-mono">9999999999</span>
            </button>
          </div>
        </div>

        {/* Security Reassurance Footer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground font-mono">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Tenant Isolated • 256-Bit Encrypted Session</span>
        </div>
      </div>
    </div>
  );
}
