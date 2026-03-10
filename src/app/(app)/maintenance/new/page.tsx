import { MaintenanceForm } from "@/components/maintenance/maintenance-form";

export default function NewMaintenancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Maintenance Record</h1>
        <p className="text-muted-foreground">
          Log a repair, test &amp; tag, or other maintenance work.
        </p>
      </div>
      <MaintenanceForm />
    </div>
  );
}
