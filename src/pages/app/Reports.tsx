// import { useState } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { DateRange } from "react-day-picker";
// import { ReportFilters } from "@/components/reports/ReportFilters";
// import { ReportTable } from "@/components/reports/ReportTable";
// import { useProfitAnalytics } from "@/hooks/useProfitAnalytics";

// import {
//   useSalesByProduct,
//   useSalesByMachine,
//   useSalesByLocation,
//   useMarginByProduct,
//   useCashVarianceReport,
//   useRoutePerformanceReport,
//   useAlertHistoryReport,
//   useTopProductsReport,
//   useUnderperformingMachinesReport,
// } from "@/hooks/useReports";
// import { useExpiringProducts, useLowStockProducts, useInventoryValuation } from "@/hooks/useInventory";
// import { useTaxSummary } from "@/hooks/useSales";
// import { useCommissionStatements } from "@/hooks/useLocations";
// import { formatCurrency } from "@/lib/csvExport";

// export default function Reports() {
//   const [dateRange, setDateRange] = useState<DateRange | undefined>();
//   const [locationId, setLocationId] = useState<string>();
//   const [machineId, setMachineId] = useState<string>();
//   const [productId, setProductId] = useState<string>();
//   const [routeId, setRouteId] = useState<string>();
//   const [limit, setLimit] = useState<number>(10);

//   const filters = {
//     dateRange,
//     locationId: locationId === "all" ? undefined : locationId,
//     machineId: machineId === "all" ? undefined : machineId,
//     productId: productId === "all" ? undefined : productId,
//     routeId: routeId === "all" ? undefined : routeId,
//     limit,
//   };

//   const salesByProduct = useSalesByProduct(filters);
//   const salesByMachine = useSalesByMachine(filters);
//   const salesByLocation = useSalesByLocation(filters);
//   const marginByProduct = useMarginByProduct(filters);
//   const cashVariance = useCashVarianceReport(filters);
//   const routePerformance = useRoutePerformanceReport(filters);
//   const alertHistory = useAlertHistoryReport(filters);
//   const topProducts = useTopProductsReport(filters);
//   const underperformingMachines = useUnderperformingMachinesReport(filters);

//   const expiringProducts = useExpiringProducts(30);
//   const lowStockProducts = useLowStockProducts();
//   const inventoryValuation = useInventoryValuation();

//   const taxSummary = useTaxSummary(filters);
//   const commissionStatements = useCommissionStatements();

//   const {
//     summary: profitSummary,
//     machines: profitByMachine,
//     loading: profitLoading,
//     error: profitError,
//   } = useProfitAnalytics();

//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-3xl font-bold mb-2">Reports</h1>
//         <p className="text-muted-foreground">
//           Comprehensive business analytics and insights
//         </p>
//       </div>

//       <Tabs defaultValue="sales-product" className="space-y-6">
//         <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-2 h-auto">
//           <TabsTrigger value="sales-product" className="text-xs">
//             Sales by Product
//           </TabsTrigger>
//           <TabsTrigger value="sales-machine" className="text-xs">
//             Sales by Machine
//           </TabsTrigger>
//           <TabsTrigger value="sales-location" className="text-xs">
//             Sales by Location
//           </TabsTrigger>
//           <TabsTrigger value="margin" className="text-xs">
//             Margin
//           </TabsTrigger>
//           <TabsTrigger value="inventory" className="text-xs">
//             Inventory
//           </TabsTrigger>
//           <TabsTrigger value="routes" className="text-xs">
//             Routes
//           </TabsTrigger>
//           <TabsTrigger value="cash" className="text-xs">
//             Cash Variance
//           </TabsTrigger>
//           <TabsTrigger value="profit" className="text-xs">
//             Profit Overview
//           </TabsTrigger>
//           <TabsTrigger value="top-products" className="text-xs">
//             Top Products
//           </TabsTrigger>
//           <TabsTrigger value="underperforming" className="text-xs">
//             Underperforming
//           </TabsTrigger>
//           <TabsTrigger value="alerts" className="text-xs">
//             Alert History
//           </TabsTrigger>
//           <TabsTrigger value="tax" className="text-xs">
//             Tax Summary
//           </TabsTrigger>
//           <TabsTrigger value="commissions" className="text-xs">
//             Commissions
//           </TabsTrigger>
//         </TabsList>

