import { amountToPaise } from "@/lib/payments/provider";
export function formatINR(amount: string | number): string {
  try {
    if (typeof amount === "string") {
      const paise = amountToPaise(amount);
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
    }
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount / 100);
  } catch {
    const n = typeof amount === "string" ? Number(amount) : amount / 100;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(isNaN(n) ? 0 : n);
  }
}
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}
