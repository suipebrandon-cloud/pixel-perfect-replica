import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/finance-ui";
import { RecordManager } from "@/components/record-manager";

export const Route = createFileRoute("/clients")({
  head: () => ({ meta: [
    { title: "Clients · FirmAnt Finance" },
    { name: "description", content: "FirmAnt client records with contact details and notes." },
    { property: "og:title", content: "Clients · FirmAnt Finance" },
    { property: "og:description", content: "FirmAnt client records." },
  ] }),
  component: () => (
    <div>
      <PageHeader title="Clients" description="Client contact details. Clients with projects or receipts can only be deactivated." />
      <RecordManager
        table="clients" singular="Client"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "phone", label: "Phone" },
          { name: "email", label: "Email" },
          { name: "address", label: "Address" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        columns={[
          { label: "Name", render: (r) => <span className="font-medium">{String(r.name)}</span> },
          { label: "Phone", render: (r) => String(r.phone ?? "—") },
          { label: "Email", render: (r) => String(r.email ?? "—") },
          { label: "Address", render: (r) => String(r.address ?? "—") },
        ]}
      />
    </div>
  ),
});
