import { useState } from "react";
import { API_BASE_URL } from "@/config/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, ScanLine } from "lucide-react";
import { toast } from "sonner";

const Receipts = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0] || null;
    setFile(f);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error("Please choose a receipt file first.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/receipts/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }

      const data = await res.json();
      toast.success(`Receipt uploaded: ${data.filename}`);
      setFile(null);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to upload receipt. Check backend is running.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Upload Purchase Receipts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a recent purchase receipt as a PDF, image (JPG/PNG), or
            email export. In later steps, the system will scan it with OCR and
            update your inventory automatically.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="receipt-file">Receipt file</Label>
              <Input
                id="receipt-file"
                type="file"
                accept="image/*,application/pdf,.eml,.txt,.html"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Supported: PDF, images (JPG/PNG), email receipts (.eml/.txt/.html)
              </p>
            </div>

            {/* Optional: scan from camera using mobile */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Or take a photo on mobile:
              </Label>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
              />
            </div>

            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? (
                "Uploading..."
              ) : (
                <span className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" />
                  Upload Receipt
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Receipts;
