import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Amount, EmptyRow, PageHeader, StatCard, StatusBadge } from "@/components/finance-ui";
import { getDashboard } from "@/lib/finance.functions";
import { formatFCFA } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dashboard · FirmAnt Finance" },
    { name: "description", content: "FirmAnt cash position: Cash, MTN MoMo and Orange Money balances, receipts and project balances." },
    { property: "og:title", content: "Dashboard · FirmAnt Finance" },
    { property: "og:description", content: "FirmAnt cash position and project balances." },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const { data, isLoading } = useQuery({ queryKey: ["dashboard", from, to], queryFn: () => getDashboard({ data: { from, to } }) });
  const balances = (data?.balances ?? []).filter((b) => b.is_active);
  const total = balances.reduce((s, b) => s + Number(b.balance), 0);
  const projects = data?.projects ?? [];
  const outstanding = projects.reduce((s, p) => s + Math.max(0, Number(p.outstanding)), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Every figure is calculated from posted records."
        actions={
          <div className="flex items-end gap-2">
            <div className="grid gap-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" /></div>
            <div className="grid gap-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" /></div>
          </div>
        }
      />

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Current balances</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((b) => (
            <Link key={b.id} to="/accounts"><StatCard label={b.name!} value={<Amount value={Number(b.balance)} signed />} /></Link>
          ))}
          <StatCard label="Total cash position" value={<Amount value={total} signed />} emphasis />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link to="/receipts"><StatCard label="Client receipts (period)" value={<Amount value={data?.received ?? 0} />} hint="Cash received — not earned revenue" /></Link>
        <Link to="/receipts"><StatCard label="Reversals (period)" value={<Amount value={data?.reversed ?? 0} />} /></Link>
        <Link to="/projects"><StatCard label="Outstanding contract balances" value={<Amount value={outstanding} />} hint="Contract value − confirmed receipts" /></Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-md border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Balance by account</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balances.map((b) => ({ name: b.name, balance: Number(b.balance) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatFCFA(v)} />
                <Bar dataKey="balance" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="overflow-x-auto rounded-md border bg-card lg:col-span-3">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Project</TableHead><TableHead className="text-right">Contract</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Stage</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <EmptyRow cols={5} text="Loading…" />}
              {!isLoading && projects.length === 0 && <EmptyRow cols={5} text="No projects yet." />}
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><span className="num text-xs font-medium">{p.code}</span><div className="text-xs text-muted-foreground">{p.client_name}</div></TableCell>
                  <TableCell className="text-right"><Amount value={Number(p.contract_value)} /></TableCell>
                  <TableCell className="text-right"><Amount value={Number(p.received)} /></TableCell>
                  <TableCell className="text-right"><Amount value={Number(p.outstanding)} signed /></TableCell>
                  <TableCell><StatusBadge status={String(p.status)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