//         {/* Sales by Product */}
//         <TabsContent value="sales-product" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Sales by Product</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//                 productId={productId}
//                 onProductChange={setProductId}
//                 showProductFilter
//               />
//               <ReportTable
//                 data={salesByProduct.data || []}
//                 columns={[
//                   { key: "product_name", label: "Product" },
//                   { key: "sku", label: "SKU" },
//                   { key: "category", label: "Category" },
//                   { key: "total_units", label: "Units Sold", format: "number" },
//                   { key: "total_revenue", label: "Revenue", format: "currency" },
//                 ]}
//                 title="Sales by Product"
//                 isLoading={salesByProduct.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Sales by Machine */}
//         <TabsContent value="sales-machine" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Sales by Machine</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//                 machineId={machineId}
//                 onMachineChange={setMachineId}
//                 locationId={locationId}
//                 onLocationChange={setLocationId}
//                 showMachineFilter
//                 showLocationFilter
//               />
//               <ReportTable
//                 data={salesByMachine.data || []}
//                 columns={[
//                   { key: "asset_tag", label: "Machine" },
//                   { key: "model", label: "Model" },
//                   { key: "location_name", label: "Location" },
//                   { key: "transaction_count", label: "Transactions", format: "number" },
//                   { key: "total_units", label: "Units", format: "number" },
//                   { key: "total_revenue", label: "Revenue", format: "currency" },
//                 ]}
//                 title="Sales by Machine"
//                 isLoading={salesByMachine.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Sales by Location */}
//         <TabsContent value="sales-location" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Sales by Location</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//                 locationId={locationId}
//                 onLocationChange={setLocationId}
//                 showLocationFilter
//               />
//               <ReportTable
//                 data={salesByLocation.data || []}
//                 columns={[
//                   { key: "location_name", label: "Location" },
//                   { key: "address", label: "Address" },
//                   { key: "total_units", label: "Units Sold", format: "number" },
//                   { key: "total_revenue", label: "Revenue", format: "currency" },
//                 ]}
//                 title="Sales by Location"
//                 isLoading={salesByLocation.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Margin by Product */}
//         <TabsContent value="margin" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Margin by Product</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//                 productId={productId}
//                 onProductChange={setProductId}
//                 showProductFilter
//               />
//               <ReportTable
//                 data={marginByProduct.data || []}
//                 columns={[
//                   { key: "product_name", label: "Product" },
//                   { key: "sku", label: "SKU" },
//                   { key: "total_units", label: "Units", format: "number" },
//                   { key: "total_revenue", label: "Revenue", format: "currency" },
//                   { key: "total_cost", label: "Cost", format: "currency" },
//                   { key: "gross_profit", label: "Profit", format: "currency" },
//                   { key: "margin_percent", label: "Margin %", format: "percent" },
//                 ]}
//                 title="Margin by Product"
//                 isLoading={marginByProduct.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Inventory */}
//         <TabsContent value="inventory" className="space-y-4">
//           <div className="grid md:grid-cols-3 gap-4">
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-base">Total Valuation</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <p className="text-2xl font-bold">
//                   {inventoryValuation.data
//                     ? formatCurrency(inventoryValuation.data.totalValue)
//                     : "-"}
//                 </p>
//               </CardContent>
//             </Card>
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-base">Expiring Soon</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <p className="text-2xl font-bold">
//                   {expiringProducts.data?.length || 0}
//                 </p>
//                 <p className="text-sm text-muted-foreground">
//                   products in next 30 days
//                 </p>
//               </CardContent>
//             </Card>
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-base">Low Stock</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <p className="text-2xl font-bold">
//                   {lowStockProducts.data?.length || 0}
//                 </p>
//                 <p className="text-sm text-muted-foreground">
//                   products below reorder point
//                 </p>
//               </CardContent>
//             </Card>
//           </div>

