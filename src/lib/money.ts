// Pure financial helpers shared by UI and tests. Amounts are whole FCFA (XAF).

export function formatFCFA(amount: number | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  const s = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(Math.abs(n))
    .replace(/\u202f|\u00a0/g, " ");
  return `${n < 0 ? "-" : ""}FCFA ${s}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00" : d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export type Movement = { direction: "in" | "out"; amount: number };

/** Account balance = opening + confirmed incoming − confirmed outgoing. */
export function accountBalance(opening: number, movements: Movement[]): number {
  return movements.reduce((b, m) => (m.direction === "in" ? b + m.amount : b - m.amount), opening);
}

export type ReceiptLite = { amount: number; status: "posted" | "reversed" };

/** Total confirmed client receipts (reversed receipts excluded). */
export function totalReceived(receipts: ReceiptLite[]): number {
  return receipts.filter((r) => r.status === "posted").reduce((s, r) => s + r.amount, 0);
}

/** Outstanding contract balance = contract value − confirmed receipts. */
export function outstandingContract(contractValue: number, receipts: ReceiptLite[]): number {
  return contractValue - totalReceived(receipts);
}

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "orange_money", label: "Orange Money" },
  { value: "bank_transfer", label: "Bank transfer" },
] as const;

export const ACCOUNT_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "orange_money", label: "Orange Money" },
  { value: "bank", label: "Bank" },
] as const;

export function labelOf(list: readonly { value: string; label: string }[], v: string | null | undefined) {
  return list.find((x) => x.value === v)?.label ?? v ?? "—";
}
