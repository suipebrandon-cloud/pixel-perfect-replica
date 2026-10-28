import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/finance-ui";
import { RecordManager } from "@/components/record-manager";

const kinds = [{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }];

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [
    { title: "Categories · FirmAnt Finance" },
    { name: "description", content: "Income and expense categories used across FirmAnt records." },
    { property: "og:title", content: "Categories · FirmAnt Finance" },
    { property: "og:description", content: "Income and expense categories." },
  ] }),
  component: () => (
    <div>
      <PageHeader title="Categories" description="Income and expense categories." />
      <RecordManager
        table="categories" singular="Category"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "kind", label: "Kind", type: "select", options: kinds, required: true, default: "expense" },
        ]}
        columns={[
          { label: "Name", render: (r) => <span className="font-medium">{String(r.name)}</span> },
          { label: "Kind", render: (r) => <span className="capitalize">{String(r.kind)}</span> },
        ]}
      />
    </div>
  ),
});