//           <Card>
//             <CardHeader>
//               <CardTitle>Expiring Products</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <ReportTable
//                 data={expiringProducts.data || []}
//                 columns={[
//                   { key: "product_name", label: "Product" },
//                   { key: "batch_number", label: "Batch" },
//                   { key: "quantity", label: "Quantity", format: "number" },
//                   { key: "expiry_date", label: "Expiry Date" },
//                   { key: "days_until_expiry", label: "Days Until Expiry", format: "number" },
//                 ]}
//                 title="Expiring Products"
//                 isLoading={expiringProducts.isLoading}
//               />
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <CardTitle>Low Stock Products</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <ReportTable
//                 data={lowStockProducts.data || []}
//                 columns={[
//                   { key: "name", label: "Product" },
//                   { key: "sku", label: "SKU" },
//                   { key: "warehouse_stock", label: "Current Stock", format: "number" },
//                   { key: "reorder_point", label: "Reorder Point", format: "number" },
//                 ]}
//                 title="Low Stock Products"
//                 isLoading={lowStockProducts.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Routes */}
//         <TabsContent value="routes" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Route Performance</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//                 routeId={routeId}
//                 onRouteChange={setRouteId}
//                 showRouteFilter
//               />
//               <ReportTable
//                 data={routePerformance.data || []}
//                 columns={[
//                   { key: "route_name", label: "Route" },
//                   { key: "location_name", label: "Location" },
//                   { key: "asset_tag", label: "Machine" },
//                   { key: "planned_date", label: "Planned Date" },
//                   { key: "status", label: "Status" },
//                   { key: "service_time_minutes", label: "Service Time (min)", format: "number" },
//                 ]}
//                 title="Route Performance"
//                 isLoading={routePerformance.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Cash variance */}
//         <TabsContent value="cash" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Cash Variance Report</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//               />
//               <ReportTable
//                 data={cashVariance.data || []}
//                 columns={[
//                   { key: "collected_at", label: "Date" },
//                   { key: "location_name", label: "Location" },
//                   { key: "asset_tag", label: "Machine" },
//                   { key: "expected_cash", label: "Expected", format: "currency" },
//                   { key: "counted_cash", label: "Counted", format: "currency" },
//                   { key: "variance", label: "Variance", format: "currency" },
//                 ]}
//                 title="Cash Variance"
//                 isLoading={cashVariance.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Top products */}
//         <TabsContent value="top-products" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Top Products</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//                 limit={limit}
//                 onLimitChange={(val) => setLimit(parseInt(val))}
//                 showLimitFilter
//               />
//               <ReportTable
//                 data={topProducts.data || []}
//                 columns={[
//                   { key: "product_name", label: "Product" },
//                   { key: "sku", label: "SKU" },
//                   { key: "category", label: "Category" },
//                   { key: "total_units", label: "Units Sold", format: "number" },
//                   { key: "total_revenue", label: "Revenue", format: "currency" },
//                 ]}
//                 title="Top Products"
//                 isLoading={topProducts.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Underperforming machines */}
//         <TabsContent value="underperforming" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Underperforming Machines</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//                 limit={limit}
//                 onLimitChange={(val) => setLimit(parseInt(val))}
//                 showLimitFilter
//               />
//               <ReportTable
//                 data={underperformingMachines.data || []}
//                 columns={[
//                   { key: "asset_tag", label: "Machine" },
//                   { key: "model", label: "Model" },
//                   { key: "location_name", label: "Location" },
//                   { key: "transaction_count", label: "Transactions", format: "number" },
//                   { key: "total_revenue", label: "Revenue", format: "currency" },
//                 ]}
//                 title="Underperforming Machines"
//                 isLoading={underperformingMachines.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Alert history */}
//         <TabsContent value="alerts" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Alert History</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//               />
//               <ReportTable
//                 data={alertHistory.data || []}
//                 columns={[
//                   { key: "created_at", label: "Date" },
//                   { key: "severity", label: "Severity" },
//                   { key: "message", label: "Message" },
//                   { key: "status", label: "Status" },
//                 ]}
//                 title="Alert History"
//                 isLoading={alertHistory.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Tax summary */}
//         <TabsContent value="tax" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Tax Summary</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ReportFilters
//                 dateRange={dateRange}
//                 onDateRangeChange={setDateRange}
//               />
//               {taxSummary.data && (
//                 <div className="grid md:grid-cols-4 gap-4">
//                   <Card>
//                     <CardContent className="pt-6">
//                       <p className="text-sm text-muted-foreground">Total Sales</p>
//                       <p className="text-2xl font-bold">
//                         {formatCurrency(taxSummary.data.total_sales)}
//                       </p>
//                     </CardContent>
//                   </Card>
//                   <Card>
//                     <CardContent className="pt-6">
//                       <p className="text-sm text-muted-foreground">Total Tax</p>
//                       <p className="text-2xl font-bold">
//                         {formatCurrency(taxSummary.data.total_tax)}
//                       </p>
//                     </CardContent>
//                   </Card>
//                   <Card>
//                     <CardContent className="pt-6">
//                       <p className="text-sm text-muted-foreground">Total with Tax</p>
//                       <p className="text-2xl font-bold">
//                         {formatCurrency(taxSummary.data.total_with_tax)}
//                       </p>
//                     </CardContent>
//                   </Card>
//                   <Card>
//                     <CardContent className="pt-6">
//                       <p className="text-sm text-muted-foreground">Transactions</p>
//                       <p className="text-2xl font-bold">
//                         {taxSummary.data.transaction_count}
//                       </p>
//                     </CardContent>
//                   </Card>
//                 </div>
//               )}
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Commissions */}
//         <TabsContent value="commissions" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Commission Statements</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <ReportTable
//                 data={commissionStatements.data || []}
//                 columns={[
//                   { key: "period_start", label: "Period Start" },
//                   { key: "period_end", label: "Period End" },
//                   { key: "gross_sales", label: "Gross Sales", format: "currency" },
//                   { key: "commission_amount", label: "Commission", format: "currency" },
//                   { key: "status", label: "Status" },
//                 ]}
//                 title="Commission Statements"
//                 isLoading={commissionStatements.isLoading}
//               />
//             </CardContent>
//           </Card>
//         </TabsContent>

