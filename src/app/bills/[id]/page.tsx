"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Wallet, Calendar, Clock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { amountToPaise } from "@/lib/payments/provider";
import { formatINR } from "@/lib/format";
function isPaidOutstanding(outstanding: string){ try { return amountToPaise(outstanding) <= 1; } catch { return false; } }
function hasOutstanding(outstanding: string){ try { return amountToPaise(outstanding) > 0; } catch { return false; } }

declare global { interface Window { Razorpay: any } }

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject)=>{
    if (typeof window !== "undefined" && window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = ()=> resolve();
    script.onerror = ()=> reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

export default function BillDetail(){
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [data, setData]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [error, setError]=useState<string|null>(null);
  const [paying, setPaying]=useState(false);

  async function refresh(){
    try {
      const r = await fetch(`/api/bills/${params.id}`);
      if(!r.ok) throw new Error();
      setData(await r.json());
    } catch { setError("Couldn't load bill"); }
  }

  useEffect(()=>{
    refresh().finally(()=>setLoading(false));
  }, [params.id]);

  async function handlePay(){
    if (!data) return;
    const outstanding = data.outstanding || data.bill.total;
    if (!hasOutstanding(outstanding)) return toast.error("Bill already paid");
    setPaying(true);
    try {
      const orderRes = await fetch("/api/payments/create-order", {
        method:"POST",
        headers:{ "Content-Type":"application/json"},
        body: JSON.stringify({ billId: data.bill.id }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      if (orderData.keyId === "mock_key_id" || !window.Razorpay) {
        // Mock gateway fallback: auto-simulate success in development
        try {
          await loadRazorpay();
        } catch {}

        if (!window.Razorpay) {
          const fakePaymentId = `pay_mock_${Date.now()}`;
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: orderData.orderId,
              razorpay_payment_id: fakePaymentId,
              razorpay_signature: "mock_signature",
              paymentId: orderData.paymentId,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyData.error || "Mock verification failed");
          toast.success("Mock payment simulated & verified");
          refresh();
          setPaying(false);
          return;
        }
      }

      await loadRazorpay();

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Society OS",
        description: data.bill.title,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method:"POST",
              headers:{ "Content-Type":"application/json"},
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                paymentId: orderData.paymentId,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed");
            toast.success("Payment verified — bill updated");
            refresh();
          } catch (e:any) {
            toast.error(e.message || "Verification failed");
          } finally { setPaying(false); }
        },
        prefill: { name: "", contact: "" },
        theme: { color: "#000000" },
        modal: { ondismiss: ()=> setPaying(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response:any){
        toast.error(response.error?.description || "Payment failed");
        setPaying(false);
      });
      rzp.open();
    } catch (e:any) {
      toast.error(e.message || "Payment failed");
      setPaying(false);
    }
  }

  if(loading) return <AppShell><div className="max-w-2xl mx-auto animate-pulse h-40 bg-muted rounded-xl" /></AppShell>;
  if(error || !data) return <AppShell><div className="max-w-2xl mx-auto"><Card><CardContent className="py-10 text-center"><p className="text-sm">{error || "Not found"}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>router.push("/bills")}>Back</Button></CardContent></Card></div></AppShell>;

  const { bill, unit, payments, outstanding } = data;
  const isOverdue = new Date(bill.dueDate) < new Date(new Date().setHours(0,0,0,0)) && bill.status!=="PAID";
  const totalOutstanding = outstanding || bill.total;
  const isPaid = bill.status==="PAID" || isPaidOutstanding(totalOutstanding);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={()=>router.push("/bills")}>← Bills</Button>

        <Card className={isOverdue ? "border-l-4 border-l-red-500" : ""}>
          <CardContent className="pt-6">
            <div className="flex justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold">{bill.title}</h1>
                <p className="text-sm text-muted-foreground">Unit {unit?.number || bill.unitId.slice(0,8)} • {bill.status}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Calendar className="h-3 w-3" />{bill.periodStart} → {bill.periodEnd} • Due {bill.dueDate}</p>
              </div>
              <StatusBadge status={isOverdue ? "OVERDUE" : bill.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-semibold">{formatINR(bill.total)}</p><p className="text-xs text-muted-foreground">Sub {formatINR(bill.subtotal)} + Tax {formatINR(bill.tax)}</p></div>
              <div><p className="text-xs text-muted-foreground">Outstanding</p><p className={`text-lg font-semibold ${hasOutstanding(totalOutstanding) ? "text-amber-700" : "text-emerald-600"}`}>{formatINR(totalOutstanding)}</p><p className="text-xs text-muted-foreground">{isPaid ? "Paid in full" : isOverdue ? "Overdue" : "Due soon"}</p></div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={handlePay} disabled={isPaid || paying}>
                <CreditCard className="h-4 w-4 mr-2" />{isPaid ? "Paid" : paying ? "Processing..." : `Pay ${formatINR(totalOutstanding)}`}
              </Button>
              <Badge variant="outline" className="px-2 py-1 h-10 flex items-center">Ref {bill.id.slice(0,8)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">Razorpay • UPI/Card • Secure • Server verified</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />Payment History</CardTitle></CardHeader>
          <CardContent>
            {payments.length===0 ? (
              <div className="py-6 text-center">
                <CreditCard className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium mt-2">No payments yet</p>
                <p className="text-xs text-muted-foreground">Payments for this bill appear here. Server is authoritative.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {payments.map((p:any)=>(
                  <li key={p.id} className="flex justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{formatINR(p.amount)} • {p.method}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(p.createdAt).toLocaleString()} • {p.gateway} • {p.gatewayRef?.slice(0,12) || "—"}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Bill Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="font-medium">{bill.title}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span>{bill.periodStart} → {bill.periodEnd}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className={isOverdue ? "text-red-600 font-medium" : ""}>{bill.dueDate} {isOverdue && "(Overdue)"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(bill.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatINR(bill.tax)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatINR(bill.total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={isOverdue ? "OVERDUE" : bill.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span>{unit?.number || bill.unitId.slice(0,8)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ref</span><span className="font-mono text-xs">{bill.id}</span></div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
