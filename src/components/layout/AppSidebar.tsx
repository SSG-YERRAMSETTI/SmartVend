import { NavLink, useLocation } from "react-router-dom";
import type { AppRole } from "@/lib/permissions";
import { getAccessibleNavItems } from "@/lib/permissions";

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
  FileText,
  LightbulbIcon,
  BarChart, 
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

const mainItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Machines", url: "/app/machines", icon: Box },
  { title: "Products & Inventory", url: "/app/inventory", icon: Package },
  { title: "Receipts", url: "/app/receipts", icon: FileText },
  { title: "Smart Advisor", url: "/app/advisor", icon: LightbulbIcon },
  { title: "Routes & Service", url: "/app/routes", icon: Route },
  { title: "Orders & Pre-kitting", url: "/app/orders", icon: ShoppingCart },
  { title: "Reports", url: "/app/reports", icon: BarChart },
  { title: "Telemetry", url: "/app/telemetry", icon: Activity },
  { title: "Sales & Payments", url: "/app/sales", icon: DollarSign },
  { title: "Reports", url: "/app/reports", icon: BarChart3 },
  { title: "Locations & Commissions", url: "/app/locations", icon: MapPin },
];

const userRoles: AppRole[] = ["admin"]; // TEMP: treat everyone as admin

const { main, settings } = getAccessibleNavItems(userRoles);

const settingsItems = [
  { title: "Admin", url: "/app/admin", icon: Settings },
  { title: "Help", url: "/app/help", icon: HelpCircle },
];

export function AppSidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/app") {
      return location.pathname === "/app";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <img
              src="/favicon.ico"
              alt="SmartVend logo"
              className="h-5 w-5"
            />
          </div>
          <img
            src="/favicon.ico"
            alt="SmartVend logo"
            className="h-6 w-6"
          />
          <span className="text-lg font-bold">
            SmartVend
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
