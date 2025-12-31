import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DateRange } from "react-day-picker";
import { useLocations } from "@/hooks/useLocations";
import { useMachines } from "@/hooks/useMachines";
import { useProducts } from "@/hooks/useInventory";
import { useRoutes } from "@/hooks/useRoutes";

interface ReportFiltersProps {
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  locationId?: string;
  onLocationChange?: (value: string) => void;
  machineId?: string;
  onMachineChange?: (value: string) => void;
  productId?: string;
  onProductChange?: (value: string) => void;
  routeId?: string;
  onRouteChange?: (value: string) => void;
  limit?: number;
  onLimitChange?: (value: string) => void;
  showLocationFilter?: boolean;
  showMachineFilter?: boolean;
  showProductFilter?: boolean;
  showRouteFilter?: boolean;
  showLimitFilter?: boolean;
}

export function ReportFilters({
  dateRange,
  onDateRangeChange,
  locationId,
  onLocationChange,
  machineId,
  onMachineChange,
  productId,
  onProductChange,
  routeId,
  onRouteChange,
  limit,
  onLimitChange,
  showLocationFilter = false,
  showMachineFilter = false,
  showProductFilter = false,
  showRouteFilter = false,
  showLimitFilter = false,
}: ReportFiltersProps) {
  const { data: locations } = useLocations();
  const { data: machines } = useMachines();
  const { data: products } = useProducts();
  const { data: routes } = useRoutes();

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border">
      <div className="flex flex-col gap-2">
        <Label>Date Range</Label>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={onDateRangeChange} />
      </div>

      {showLocationFilter && onLocationChange && (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <Label>Location</Label>
          <Select value={locationId || "all"} onValueChange={onLocationChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations?.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showMachineFilter && onMachineChange && (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <Label>Machine</Label>
          <Select value={machineId || "all"} onValueChange={onMachineChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Machines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Machines</SelectItem>
              {machines?.map((machine) => (
                <SelectItem key={machine.id} value={machine.id}>
                  {machine.asset_tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showProductFilter && onProductChange && (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <Label>Product</Label>
          <Select value={productId || "all"} onValueChange={onProductChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products?.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showRouteFilter && onRouteChange && (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <Label>Route</Label>
          <Select value={routeId || "all"} onValueChange={onRouteChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Routes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Routes</SelectItem>
              {routes?.map((route) => (
                <SelectItem key={route.id} value={route.id}>
                  {route.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showLimitFilter && onLimitChange && (
        <div className="flex flex-col gap-2 min-w-[150px]">
          <Label>Top N</Label>
          <Select value={limit?.toString() || "10"} onValueChange={onLimitChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
              <SelectItem value="50">Top 50</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
