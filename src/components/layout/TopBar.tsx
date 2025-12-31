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

export function TopBar() {
  const { user, roles, signOut } = useAuth();
  
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
            <DropdownMenuItem>Add Machine</DropdownMenuItem>
            <DropdownMenuItem>Create Route</DropdownMenuItem>
            <DropdownMenuItem>Add Product</DropdownMenuItem>
            <DropdownMenuItem>Record Sale</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start py-3">
              <div className="font-medium">Low Stock Alert</div>
              <div className="text-sm text-muted-foreground">Machine #42 needs restocking</div>
              <div className="text-xs text-muted-foreground mt-1">2 hours ago</div>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start py-3">
              <div className="font-medium">Route Completed</div>
              <div className="text-sm text-muted-foreground">Downtown route finished by John</div>
              <div className="text-xs text-muted-foreground mt-1">4 hours ago</div>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start py-3">
              <div className="font-medium">Payment Received</div>
              <div className="text-sm text-muted-foreground">$2,450 from Location Partner A</div>
              <div className="text-xs text-muted-foreground mt-1">Yesterday</div>
            </DropdownMenuItem>
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
              <div>{user?.email}</div>
              <div className="text-xs text-muted-foreground font-normal mt-1">
                {roles.map(r => r.replace('_', ' ')).join(', ')}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
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
