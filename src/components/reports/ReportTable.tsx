import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV, formatCurrency, formatNumber } from "@/lib/csvExport";

interface ReportColumn {
  key: string;
  label: string;
  format?: "currency" | "number" | "percent" | "text";
}

interface ReportTableProps {
  data: any[];
  columns: ReportColumn[];
  title: string;
  isLoading?: boolean;
}

export function ReportTable({ data, columns, title, isLoading }: ReportTableProps) {
  const formatValue = (value: any, format?: string) => {
    if (value === null || value === undefined) return "-";
    
    switch (format) {
      case "currency":
        return formatCurrency(Number(value));
      case "number":
        return formatNumber(Number(value));
      case "percent":
        return `${Number(value).toFixed(1)}%`;
      default:
        return String(value);
    }
  };

  const handleExport = () => {
    const exportData = data.map((row) => {
      const formatted: any = {};
      columns.forEach((col) => {
        formatted[col.label] = formatValue(row[col.key], col.format);
      });
      return formatted;
    });
    exportToCSV(exportData, title.toLowerCase().replace(/\s+/g, "-"));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No data available for the selected filters
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{data.length} records</h3>
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {formatValue(row[col.key], col.format)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
