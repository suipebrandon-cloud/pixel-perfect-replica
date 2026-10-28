/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Undo2 } from "lucide-react";
import { Amount, EmptyRow, PageHeader, StatusBadge } from "@/components/finance-ui";
import { recordsQuery } from "@/components/record-manager";
import { listReceipts, postReceipt, receiptSchema, reverseReceipt } from "@/lib/finance.functions";
import { PAYMENT_METHODS, formatDate, formatFCFA, labelOf } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/receipts")({
  head: () => ({ meta: [
    { title: "Client receipts · FirmAnt Finance" },
    { name: "description", content: "Record client payments into Cash, MTN MoMo or Orange Money, with reversals." },
    { property: "og:title", content: "Client receipts · FirmAnt Finance" },
    { property: "og:description", content: "Client payment records." },
  ] }),
  component: ReceiptsPage,
});

type Row = Awaited<ReturnType<typeof listReceipts>>[number];

const newKey = () => crypto.randomUUID();
type FormState = { client_id: string; project_id: string; receipt_date: string; amount: string; account_id: string; payment_method: string; reference: string; notes: string };

function ReceiptsPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["receipts"], queryFn: () => listReceipts() });
  const [open, setOpen] = useState(false);
  const [replacing, setReplacing] = useState<Row | null>(null);
  const [reversing, setReversing] = useState<Row | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["receipts"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["statement"] });
  };

  return (
    <div>
      <PageHeader
        title="Client receipts"
        description="Money received from clients. Posted receipts can't be edited or deleted — reverse and replace them instead."
        actions={<Button onClick={() => { setReplacing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Record receipt</Button>}
      />
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt no.</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Project</TableHead>
              <TableHead>Account</TableHead><TableHead>Method / ref.</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <EmptyRow cols={9} text="Loading…" />}
            {!isLoading && rows.length === 0 && <EmptyRow cols={9} text="No receipts recorded yet." />}
            {rows.map((r) => (
              <TableRow key={r.id} className={r.status === "reversed" ? "opacity-60" : ""}>
                <TableCell className="num text-xs font-medium">{r.receipt_no}</TableCell>
                <TableCell>{formatDate(r.receipt_date)}</TableCell>
                <TableCell>{r.clients?.name}</TableCell>
                <TableCell><span className="num text-xs">{r.projects?.code}</span> {r.projects?.name}</TableCell>
                <TableCell>{r.accounts?.name}</TableCell>
                <TableCell className="text-xs">{labelOf(PAYMENT_METHODS, r.payment_method)}<div className="text-muted-foreground">{r.reference}</div></TableCell>
                <TableCell className="text-right"><Amount value={Number(r.amount)} className={r.status === "reversed" ? "line-through" : ""} /></TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                  {r.reversal_reason && <div className="mt-1 max-w-40 text-xs text-muted-foreground">{r.reversal_reason}</div>}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "posted" && (
                    <Button size="sm" variant="ghost" onClick={() => setReversing(r)}><Undo2 className="h-4 w-4" /> Reverse</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {open && <ReceiptDialog replacing={replacing} onClose={() => setOpen(false)} onDone={refresh} />}
      {reversing && (
        <ReverseDialog
          row={reversing}
          onClose={() => setReversing(null)}
          onDone={(replace) => { refresh(); const r = reversing; setReversing(null); if (replace) { setReplacing(r); setOpen(true); } }}
        />
      )}
    </div>
  );
}

function ReceiptDialog({ replacing, onClose, onDone }: { replacing: Row | null; onClose: () => void; onDone: () => void }) {
  const { data: clients = [] } = useQuery(recordsQuery("clients"));
  const { data: projects = [] } = useQuery(recordsQuery("projects"));
  const { data: accounts = [] } = useQuery(recordsQuery("accounts"));
  const post = useServerFn(postReceipt);
  const [key] = useState(newKey); // one key per form → re-submits cannot double post
  const [v, setV] = useState<FormState>(() => ({
    client_id: replacing?.client_id ?? "",
    project_id: replacing?.project_id ?? "",
    receipt_date: replacing?.receipt_date ?? new Date().toISOString().slice(0, 10),
    amount: replacing ? String(replacing.amount) : "",
    account_id: replacing?.account_id ?? "",
    payment_method: replacing?.payment_method ?? "cash",
    reference: replacing?.reference ?? "",
    notes: replacing ? `Replaces ${replacing.receipt_no}` : "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [busy, setBusy] = useState(false);
  const clientProjects = useMemo(() => projects.filter((p) => p.client_id === v.client_id && p.is_active), [projects, v.client_id]);
  const set = (k: keyof FormState, val: string) => setV((s) => ({ ...s, [k]: val, ...(k === "client_id" ? { project_id: "" } : {}) }));
  const payload = { ...v, idempotency_key: key, replaces_receipt_id: replacing?.id ?? null };

  const review = () => {
    const p = receiptSchema.safeParse(payload);
    if (!p.success) {
      const e: Record<string, string> = {};
      p.error.issues.forEach((i) => (e[String(i.path[0])] = i.message));
      setErrors(e);
      return;
    }
    setErrors({});
    setStep("confirm");
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await post({ data: payload as never });
      toast.success("Receipt posted");
      onDone();
      onClose();
    } catch (e) { toast.error((e as Error).message); setStep("edit"); }
    setBusy(false);
  };
  const name = (list: any[], id: string) => String(list.find((x) => x.id === id)?.name ?? "—");

  const sel = (k: keyof FormState, label: string, opts: { value: string; label: string }[]) => (
    <div className="grid gap-1.5">
      <Label>{label} <span className="text-primary">*</span></Label>
      <Select {...(v[k] ? { value: v[k] } : {})} onValueChange={(val) => set(k, val)}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{replacing ? `Replacement for ${replacing.receipt_no}` : "Record client receipt"}</DialogTitle>
          <DialogDescription>Money received before work is approved is a client advance, not earned revenue.</DialogDescription>
        </DialogHeader>
        {step === "edit" ? (
          <div className="grid gap-3">
            {sel("client_id", "Client", clients.filter((c) => c.is_active).map((c) => ({ value: String(c.id), label: String(c.name) })))}
            {sel("project_id", "Project", clientProjects.map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` })))}
            {v.client_id && clientProjects.length === 0 && <p className="-mt-2 text-xs text-muted-foreground">This client has no active projects yet.</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Date <span className="text-primary">*</span></Label>
                <Input type="date" value={v.receipt_date} onChange={(e) => set("receipt_date", e.target.value)} />
                {errors.receipt_date && <p className="text-xs text-destructive">{errors.receipt_date}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label>Amount (FCFA) <span className="text-primary">*</span></Label>
                <Input type="number" min={1} step={1} className="num" value={v.amount} onChange={(e) => set("amount", e.target.value)} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
            </div>
            {sel("account_id", "Receiving account", accounts.filter((a) => a.is_active).map((a) => ({ value: String(a.id), label: String(a.name) })))}
            {sel("payment_method", "Payment method", PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })))}
            <div className="grid gap-1.5">
              <Label>Payment reference <span className="text-primary">*</span></Label>
              <Input value={v.reference} placeholder="e.g. MoMo transaction ID" onChange={(e) => set("reference", e.target.value)} />
              {errors.reference && <p className="text-xs text-destructive">{errors.reference}</p>}
            </div>
            <div className="grid gap-1.5"><Label>Notes</Label><Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={review}>Review</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md border bg-muted/40 p-4 text-sm">
              <dt className="text-muted-foreground">Client</dt><dd>{name(clients, v.client_id)}</dd>
              <dt className="text-muted-foreground">Project</dt><dd>{name(projects, v.project_id)}</dd>
              <dt className="text-muted-foreground">Date</dt><dd>{formatDate(v.receipt_date)}</dd>
              <dt className="text-muted-foreground">Into account</dt><dd>{name(accounts, v.account_id)}</dd>
              <dt className="text-muted-foreground">Method / ref.</dt><dd>{labelOf(PAYMENT_METHODS, v.payment_method)} · {v.reference}</dd>
              <dt className="text-muted-foreground">Amount</dt><dd className="num text-lg font-semibold text-primary">{formatFCFA(Number(v.amount))}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">Once posted, this receipt updates the account balance and can only be corrected by a reversal.</p>
            <DialogFooter><Button variant="outline" onClick={() => setStep("edit")}>Back</Button><Button onClick={confirm} disabled={busy}>{busy ? "Posting…" : "Confirm & post"}</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReverseDialog({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: (replace: boolean) => void }) {
  const reverse = useServerFn(reverseReceipt);
  const [reason, setReason] = useState("");
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (reason.trim().length < 3) { toast.error("Give a reason for the reversal."); return; }
    setBusy(true);
    try { await reverse({ data: { id: row.id, reason } }); toast.success(`${row.receipt_no} reversed`); onDone(replace); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse {row.receipt_no}?</DialogTitle>
          <DialogDescription>This posts an opposite entry of {formatFCFA(Number(row.amount))} out of {row.accounts?.name}. The original stays on record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5"><Label>Reason <span className="text-primary">*</span></Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong amount entered" /></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={replace} onCheckedChange={(c) => setReplace(!!c)} /> Record a corrected replacement afterwards</label>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="destructive" onClick={go} disabled={busy}>{busy ? "Reversing…" : "Reverse receipt"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
