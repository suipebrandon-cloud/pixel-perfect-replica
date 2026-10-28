import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Amount, EmptyRow, PageHeader, StatCard } from "@/components/finance-ui";
import { RecordManager } from "@/components/record-manager";
import { ACCOUNT_TYPES, formatDate } from "@/lib/money";
import { getAccountStatement, getDashboard } from "@/lib/finance.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts · FirmAnt Finance" },
      {
        name: "description",
        content: "Cash, MTN MoMo and Orange Money balances and account statements.",
      },
      { property: "og:title", content: "Accounts · FirmAnt Finance" },
      { property: "og:description", content: "Account balances and statements." },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = useQuery({
    queryKey: ["dashboard", "all"],
    queryFn: () => getDashboard({ data: { from: "2000-01-01", to: "2999-12-31" } }),
  });
  const [statementId, setStatementId] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      <PageHeader
        title="Accounts"
        description="Balances are calculated from the opening balance and posted movements — they can't be typed in."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {(data?.balances ?? [])
          .filter((b) => b.is_active)
          .map((b) => (
            <button key={b.id} className="text-left" onClick={() => setStatementId(b.id!)}>
              <StatCard
                label={b.name!}
                value={<Amount value={Number(b.balance)} signed />}
                hint="View statement →"
                emphasis={b.type === "cash"}
              />
            </button>
          ))}
      </div>
      <RecordManager
        table="accounts"
        singular="Account"
        fields={[
          { name: "name", label: "Account name", required: true },
          {
            name: "type",
            label: "Type",
            type: "select",
            options: [...ACCOUNT_TYPES],
            required: true,
            default: "cash",
          },
          {
            name: "opening_balance",
            label: "Opening balance (FCFA)",
            type: "number",
            required: true,
            default: "0",
          },
          {
            name: "opening_date",
            label: "Opening date",
            type: "date",
            required: true,
            default: today,
          },
        ]}
        columns={[
          {
            label: "Account",
            render: (r) => <span className="font-medium">{String(r.name)}</span>,
          },
          {
            label: "Type",
            render: (r) => ACCOUNT_TYPES.find((t) => t.value === r.type)?.label ?? String(r.type),
          },
          {
            label: "Opening balance",
            className: "text-right",
            render: (r) => <Amount value={Number(r.opening_balance)} />,
          },
          { label: "Opening date", render: (r) => formatDate(r.opening_date as string) },
          {
            label: "",
            render: (r) => (
              <Button
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => setStatementId(String(r.id))}
              >
                Statement
              </Button>
            ),
          },
        ]}
      />
      <Sheet open={!!statementId} onOpenChange={(o) => !o && setStatementId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {statementId && <Statement accountId={statementId} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Statement({ accountId }: { accountId: string }) {
  const { data } = useQuery({
    queryKey: ["statement", accountId],
    queryFn: () => getAccountStatement({ data: { accountId } }),
  });
  if (!data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  let running = Number(data.account.opening_balance);
  const totalIn = data.movements
    .filter((m) => m.direction === "in")
    .reduce((s, m) => s + Number(m.amount), 0);
  const totalOut = data.movements
    .filter((m) => m.direction === "out")
    .reduce((s, m) => s + Number(m.amount), 0);
  return (
    <div>
      <SheetHeader>
        <SheetTitle>{data.account.name} — statement</SheetTitle>
      </SheetHeader>
      <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Opening" value={<Amount value={Number(data.account.opening_balance)} />} />
        <StatCard label="In" value={<Amount value={totalIn} />} />
        <StatCard label="Out" value={<Amount value={totalOut} />} />
        <StatCard
          label="Closing"
          value={<Amount value={running + totalIn - totalOut} signed />}
          emphasis
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">In</TableHead>
            <TableHead className="text-right">Out</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-muted/40">
            <TableCell>{formatDate(data.account.opening_date)}</TableCell>
            <TableCell>Opening balance</TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right">
              <Amount value={running} />
            </TableCell>
          </TableRow>
          {data.movements.length === 0 && <EmptyRow cols={5} text="No movements yet." />}
          {data.movements.map((m) => {
            running += m.direction === "in" ? Number(m.amount) : -Number(m.amount);
            return (
              <TableRow key={m.id}>
                <TableCell>{formatDate(m.movement_date)}</TableCell>
                <TableCell className="num text-xs">
                  {m.transactions?.reference}
                  <div className="font-sans text-muted-foreground">{m.description}</div>
                </TableCell>
                <TableCell className="text-right">
                  {m.direction === "in" ? <Amount value={Number(m.amount)} /> : ""}
                </TableCell>
                <TableCell className="text-right">
                  {m.direction === "out" ? <Amount value={Number(m.amount)} /> : ""}
                </TableCell>
                <TableCell className="text-right">
                  <Amount value={running} signed />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Closing balance</TableCell>
            <TableCell className="text-right">
              <Amount value={running} signed />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
