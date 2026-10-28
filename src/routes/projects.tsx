import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Amount, PageHeader, StatusBadge } from "@/components/finance-ui";
import { RecordManager, recordsQuery } from "@/components/record-manager";
import { formatDate } from "@/lib/money";

const statuses = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [
    { title: "Projects · FirmAnt Finance" },
    { name: "description", content: "FirmAnt projects with client, contract value and status." },
    { property: "og:title", content: "Projects · FirmAnt Finance" },
    { property: "og:description", content: "FirmAnt project and contract records." },
  ] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: clients = [] } = useQuery(recordsQuery("clients"));
  const clientName = (id: unknown) => String(clients.find((c) => c.id === id)?.name ?? "—");
  const clientOptions = clients.filter((c) => c.is_active).map((c) => ({ value: String(c.id), label: String(c.name) }));
  return (
    <div>
      <PageHeader title="Projects" description="Contracts with clients. Receipts are always linked to a project." />
      <RecordManager
        table="projects" singular="Project"
        fields={[
          { name: "code", label: "Project code", required: true },
          { name: "client_id", label: "Client", type: "select", options: clientOptions, required: true },
          { name: "name", label: "Project name", required: true },
          { name: "contract_value", label: "Contract value (FCFA)", type: "number", required: true },
          { name: "start_date", label: "Start date", type: "date", required: true, default: new Date().toISOString().slice(0, 10) },
          { name: "status", label: "Status", type: "select", options: statuses, required: true, default: "active" },
          { name: "description", label: "Description", type: "textarea" },
        ]}
        columns={[
          { label: "Code", render: (r) => <span className="num font-medium">{String(r.code)}</span> },
          { label: "Project", render: (r) => String(r.name) },
          { label: "Client", render: (r) => clientName(r.client_id) },
          { label: "Contract value", className: "text-right", render: (r) => <Amount value={Number(r.contract_value)} /> },
          { label: "Start", render: (r) => formatDate(r.start_date as string) },
          { label: "Stage", render: (r) => <StatusBadge status={String(r.status)} /> },
        ]}
      />
    </div>
  );
}
