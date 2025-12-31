import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlanogramCSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  machineId: string;
}

export function PlanogramCSVImportDialog({ open, onOpenChange, onSuccess, machineId }: PlanogramCSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const downloadTemplate = () => {
    const csvContent = "position,product_id,capacity,par_level,current_qty\nA1,<product-uuid>,30,25,20\nA2,<product-uuid>,30,25,18\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planogram_import_template.csv";
    a.click();
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter(line => line.trim());
    const headers = lines[0].split(",").map(h => h.trim());
    
    return lines.slice(1).map((line) => {
      const values = line.split(",").map(v => v.trim());
      const row: any = { machine_id: machineId };
      
      headers.forEach((header, i) => {
        const value = values[i];
        
        if (header === "capacity" || header === "par_level" || header === "current_qty") {
          row[header] = parseInt(value) || 0;
        } else if (header === "product_id") {
          row[header] = value || null;
        } else {
          row[header] = value;
        }
      });
      
      return row;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setErrors([]);

    try {
      const text = await file.text();
      const slots = parseCSV(text);
      
      const validationErrors: string[] = [];
      slots.forEach((slot, index) => {
        if (!slot.position || !slot.capacity) {
          validationErrors.push(`Row ${index + 2}: Missing required fields (position or capacity)`);
        }
        if (slot.capacity < 1) {
          validationErrors.push(`Row ${index + 2}: Capacity must be greater than 0`);
        }
        if (slot.current_qty > slot.capacity) {
          validationErrors.push(`Row ${index + 2}: Current quantity cannot exceed capacity`);
        }
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setImporting(false);
        return;
      }

      // Delete existing slots for this machine
      await supabase
        .from("slots")
        .delete()
        .eq("machine_id", machineId);

      // Insert new slots
      const { error } = await supabase
        .from("slots")
        .insert(slots);

      if (error) {
        if (error.code === "23505") {
          toast.error("Duplicate slot position found. Please ensure all positions are unique.");
        } else {
          toast.error(`Import failed: ${error.message}`);
        }
      } else {
        toast.success(`Successfully imported ${slots.length} slots`);
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
          <DialogTitle>Import Planogram from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with slot configuration. Required columns: position, capacity
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
              id="planogram-csv-upload"
            />
            <label htmlFor="planogram-csv-upload" className="cursor-pointer">
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
