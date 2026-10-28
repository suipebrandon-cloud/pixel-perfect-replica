import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// NOTE: Until sign-in exists, all data access goes through these server functions
// using the admin client. Do NOT publish the app before access control is added.

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const opt = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const recordSchemas = {
  clients: z.object({
    name: z.string().trim().min(1, "Name is required"),
    phone: opt,
    email: opt,
    address: opt,
    notes: opt,
  }),
  projects: z.object({
    code: z.string().trim().min(1, "Code is required"),
    client_id: z.string().uuid("Choose a client"),
    name: z.string().trim().min(1, "Name is required"),
    contract_value: z.coerce.number().int().min(0),
    start_date: z.string().min(10, "Start date is required"),
    status: z.enum(["planned", "active", "on_hold", "completed", "cancelled"]),
    description: opt,
  }),
  accounts: z.object({
    name: z.string().trim().min(1),
    type: z.enum(["cash", "mtn_momo", "orange_money", "bank"]),
    opening_balance: z.coerce.number().int(),
    opening_date: z.string().min(10),
  }),
  categories: z.object({ name: z.string().trim().min(1), kind: z.enum(["income", "expense"]) }),
  staff: z.object({ name: z.string().trim().min(1), role: opt, phone: opt, email: opt }),
  payees: z.object({
    name: z.string().trim().min(1),
    kind: z.enum(["supplier", "contractor", "other"]),
    phone: opt,
    email: opt,
    address: opt,
  }),
} as const;

export type RecordTable = keyof typeof recordSchemas;
const tableEnum = z.enum(["clients", "projects", "accounts", "categories", "staff", "payees"]);

export const listRecords = createServerFn({ method: "GET" })
  .inputValidator((d: { table: RecordTable }) => ({ table: tableEnum.parse(d.table) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows, error } = await db
      .from(data.table)
      .select("*")
      .order("created_at", { ascending: true });
    fail(error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows ?? []) as any[];
  });

export const saveRecord = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { table: RecordTable; id?: string | undefined; values: Record<string, unknown> }) => {
      const table = tableEnum.parse(d.table);
      return {
        table,
        id: d.id ? z.string().uuid().parse(d.id) : undefined,
        values: recordSchemas[table].parse(d.values),
      };
    },
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const values = data.values as never;
    if (data.table === "accounts" && data.id) {
      // Opening balance cannot be edited once movements exist.
      const { count } = await db
        .from("account_movements")
        .select("id", { count: "exact", head: true })
        .eq("account_id", data.id);
      const { data: cur } = await db
        .from("accounts")
        .select("opening_balance")
        .eq("id", data.id)
        .single();
      if (
        (count ?? 0) > 0 &&
        cur &&
        cur.opening_balance !== (data.values as { opening_balance: number }).opening_balance
      ) {
        throw new Error(
          "Opening balance cannot change after money has moved through this account.",
        );
      }
    }
    const q = data.id
      ? db.from(data.table).update(values).eq("id", data.id)
      : db.from(data.table).insert(values);
    const { error } = await q;
    if (error?.code === "23505") throw new Error("A record with this name or code already exists.");
    fail(error);
    await db
      .from("audit_logs")
      .insert({
        entity: data.table,
        entity_id: data.id ?? null,
        action: data.id ? "updated" : "created",
        details: data.values as never,
      });
    return { ok: true };
  });

