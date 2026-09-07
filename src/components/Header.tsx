"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function Header() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user)).catch(()=>{}); }, []);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); toast.success("Signed out"); location.href="/auth/sign-in"; }
  return (
    <header className="border-b bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold">Gated Community</Link>
        <div className="flex items-center gap-3">
          {user ? <><span className="text-sm">{user.fullName} • {user.phone}</span><Button size="sm" variant="outline" onClick={logout}>Sign out</Button></> : <Link href="/auth/sign-in"><Button size="sm">Sign in</Button></Link>}
        </div>
      </div>
    </header>
  );
}
