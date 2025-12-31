import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MachineCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MachineCSVImportDialog({ open, onOpenChange, onSuccess }: MachineCSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const downloadTemplate = () => {
    const csvContent = "asset_tag,serial,model,location_id,status,cashless_enabled,telemetry_device_id\nVM-001,SN123456,Vendo V21,,active,true,TEL-001\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "machine_import_template.csv";
    a.click();
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter(line => line.trim());
    const headers = lines[0].split(",").map(h => h.trim());
    
    return lines.slice(1).map((line) => {
      const values = line.split(",").map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, i) => {
        const value = values[i];
        
        if (header === "cashless_enabled") {
          row[header] = value.toLowerCase() === "true";
        } else if (header === "location_id" || header === "telemetry_device_id") {
          row[header] = value || null;
        } else {
          row[header] = value;
        }
      });
      
      // Set default status if not provided
      if (!row.status) {
        row.status = "active";
      }
      
      return row;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setErrors([]);

    try {
      const text = await file.text();
      const machines = parseCSV(text);
      
      const validationErrors: string[] = [];
      machines.forEach((machine, index) => {
        if (!machine.asset_tag || !machine.serial || !machine.model) {
          validationErrors.push(`Row ${index + 2}: Missing required fields (asset_tag, serial, or model)`);
        }
        if (machine.status && !["active", "inactive", "maintenance"].includes(machine.status)) {
          validationErrors.push(`Row ${index + 2}: Invalid status (must be: active, inactive, or maintenance)`);
        }
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setImporting(false);
        return;
      }

      const { error } = await supabase
        .from("machines")
        .insert(machines);

      if (error) {
        if (error.code === "23505") {
          toast.error("Duplicate asset tag or serial found. Please ensure all values are unique.");
        } else {
          toast.error(`Import failed: ${error.message}`);
        }
      } else {
        toast.success(`Successfully imported ${machines.length} machines`);
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(`Failed to parse CSV: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Machines from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with machine data. Required columns: asset_tag, serial, model
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="machine-csv-upload"
            />
            <label htmlFor="machine-csv-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {file ? file.name : "Click to upload CSV file"}
              </p>
            </label>
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {errors.map((error, i) => (
                    <div key={i} className="text-sm">{error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex-1"
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
