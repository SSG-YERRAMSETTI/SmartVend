import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./hooks/useAuth";
import Dashboard from "./pages/app/Dashboard";
import Machines from "./pages/app/Machines";
import MachineDetail from "./pages/app/MachineDetail";
import Products from "./pages/app/Products";
import Locations from "./pages/app/Locations";
import LocationDetail from "./pages/app/LocationDetail";
import Trips from "./pages/app/Trips";
import TripDetail from "./pages/app/TripDetail";
import Team from "./pages/app/Team";
import DriverView from "./pages/app/DriverView";
import Purchases from "./pages/app/Purchases";
import PurchaseDetail from "./pages/app/PurchaseDetail";
import SmartAdvisorPage from "./pages/app/SmartAdvisor";
import Help from "./pages/app/Help";
import Profile from "./pages/app/Profile";
import Configuration from "./pages/app/Configuration";
import Tickets from "./pages/app/Tickets";
import RoutesPage from "./pages/app/RoutesPage";
import MileageLog from "./pages/app/MileageLog";
import Expenses from "./pages/app/Expenses";
import CalendarPage from "./pages/app/CalendarPage";
import Reports from "./pages/app/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />

              {/* Driver home */}
              <Route path="driver" element={<DriverView />} />

              {/* Trips - owner assigns, driver executes */}
              <Route path="trips" element={<Trips />} />
              <Route path="trips/:id" element={<TripDetail />} />

              {/* Catalog */}
              <Route path="products" element={<Products />} />
              <Route path="inventory" element={<Products />} />
              <Route path="machines" element={<Machines />} />
              <Route path="machines/:id" element={<MachineDetail />} />
              <Route path="locations" element={<Locations />} />
              <Route path="locations/:id" element={<LocationDetail />} />

              {/* Existing features (unchanged) */}
              <Route path="purchases" element={<Purchases />} />
              <Route path="purchases/:id" element={<PurchaseDetail />} />
              <Route path="advisor" element={<SmartAdvisorPage />} />

              {/* New operational pages */}
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="routes" element={<RoutesPage />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="mileage" element={<MileageLog />} />
              <Route path="expenses" element={<ProtectedRoute requiredRoles={["route_owner"]}><Expenses /></ProtectedRoute>} />
              <Route path="reports" element={<Reports />} />
              <Route path="profile" element={<Profile />} />
              <Route path="configuration" element={<ProtectedRoute requiredRoles={["route_owner"]}><Configuration /></ProtectedRoute>} />

              {/* Owner-only administration */}
              <Route
                path="admin/users"
                element={<ProtectedRoute requiredRoles={["route_owner"]}><Team /></ProtectedRoute>}
              />

              <Route path="help" element={<Help />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
