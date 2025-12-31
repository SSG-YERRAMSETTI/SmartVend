import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DemoTour } from "@/components/tour/DemoTour";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import Dashboard from "./pages/app/Dashboard";
import Machines from "./pages/app/Machines";
import MachineDetail from "./pages/app/MachineDetail";
import DriverView from "./pages/app/DriverView";
import Inventory from "./pages/app/Inventory";
import RoutesPage from "./pages/app/Routes";
import Orders from "./pages/app/Orders";
import Telemetry from "./pages/app/Telemetry";
import Sales from "./pages/app/Sales";
import Reports from "./pages/app/Reports";
import Locations from "./pages/app/Locations";
import Admin from "./pages/app/Admin";
import RoleManagement from "./pages/app/RoleManagement";
import PermissionsMatrix from "./pages/app/PermissionsMatrix";
import Users from "./pages/app/admin/Users";
import Warehouses from "./pages/app/admin/Warehouses";
import Vehicles from "./pages/app/admin/Vehicles";
import PriceLists from "./pages/app/admin/PriceLists";
import Integrations from "./pages/app/admin/Integrations";
import ApiKeys from "./pages/app/admin/ApiKeys";
import Webhooks from "./pages/app/admin/Webhooks";
import ApiDocs from "./pages/app/admin/ApiDocs";
import Help from "./pages/app/Help";
import LocationPortal from "./pages/app/LocationPortal";
import NotFound from "./pages/NotFound";
import Receipts from "./pages/app/Receipts";  
import SmartAdvisorPage from "@/pages/app/SmartAdvisor";
import ReportsPage from "@/pages/app/Reports";




const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DemoTour />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="machines" element={<Machines />} />
              <Route path="machines/:id" element={<MachineDetail />} />
              <Route path="driver" element={<DriverView />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="/app/advisor" element={<SmartAdvisorPage />} />
              <Route path="receipts" element={<Receipts />} /> 
              <Route path="routes" element={<RoutesPage />} />
              <Route path="/app/reports" element={<ReportsPage />} />
              <Route path="orders" element={<Orders />} />
              <Route path="telemetry" element={<Telemetry />} />
              <Route path="sales" element={<Sales />} />
              <Route path="reports" element={<Reports />} />
              <Route path="locations" element={<Locations />} />
              <Route path="admin" element={<ProtectedRoute requiredRoles={["admin"]}><Admin /></ProtectedRoute>} />
              <Route path="admin/roles" element={<ProtectedRoute requiredRoles={["admin"]}><RoleManagement /></ProtectedRoute>} />
              <Route path="admin/permissions" element={<ProtectedRoute requiredRoles={["admin"]}><PermissionsMatrix /></ProtectedRoute>} />
              <Route path="admin/users" element={<ProtectedRoute requiredRoles={["admin"]}><Users /></ProtectedRoute>} />
              <Route path="admin/warehouses" element={<ProtectedRoute requiredRoles={["admin"]}><Warehouses /></ProtectedRoute>} />
              <Route path="admin/vehicles" element={<ProtectedRoute requiredRoles={["admin"]}><Vehicles /></ProtectedRoute>} />
              <Route path="admin/price-lists" element={<ProtectedRoute requiredRoles={["admin"]}><PriceLists /></ProtectedRoute>} />
              <Route path="admin/integrations" element={<ProtectedRoute requiredRoles={["admin"]}><Integrations /></ProtectedRoute>} />
              <Route path="admin/api-keys" element={<ProtectedRoute requiredRoles={["admin"]}><ApiKeys /></ProtectedRoute>} />
              <Route path="admin/webhooks" element={<ProtectedRoute requiredRoles={["admin"]}><Webhooks /></ProtectedRoute>} />
              <Route path="admin/api-docs" element={<ProtectedRoute requiredRoles={["admin"]}><ApiDocs /></ProtectedRoute>} />
              <Route path="help" element={<Help />} />
              <Route path="location-portal" element={<LocationPortal />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
