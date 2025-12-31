import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, History } from "lucide-react";
import { useMachines } from "@/hooks/useMachines";
import { MachineCard } from "@/components/machines/MachineCard";
import { MachineCSVImportDialog } from "@/components/machines/MachineCSVImportDialog";
import { AddMachineDialog } from "@/components/machines/AddMachineDialog";
import { AuditLogDrawer } from "@/components/audit/AuditLogDrawer";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { exportToCSV } from "@/lib/csvExport";
import { Package } from "lucide-react";

export default function Machines() {
  const { data: machines, isLoading, refetch } = useMachines();
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");

  const exportMachines = () => {
    if (machines) {
      const formatted = machines.map(m => ({
        asset_tag: m.asset_tag,
        serial: m.serial,
        model: m.model,
        status: m.status,
        location: m.location?.name || "",
        cashless_enabled: m.cashless_enabled,
        telemetry_device_id: m.telemetry_device_id || "",
      }));
      exportToCSV(formatted, "machines");
    }
  };

  const handleViewAudit = (machineId: string) => {
    setSelectedMachineId(machineId);
    setAuditLogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Machines</h1>
          <p className="text-muted-foreground">Manage all your vending machines</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={exportMachines}
            aria-label="Export machines to CSV"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setCsvDialogOpen(true)}
            aria-label="Import machines from CSV"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button aria-label="Add new machine" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Machine
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading machines..." />
      ) : machines && machines.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
          {machines.map((machine) => (
            <div key={machine.id} role="listitem">
              <MachineCard machine={machine} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="No machines found"
          description="Add your first machine to get started tracking your vending operations."
          action={{
            label: "Add Machine",
            onClick: () => setAddDialogOpen(true),
          }}
        />
      )}

      <MachineCSVImportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onSuccess={refetch}
      />

      <AddMachineDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refetch}
      />

      {selectedMachineId && (
        <AuditLogDrawer
          open={auditLogOpen}
          onOpenChange={setAuditLogOpen}
          tableName="machines"
          recordId={selectedMachineId}
        />
      )}
    </div>
  );
}
