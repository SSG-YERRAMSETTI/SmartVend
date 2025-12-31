import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency, exportToCSV } from "@/lib/csvExport";
import { useUpdateStatementStatus } from "@/hooks/useLocations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CommissionStatementsTableProps {
  statements: any[];
  showLocation?: boolean;
}

export function CommissionStatementsTable({ statements, showLocation = true }: CommissionStatementsTableProps) {
  const updateStatus = useUpdateStatementStatus();

  const getStatusColor = (status: string) => {
    const colors = {
      draft: "secondary",
      sent: "default",
      paid: "success",
    };
    return colors[status as keyof typeof colors] || "secondary";
  };

  const handleExportCSV = (statement: any) => {
    const exportData = [{
      "Statement ID": statement.id,
      Location: statement.locations?.name,
      "Period Start": format(new Date(statement.period_start), "MMM dd, yyyy"),
      "Period End": format(new Date(statement.period_end), "MMM dd, yyyy"),
      "Gross Sales": statement.gross_sales,
      "Commission Amount": statement.commission_amount,
      "Adjustments": statement.adjustments,
      "Net Commission": statement.commission_amount + statement.adjustments,
      "Status": statement.status,
    }];

    exportToCSV(exportData, `commission-statement-${statement.id.slice(0, 8)}`);
  };

  const handleMarkAsPaid = (statementId: string) => {
    updateStatus.mutate({ statementId, status: "paid" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission Statements</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              {showLocation && <TableHead>Location</TableHead>}
              <TableHead className="text-right">Gross Sales</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Adjustments</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statements.map((statement) => {
              const netAmount = statement.commission_amount + statement.adjustments;
              
              return (
                <TableRow key={statement.id}>
                  <TableCell className="font-medium">
                    {format(new Date(statement.period_start), "MMM dd")} - {format(new Date(statement.period_end), "MMM dd, yyyy")}
                  </TableCell>
                  {showLocation && (
                    <TableCell>{statement.locations?.name}</TableCell>
                  )}
                  <TableCell className="text-right">{formatCurrency(statement.gross_sales)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(statement.commission_amount)}</TableCell>
                  <TableCell className={`text-right ${statement.adjustments < 0 ? 'text-destructive' : statement.adjustments > 0 ? 'text-success' : ''}`}>
                    {formatCurrency(statement.adjustments)}
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(netAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(statement.status) as any}>
                      {statement.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExportCSV(statement)}>
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <FileText className="h-4 w-4 mr-2" />
                          Export PDF (Soon)
                        </DropdownMenuItem>
                        {statement.status !== "paid" && (
                          <DropdownMenuItem onClick={() => handleMarkAsPaid(statement.id)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark as Paid
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
