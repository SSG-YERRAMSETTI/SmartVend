import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Receipt as ReceiptIcon, AlertTriangle } from "lucide-react";
import { usePurchases, useUploadPurchase } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";

const statusVariant = (s: string) =>
  s === "confirmed" ? "default" : s === "rejected" ? "destructive" : "secondary";

export default function Purchases() {
  const { hasRole } = useAuth();
  const canManage = hasRole("route_owner") || hasRole("driver");
  const { data: purchases, isLoading } = usePurchases();
  const uploadPurchase = useUploadPurchase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      await uploadPurchase.mutateAsync(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Purchases</h1>
          <p className="text-muted-foreground">
            Upload any receipt — image, PDF, OXPS, or DOC. Product receipts update inventory;
            fuel, repairs, and other non-product receipts go straight to Expenses.
          </p>
        </div>
        {canManage && (
          <>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Reading receipt..." : "Upload Receipt"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.oxps,.xps,.doc,.docx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading purchases...</p>
      ) : purchases && purchases.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.receipt_date || "—"}</TableCell>
                    <TableCell>{p.vendor_name || "—"}</TableCell>
                    <TableCell>
                      {p.document_type === "expense" ? (
                        <Badge variant="secondary">{p.expense_category || "Expense"}</Badge>
                      ) : (
                        <Badge variant="outline">Inventory</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">{p.filename}</TableCell>
                    <TableCell className="text-right">
                      {p.total_amount != null ? `$${Number(p.total_amount).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusVariant(p.status)}>{p.status.replace("_", " ")}</Badge>
                        {p.missing_prices && p.status === "pending_review" && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/app/purchases/${p.id}`}>
                          {p.status === "pending_review" ? "Review" : "View"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <ReceiptIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No purchases uploaded yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