//         {/* Profit Overview */}
//         <TabsContent value="profit" className="space-y-4">
//           <Card>
//             <CardHeader>
//               <CardTitle>Profit Overview</CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               {profitLoading && (
//                 <p className="text-sm text-muted-foreground">
//                   Loading profit analytics...
//                 </p>
//               )}

//               {profitError && !profitLoading && (
//                 <p className="text-sm text-destructive">{profitError}</p>
//               )}

//               {!profitLoading && !profitError && !profitSummary && (
//                 <p className="text-sm text-muted-foreground">
//                   No profit data available yet. Make sure daily_sales_summary has rows.
//                 </p>
//               )}

//               {!profitLoading && !profitError && profitSummary && (
//                 <>
//                   {/* Summary cards */}
//                   <div className="grid md:grid-cols-3 gap-4">
//                     <Card>
//                       <CardContent className="pt-6">
//                         <p className="text-sm text-muted-foreground">Total Revenue</p>
//                         <p className="text-2xl font-bold">
//                           {formatCurrency(profitSummary.total_revenue)}
//                         </p>
//                       </CardContent>
//                     </Card>

//                     <Card>
//                       <CardContent className="pt-6">
//                         <p className="text-sm text-muted-foreground">Total Cost</p>
//                         <p className="text-2xl font-bold">
//                           {formatCurrency(profitSummary.total_cost)}
//                         </p>
//                       </CardContent>
//                     </Card>

//                     <Card>
//                       <CardContent className="pt-6">
//                         <p className="text-sm text-muted-foreground">Total Profit</p>
//                         <p className="text-2xl font-bold text-green-600">
//                           {formatCurrency(profitSummary.total_profit)}
//                         </p>
//                       </CardContent>
//                     </Card>
//                   </div>

//                   {/* Machine-level table */}
//                   <Card>
//                     <CardHeader>
//                       <CardTitle className="text-base">Profit by Machine</CardTitle>
//                     </CardHeader>
//                     <CardContent>
//                       <div className="overflow-x-auto">
//                         <table className="min-w-full text-sm">
//                           <thead>
//                             <tr className="text-left border-b">
//                               <th className="py-2 pr-4">Machine</th>
//                               <th className="py-2 pr-4">Location</th>
//                               <th className="py-2 pr-4 text-right">Revenue</th>
//                               <th className="py-2 pr-4 text-right">Cost</th>
//                               <th className="py-2 pr-4 text-right">Profit</th>
//                             </tr>
//                           </thead>
//                           <tbody>
//                             {profitByMachine.map((m) => (
//                               <tr key={m.machine_id} className="border-b">
//                                 <td className="py-2 pr-4">{m.machine_name}</td>
//                                 <td className="py-2 pr-4">{m.location_name}</td>
//                                 <td className="py-2 pr-4 text-right">
//                                   {formatCurrency(m.revenue)}
//                                 </td>
//                                 <td className="py-2 pr-4 text-right">
//                                   {formatCurrency(m.cost)}
//                                 </td>
//                                 <td
//                                   className={`py-2 pr-4 text-right font-medium ${
//                                     m.profit >= 0 ? "text-green-600" : "text-red-500"
//                                   }`}
//                                 >
//                                   {formatCurrency(m.profit)}
//                                 </td>
//                               </tr>
//                             ))}
//                             {profitByMachine.length === 0 && (
//                               <tr>
//                                 <td
//                                   className="py-4 text-center text-muted-foreground"
//                                   colSpan={5}
//                                 >
//                                   No machine-level profit data yet.
//                                 </td>
//                               </tr>
//                             )}
//                           </tbody>
//                         </table>
//                       </div>
//                     </CardContent>
//                   </Card>
//                 </>
//               )}
//             </CardContent>
//           </Card>
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// }







































































































































