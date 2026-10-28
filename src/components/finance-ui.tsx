import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatFCFA } from "@/lib/money";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Amount({
  value,
  className,
  signed,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  return (
    <span className={cn("num", signed && value < 0 && "text-destructive", className)}>
      {formatFCFA(value)}
    </span>
  );
}

const tones: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  posted: "bg-success/10 text-success border-success/30",
  reversed: "bg-destructive/10 text-destructive border-destructive/30",
  inactive: "bg-muted text-muted-foreground border-border",
  planned: "bg-secondary text-secondary-foreground border-border",
  on_hold: "bg-accent text-accent-foreground border-primary/20",
  completed: "bg-foreground text-background border-foreground",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tones[status] ?? tones["inactive"],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-4",
        emphasis && "border-primary/40 border-l-4 border-l-primary",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}
