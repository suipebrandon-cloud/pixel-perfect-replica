/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listRecords,
  saveRecord,
  setRecordActive,
  deleteRecord,
  recordSchemas,
  type RecordTable,
} from "@/lib/finance.functions";
import { EmptyRow, StatusBadge } from "@/components/finance-ui";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  default?: string;
};
export type Column = { label: string; render: (row: any) => React.ReactNode; className?: string };

export const recordsQuery = (table: RecordTable) => ({
  queryKey: ["records", table],
  queryFn: () => listRecords({ data: { table } }),
});

export function RecordManager({
  table,
  singular,
  fields,
  columns,
}: {
  table: RecordTable;
  singular: string;
  fields: Field[];
  columns: Column[];
}) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery(recordsQuery(table));
  const save = useServerFn(saveRecord);
  const toggle = useServerFn(setRecordActive);
  const del = useServerFn(deleteRecord);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["records", table] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const startEdit = (row: any | null) => {
    setEditing(row);
    const v: Record<string, string> = {};
    fields.forEach((f) => (v[f.name] = row ? String(row[f.name] ?? "") : (f.default ?? "")));
    setValues(v);
    setErrors({});
    setOpen(true);
  };

  const saveM = useMutation({
    mutationFn: async () => {
      const parsed = recordSchemas[table].safeParse(values);
      if (!parsed.success) {
        const e: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (e[String(i.path[0])] = i.message));
        setErrors(e);
        throw new Error("Please fix the highlighted fields.");
      }
      await save({ data: { table, id: editing?.id as string | undefined, values } });
    },
    onSuccess: () => {
      toast.success(`${singular} saved`);
      setOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onToggle = async (row: any) => {
    try {
      await toggle({ data: { table, id: row.id as string, active: !row.is_active } });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const onDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del({ data: { table, id: confirmDelete.id as string } });
      toast.success(`${singular} deleted`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => startEdit(null)}>
          <Plus className="h-4 w-4" /> New {singular.toLowerCase()}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.label} className={c.className}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <EmptyRow cols={columns.length + 2} text="Loading…" />}
            {!isLoading && rows.length === 0 && (
              <EmptyRow
                cols={columns.length + 2}
                text={`No ${singular.toLowerCase()} records yet.`}
              />
            )}
            {rows.map((row) => (
              <TableRow key={row.id as string} className={row.is_active ? "" : "opacity-60"}>
                {columns.map((c) => (
                  <TableCell key={c.label} className={c.className}>
                    {c.render(row)}
                  </TableCell>
                ))}
                <TableCell>
                  <StatusBadge status={row.is_active ? "active" : "inactive"} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => startEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={row.is_active ? "Deactivate" : "Activate"}
                      onClick={() => onToggle(row)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => setConfirmDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveM.mutate();
            }}
          >
            {fields.map((f) => (
              <div key={f.name} className="grid gap-1.5">
                <Label htmlFor={f.name}>
                  {f.label}
                  {f.required && <span className="text-primary"> *</span>}
                </Label>
                {f.type === "select" ? (
                  <Select
                    {...(values[f.name] ? { value: values[f.name] } : {})}
                    onValueChange={(v) => setValues({ ...values, [f.name]: v })}
                  >
                    <SelectTrigger id={f.name}>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea
                    id={f.name}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                ) : (
                  <Input
                    id={f.name}
                    type={f.type ?? "text"}
                    step={f.type === "number" ? 1 : undefined}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                )}
                {errors[f.name] && <p className="text-xs text-destructive">{errors[f.name]}</p>}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveM.isPending}>
                {saveM.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              Records already used by projects or transactions cannot be deleted — deactivate them
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
