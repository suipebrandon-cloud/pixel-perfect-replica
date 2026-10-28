import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/finance-ui";
import { RecordManager } from "@/components/record-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const payeeKinds = [
  { value: "supplier", label: "Supplier" },
  { value: "contractor", label: "Contractor" },
  { value: "other", label: "Other" },
];

export const Route = createFileRoute("/people")({
  head: () => ({ meta: [
    { title: "Staff & payees · FirmAnt Finance" },
    { name: "description", content: "FirmAnt staff, contract workers, suppliers and other payees." },
    { property: "og:title", content: "Staff & payees · FirmAnt Finance" },
    { property: "og:description", content: "Staff and payee records." },
  ] }),
  component: () => (
    <div>
      <PageHeader title="Staff & payees" description="People and businesses FirmAnt pays." />
      <Tabs defaultValue="staff">
        <TabsList><TabsTrigger value="staff">Staff</TabsTrigger><TabsTrigger value="payees">Payees</TabsTrigger></TabsList>
        <TabsContent value="staff">
          <RecordManager table="staff" singular="Staff member"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "role", label: "Role" },
              { name: "phone", label: "Phone" },
              { name: "email", label: "Email" },
            ]}
            columns={[
              { label: "Name", render: (r) => <span className="font-medium">{String(r.name)}</span> },
              { label: "Role", render: (r) => String(r.role ?? "—") },
              { label: "Phone", render: (r) => String(r.phone ?? "—") },
            ]}
          />
        </TabsContent>
        <TabsContent value="payees">
          <RecordManager table="payees" singular="Payee"
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "kind", label: "Type", type: "select", options: payeeKinds, required: true, default: "supplier" },
              { name: "phone", label: "Phone" },
              { name: "email", label: "Email" },
              { name: "address", label: "Address" },
            ]}
            columns={[
              { label: "Name", render: (r) => <span className="font-medium">{String(r.name)}</span> },
              { label: "Type", render: (r) => <span className="capitalize">{String(r.kind)}</span> },
              { label: "Phone", render: (r) => String(r.phone ?? "—") },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  ),
});