export const setRecordActive = createServerFn({ method: "POST" })
  .inputValidator((d: { table: RecordTable; id: string; active: boolean }) => ({
    table: tableEnum.parse(d.table),
    id: z.string().uuid().parse(d.id),
    active: z.boolean().parse(d.active),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from(data.table)
      .update({ is_active: data.active })
      .eq("id", data.id);
    fail(error);
    await db
      .from("audit_logs")
      .insert({
        entity: data.table,
        entity_id: data.id,
        action: data.active ? "activated" : "deactivated",
      });
    return { ok: true };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .inputValidator((d: { table: RecordTable; id: string }) => ({
    table: tableEnum.parse(d.table),
    id: z.string().uuid().parse(d.id),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from(data.table).delete().eq("id", data.id);
    if (error?.code === "23503")
      throw new Error("This record is used by other records. Deactivate it instead.");
    fail(error);
    await db
      .from("audit_logs")
      .insert({ entity: data.table, entity_id: data.id, action: "deleted" });
    return { ok: true };
  });

// ===== Receipts =====
export const receiptSchema = z.object({
  client_id: z.string().uuid("Choose a client"),
  project_id: z.string().uuid("Choose a project"),
  receipt_date: z.string().min(10, "Date is required"),
  amount: z.coerce.number().int("Whole FCFA only").positive("Amount must be greater than zero"),
  account_id: z.string().uuid("Choose an account"),
  payment_method: z.enum(["cash", "mtn_momo", "orange_money", "bank_transfer"]),
  reference: z.string().trim().min(1, "Reference is required"),
  notes: opt,
  idempotency_key: z.string().min(8),
  replaces_receipt_id: z.string().uuid().optional().nullable(),
});

export const listReceipts = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("receipts")
    .select("*, clients(name), projects(code,name), accounts(name)")
    .order("created_at", { ascending: false });
  fail(error);
  return data ?? [];
});

export const postReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof receiptSchema>) => receiptSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: id, error } = await db.rpc("post_receipt", {
      _client_id: data.client_id,
      _project_id: data.project_id,
      _date: data.receipt_date,
      _amount: data.amount,
      _account_id: data.account_id,
      _method: data.payment_method,
      _reference: data.reference,
      _notes: data.notes ?? "",
      _idempotency_key: data.idempotency_key,
      ...(data.replaces_receipt_id ? { _replaces: data.replaces_receipt_id } : {}),
    });
    fail(error);
    return { id: id as string };
  });

export const reverseReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; reason: string }) => ({
    id: z.string().uuid().parse(d.id),
    reason: z.string().trim().min(3, "Give a reason").parse(d.reason),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.rpc("reverse_receipt", {
      _receipt_id: data.id,
      _reason: data.reason,
    });
    fail(error);
    return { ok: true };
  });

// ===== Dashboard / statements =====
export const getDashboard = createServerFn({ method: "GET" })
  .inputValidator((d: { from: string; to: string }) => ({
    from: z.string().min(10).parse(d.from),
    to: z.string().min(10).parse(d.to),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const [bal, mov, proj] = await Promise.all([
      db.from("account_balances").select("*").order("name"),
      db
        .from("transactions")
        .select("type, amount, direction")
        .gte("txn_date", data.from)
        .lte("txn_date", data.to),
      db.from("project_financials").select("*").order("code"),
    ]);
    fail(bal.error);
    fail(mov.error);
    fail(proj.error);
    const txns = mov.data ?? [];
    const received = txns
      .filter((t) => t.type === "receipt")
      .reduce((s, t) => s + Number(t.amount), 0);
    const reversed = txns
      .filter((t) => t.type === "receipt_reversal")
      .reduce((s, t) => s + Number(t.amount), 0);
    return {
      balances: bal.data ?? [],
      received,
      reversed,
      netReceived: received - reversed,
      projects: proj.data ?? [],
    };
  });

export const getAccountStatement = createServerFn({ method: "GET" })
  .inputValidator((d: { accountId: string }) => ({
    accountId: z.string().uuid().parse(d.accountId),
  }))
  .handler(async ({ data }) => {
    const db = await admin();
    const [acc, mov] = await Promise.all([
      db.from("accounts").select("*").eq("id", data.accountId).single(),
      db
        .from("account_movements")
        .select("*, transactions(reference,type)")
        .eq("account_id", data.accountId)
        .order("movement_date")
        .order("created_at"),
    ]);
    fail(acc.error);
    fail(mov.error);
    return { account: acc.data!, movements: mov.data ?? [] };
  });