import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportTable } from "@/components/reports/ReportTable";

import {
  useCashVarianceReport,
  useRoutePerformanceReport,
  useAlertHistoryReport,
} from "@/hooks/useReports";
import {
  useExpiringProducts,
  useLowStockProducts,
  useInventoryValuation,
} from "@/hooks/useInventory";
import { formatCurrency } from "@/lib/csvExport";

import { useProfitAnalytics } from "@/hooks/useProfitAnalytics";

import { Bar } from "react-chartjs-2";
import "chart.js/auto";

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [routeId, setRouteId] = useState<string>();

  // Filters (minimal: only what routes/alerts need)
  const filters = {
    dateRange,
    routeId: routeId === "all" ? undefined : routeId,
  };

  // Inventory-related hooks
  const expiringProducts = useExpiringProducts(30);
  const lowStockProducts = useLowStockProducts();
  const inventoryValuation = useInventoryValuation();

  // Routes & alerts
  const routePerformance = useRoutePerformanceReport(filters);
  const cashVariance = useCashVarianceReport(filters); // still used in case you want it later
  const alertHistory = useAlertHistoryReport(filters);

  // Profit analytics
  const {
    summary: profitSummary,
    machines: profitByMachine,
    loading: profitLoading,
    error: profitError,
  } = useProfitAnalytics();

  // Chart data for profit by machine
  const profitChartData = {
    labels: profitByMachine.map((m) => m.machine_name),
    datasets: [
      {
        label: "Profit",
        data: profitByMachine.map((m) => m.profit),
        backgroundColor: "rgba(34, 197, 94, 0.6)", // green-ish
        borderColor: "rgba(22, 163, 74, 1)",
        borderWidth: 1,
      },
    ],
  };

  const profitChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true as const,
          maxRotation: 45,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Reports</h1>
        <p className="text-muted-foreground">
          Inventory, routes, profit overview, and alert history
        </p>
      </div>

      <Tabs defaultValue="profit" className="space-y-6">
        <TabsList className="grid grid-cols-4 gap-2 h-auto">
          <TabsTrigger value="inventory" className="text-xs">
            Inventory
          </TabsTrigger>
          <TabsTrigger value="routes" className="text-xs">
            Routes
          </TabsTrigger>
          <TabsTrigger value="profit" className="text-xs">
            Profit Overview
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">
            Alert History
          </TabsTrigger>
        </TabsList>

        {/* ================= INVENTORY TAB ================= */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Valuation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {inventoryValuation.data
                    ? formatCurrency(inventoryValuation.data.totalValue)
                    : "-"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expiring Soon</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {expiringProducts.data?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  products in next 30 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Low Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {lowStockProducts.data?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  products below reorder point
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Expiring Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportTable
                data={expiringProducts.data || []}
                columns={[
                  { key: "product_name", label: "Product" },
                  { key: "batch_number", label: "Batch" },
                  { key: "quantity", label: "Quantity", format: "number" },
                  { key: "expiry_date", label: "Expiry Date" },
                  {
                    key: "days_until_expiry",
                    label: "Days Until Expiry",
                    format: "number",
                  },
                ]}
                title="Expiring Products"
                isLoading={expiringProducts.isLoading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low Stock Products</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportTable
                data={lowStockProducts.data || []}
                columns={[
                  { key: "name", label: "Product" },
                  { key: "sku", label: "SKU" },
                  {
                    key: "warehouse_stock",
                    label: "Current Stock",
                    format: "number",
                  },
                  {
                    key: "reorder_point",
                    label: "Reorder Point",
                    format: "number",
                  },
                ]}
                title="Low Stock Products"
                isLoading={lowStockProducts.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ROUTES TAB ================= */}
        <TabsContent value="routes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Route Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReportFilters
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                routeId={routeId}
                onRouteChange={setRouteId}
                showRouteFilter
              />
              <ReportTable
                data={routePerformance.data || []}
                columns={[
                  { key: "route_name", label: "Route" },
                  { key: "location_name", label: "Location" },
                  { key: "asset_tag", label: "Machine" },
                  { key: "planned_date", label: "Planned Date" },
                  { key: "status", label: "Status" },
                  {
                    key: "service_time_minutes",
                    label: "Service Time (min)",
                    format: "number",
                  },
                ]}
                title="Route Performance"
                isLoading={routePerformance.isLoading}
              />
            </CardContent>
          </Card>

          {/* Optional: keep cash variance below, or remove completely */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Variance (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReportFilters
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
              <ReportTable
                data={cashVariance.data || []}
                columns={[
                  { key: "collected_at", label: "Date" },
                  { key: "location_name", label: "Location" },
                  { key: "asset_tag", label: "Machine" },
                  {
                    key: "expected_cash",
                    label: "Expected",
                    format: "currency",
                  },
                  {
                    key: "counted_cash",
                    label: "Counted",
                    format: "currency",
                  },
                  {
                    key: "variance",
                    label: "Variance",
                    format: "currency",
                  },
                ]}
                title="Cash Variance"
                isLoading={cashVariance.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= PROFIT OVERVIEW TAB ================= */}
        <TabsContent value="profit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profit Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profitLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading profit analytics...
                </p>
              )}

              {profitError && !profitLoading && (
                <p className="text-sm text-destructive">{profitError}</p>
              )}

              {!profitLoading && !profitError && !profitSummary && (
                <p className="text-sm text-muted-foreground">
                  No profit data available yet. Make sure daily_sales_summary has
                  rows.
                </p>
              )}

              {!profitLoading && !profitError && profitSummary && (
                <>
                  {/* Summary cards */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                          Total Revenue
                        </p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(profitSummary.total_revenue)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                          Total Cost
                        </p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(profitSummary.total_cost)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                          Total Profit
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(profitSummary.total_profit)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Profit bar chart by machine */}
                  {profitByMachine.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Profit by Machine (Chart)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="w-full overflow-x-auto">
                          <Bar
                            data={profitChartData}
                            options={profitChartOptions}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Machine-level table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Profit by Machine (Table)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left border-b">
                              <th className="py-2 pr-4">Machine</th>
                              <th className="py-2 pr-4">Location</th>
                              <th className="py-2 pr-4 text-right">Revenue</th>
                              <th className="py-2 pr-4 text-right">Cost</th>
                              <th className="py-2 pr-4 text-right">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profitByMachine.map((m) => (
                              <tr key={m.machine_id} className="border-b">
                                <td className="py-2 pr-4">{m.machine_name}</td>
                                <td className="py-2 pr-4">
                                  {m.location_name}
                                </td>
                                <td className="py-2 pr-4 text-right">
                                  {formatCurrency(m.revenue)}
                                </td>
                                <td className="py-2 pr-4 text-right">
                                  {formatCurrency(m.cost)}
                                </td>
                                <td
                                  className={`py-2 pr-4 text-right font-medium ${
                                    m.profit >= 0
                                      ? "text-green-600"
                                      : "text-red-500"
                                  }`}
                                >
                                  {formatCurrency(m.profit)}
                                </td>
                              </tr>
                            ))}
                            {profitByMachine.length === 0 && (
                              <tr>
                                <td
                                  className="py-4 text-center text-muted-foreground"
                                  colSpan={5}
                                >
                                  No machine-level profit data yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= ALERT HISTORY TAB ================= */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReportFilters
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
              <ReportTable
                data={alertHistory.data || []}
                columns={[
                  { key: "created_at", label: "Date" },
                  { key: "severity", label: "Severity" },
                  { key: "message", label: "Message" },
                  { key: "status", label: "Status" },
                ]}
                title="Alert History"
                isLoading={alertHistory.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
