import { useNavigate } from "react-router-dom";
import { Search, Plus, Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useTrips } from "@/hooks/useApi";

export function TopBar() {
  const { user, roles, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const canManage = hasRole("route_owner");

  const { data: products } = useProducts();
  const { data: trips } = useTrips();
  const lowStock = products?.filter((p) => p.active && (p.warehouse_stock ?? 0) <= (p.reorder_point ?? 0)) ?? [];
  const recentlyCompleted = trips?.filter((t) => t.status === "completed").slice(0, 3) ?? [];
  const notificationCount = lowStock.length + recentlyCompleted.length;

  return (
    <header className="h-16 border-b bg-background flex items-center px-6 gap-4">
      <SidebarTrigger />

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search machines, products, routes..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Quick Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/app/machines")}>Add Machine</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/app/locations")}>Add Location</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/app/products")}>Add Product</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/app/trips")}>Assign Trip</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {notificationCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {lowStock.slice(0, 3).map((p) => (
              <DropdownMenuItem key={p.id} className="flex flex-col items-start py-3" onClick={() => navigate("/app/products")}>
                <div className="font-medium">Low Stock</div>
                <div className="text-sm text-muted-foreground">{p.name} — {p.warehouse_stock ?? 0} left</div>
              </DropdownMenuItem>
            ))}
            {recentlyCompleted.map((t) => (
              <DropdownMenuItem key={t.id} className="flex flex-col items-start py-3" onClick={() => navigate(`/app/trips/${t.id}`)}>
                <div className="font-medium">Trip Completed</div>
                <div className="text-sm text-muted-foreground">{t.trip_date}</div>
              </DropdownMenuItem>
            ))}
            {notificationCount === 0 && (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">Nothing new right now.</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div>{user?.full_name || user?.email}</div>
              <div className="text-xs text-muted-foreground font-normal mt-1">
                {roles.map(r => r.replace('_', ' ')).join(', ')}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/profile")}>Profile</DropdownMenuItem>
            {canManage && (
              <DropdownMenuItem onClick={() => navigate("/app/configuration")}>Settings</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
