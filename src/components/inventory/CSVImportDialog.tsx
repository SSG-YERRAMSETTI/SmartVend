import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CSVImportDialog({ open, onOpenChange, onSuccess }: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const downloadTemplate = () => {
    const csvContent = "name,sku,category,cost_price,sell_price,unit_size,barcode,reorder_point,tax_rate\nCoca-Cola,COKE-001,Beverages,0.75,1.50,12oz,,100,0.08\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_import_template.csv";
    a.click();
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split("\n").filter(line => line.trim());
    const headers = lines[0].split(",").map(h => h.trim());
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(",").map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, i) => {
        const value = values[i];
        
        if (header === "cost_price" || header === "sell_price" || header === "tax_rate") {
          row[header] = parseFloat(value) || 0;
        } else if (header === "reorder_point") {
          row[header] = parseInt(value) || 0;
        } else {
          row[header] = value || null;
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
      const products = parseCSV(text);
      
      const validationErrors: string[] = [];
      products.forEach((product, index) => {
        if (!product.name || !product.sku || !product.category) {
          validationErrors.push(`Row ${index + 2}: Missing required fields (name, sku, or category)`);
        }
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setImporting(false);
        return;
      }

      const { error } = await supabase
        .from("products")
        .insert(products);

      if (error) {
        if (error.code === "23505") {
          toast.error("Duplicate SKU found. Please ensure all SKUs are unique.");
        } else {
          toast.error(`Import failed: ${error.message}`);
        }
      } else {
        toast.success(`Successfully imported ${products.length} products`);
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
          <DialogTitle>Import Products from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with product data. Required columns: name, sku, category, cost_price, sell_price
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
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
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
