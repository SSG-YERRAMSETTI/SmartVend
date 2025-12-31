import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Route,
  ShoppingCart,
  Activity,
  DollarSign,
  BarChart3,
  MapPin,
  Settings,
  HelpCircle,
  Box,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { getAccessibleNavItems } from "@/lib/permissions";

const iconMap: Record<string, any> = {
  LayoutDashboard,
  Box,
  Package,
  Route,
  ShoppingCart,
  Activity,
  DollarSign,
  BarChart3,
  MapPin,
  Settings,
  HelpCircle,
};

export function RoleBasedSidebar() {
  const location = useLocation();
  const { roles } = useAuth();
  const { main, settings } = getAccessibleNavItems(roles);

  const isActive = (path: string) => {
    if (path === "/app") {
      return location.pathname === "/app";
    }
    return location.pathname.startsWith(path);
  };

  const getIcon = (title: string) => {
    if (title === "Dashboard") return LayoutDashboard;
    if (title === "Location Portal") return MapPin;
    if (title === "Machines") return Box;
    if (title.includes("Inventory")) return Package;
    if (title.includes("Routes")) return Route;
    if (title.includes("Orders")) return ShoppingCart;
    if (title === "Telemetry") return Activity;
    if (title.includes("Sales")) return DollarSign;
    if (title === "Reports") return BarChart3;
    if (title.includes("Locations")) return MapPin;
    if (title === "Admin") return Settings;
    if (title === "Help") return HelpCircle;
    return Box;
  };

  return (
    <Sidebar >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 flex items-center justify-center">
            <img src="/favicon.ico" alt="Logo" className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">
            SmartVend
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {main.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {main.map((item) => {
                  const Icon = getIcon(item.title);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <Icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {settings.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settings.map((item) => {
                  const Icon = getIcon(item.title);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <NavLink to={item.url}>
                          <Icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
