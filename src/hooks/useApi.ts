import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";

// ============================================================
// Types
// ============================================================

export interface Product {
  id: string;
  org_id: string;
  sku: string;
  name: string;
  category: string;
  unit_size?: string | null;
  units_per_case?: number | null;
  cost_price: number;
  sell_price: number;
  barcode?: string | null;
  tax_rate?: number | null;
  active: boolean;
  reorder_point?: number | null;
  order_up_to_level?: number | null;
  warehouse_stock?: number | null;
  last_supplier?: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  org_id: string;
  code?: string | null;
  active: boolean;
  name: string;
  address: string;
  address_line2?: string | null;
  city?: string | null;
  state_province?: string | null;
  zip?: string | null;
  country?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  working_hours?: string | null;
  working_days?: string[] | null;
  notes?: string | null;
  next_visit?: string | null;
  commission_type: string;
  commission_value: number;
  payout_frequency: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
}

export interface Machine {
  id: string;
  org_id: string;
  name?: string | null;
  external_code?: string | null;
  description?: string | null;
  machine_type?: string | null;
  asset_tag: string;
  model: string;
  serial: string;
  key_code?: string | null;
  placed_on?: string | null;
  notes?: string | null;
  track_vend_meter: boolean;
  track_cash_meter: boolean;
  track_credit_card_sales: boolean;
  column_map_template?: string | null;
  location_id?: string | null;
  column_count?: number | null;
  cashless_enabled: boolean;
  telemetry_device_id?: string | null;
  status: string;
  created_at: string;
}

export interface MachinePhoto {
  id: string;
  machine_id: string;
  file_path: string;
  taken_at: string;
}

export interface MachineAttachment {
  id: string;
  machine_id: string;
  file_path: string;
  filename: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  org_id: string;
  machine_id?: string | null;
  priority: string;
  subject: string;
  description: string;
  status: string;
  assigned_user_id?: string | null;
  created_at: string;
}

export interface Slot {
  id: string;
  machine_id: string;
  position: string;
  product_id?: string | null;
  price_override?: number | null;
  dex_price?: number | null;
  last_count?: number | null;
  par_level: number;
  capacity: number;
  current_qty: number;
}

export interface Coil {
  slot_id: string;
  position: string;
  product_id?: string | null;
  product_name?: string | null;
  price?: number | null;
  capacity: number;
  par_level: number;
  current_qty_before_trip: number;
  current_count?: number | null;
  last_filled_qty?: number | null;
  filled_qty?: number | null;
}

export interface MachineVisit {
  route_stop_id: string;
  machine_id: string;
  machine_name?: string | null;
  asset_tag: string;
  sequence: number;
  status: string;
  coils: Coil[];
}

export interface LocationGroup {
  location_id?: string | null;
  location_name: string;
  machines: MachineVisit[];
}

export interface Trip {
  id: string;
  org_id: string;
  route_id?: string | null;
  driver_id: string;
  trip_date: string;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface TripDetail {
  trip: Trip;
  locations: LocationGroup[];
}

export interface AppUser {
  id: string;
  org_id?: string | null;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

// ============================================================
// Products
// ============================================================

export const useProducts = () =>
  useQuery({ queryKey: ["products"], queryFn: () => api.get<Product[]>("/products") });

export const useProduct = (id?: string) =>
  useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: !!id,
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Product>("/products", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<Product>(`/products/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Locations
// ============================================================

export const useLocations = () =>
  useQuery({ queryKey: ["locations"], queryFn: () => api.get<Location[]>("/locations") });

export const useLocation = (id?: string) =>
  useQuery({
    queryKey: ["location", id],
    queryFn: () => api.get<Location>(`/locations/${id}`),
    enabled: !!id,
  });

export const useCreateLocation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Location>("/locations", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateLocation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<Location>(`/locations/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteLocation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/locations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Machines
// ============================================================

export const useMachines = () =>
  useQuery({ queryKey: ["machines"], queryFn: () => api.get<Machine[]>("/machines") });

export const useMachine = (id?: string) =>
  useQuery({
    queryKey: ["machine", id],
    queryFn: () => api.get<Machine>(`/machines/${id}`),
    enabled: !!id,
  });

export const useCreateMachine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Machine>("/machines", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Machine created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateMachine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<Machine>(`/machines/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Machine updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteMachine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/machines/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Machine deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Slots (coils)
// ============================================================

export const useMachineSlots = (machineId?: string) =>
  useQuery({
    queryKey: ["slots", machineId],
    queryFn: () => api.get<Slot[]>(`/machines/${machineId}/slots`),
    enabled: !!machineId,
  });

export const useCreateSlot = (machineId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<Slot>(`/machines/${machineId}/slots`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["slots", machineId] });
      toast.success("Coil added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<Slot>(`/slots/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast.success("Coil updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Trips
// ============================================================

export const useTrips = () =>
  useQuery({ queryKey: ["trips"], queryFn: () => api.get<Trip[]>("/trips") });

export const useTripDetail = (id?: string) =>
  useQuery({
    queryKey: ["trip", id],
    queryFn: () => api.get<TripDetail>(`/trips/${id}`),
    enabled: !!id,
  });

export const useCreateTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { driver_id: string; trip_date: string; machine_ids: string[]; route_name?: string }) =>
      api.post<Trip>("/trips", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip assigned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useSubmitRestock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeStopId,
      entries,
      markCompleted = true,
    }: {
      routeStopId: string;
      entries: Array<{
        slot_id: string;
        current_count?: number | null;
        filled_qty: number;
        product_id?: string | null;
        price_override?: number | null;
      }>;
      markCompleted?: boolean;
    }) =>
      api.post<MachineVisit>(`/route-stops/${routeStopId}/restock`, {
        entries,
        mark_completed: markCompleted,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Restock saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useCompleteTrip = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => api.patch<Trip>(`/trips/${tripId}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast.success("Trip completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Users (team management)
// ============================================================

export const useOrgUsers = (opts?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["org-users"],
    queryFn: () => api.get<AppUser[]>("/auth/users"),
    enabled: opts?.enabled ?? true,
  });

export const useCreateDriver = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; full_name: string }) =>
      api.post<AppUser>("/auth/users", { ...body, role: "driver" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-users"] });
      toast.success("Driver account created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeactivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.patch<AppUser>(`/auth/users/${userId}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-users"] });
      toast.success("User deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Machine photos & attachments
// ============================================================

export const useMachinePhotos = (machineId?: string) =>
  useQuery({
    queryKey: ["machine-photos", machineId],
    queryFn: () => api.get<MachinePhoto[]>(`/machines/${machineId}/photos`),
    enabled: !!machineId,
  });

export const useUploadMachinePhoto = (machineId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.upload<MachinePhoto>(`/machines/${machineId}/photos`, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-photos", machineId] });
      toast.success("Photo uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useMachineAttachments = (machineId?: string) =>
  useQuery({
    queryKey: ["machine-attachments", machineId],
    queryFn: () => api.get<MachineAttachment[]>(`/machines/${machineId}/attachments`),
    enabled: !!machineId,
  });

export const useUploadMachineAttachment = (machineId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.upload<MachineAttachment>(`/machines/${machineId}/attachments`, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-attachments", machineId] });
      toast.success("Attachment uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Tickets (Maintenance / Service History)
// ============================================================

export const useTickets = (machineId?: string) =>
  useQuery({
    queryKey: ["tickets", machineId],
    queryFn: () => api.get<Ticket[]>(machineId ? `/tickets?machine_id=${machineId}` : "/tickets"),
  });

export const useCreateTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { machine_id?: string; priority: string; subject: string; description: string }) =>
      api.post<Ticket>("/tickets", body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["tickets", vars.machine_id] });
      qc.invalidateQueries({ queryKey: ["tickets", undefined] });
      toast.success("Ticket created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.patch<Ticket>(`/tickets/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Routes (read-only list)
// ============================================================

export interface Route {
  id: string;
  org_id: string;
  name: string;
  frequency: string;
  assigned_driver_id?: string | null;
  created_at: string;
}

export const useRoutesList = () =>
  useQuery({ queryKey: ["routes"], queryFn: () => api.get<Route[]>("/routes") });

// ============================================================
// Mileage Log
// ============================================================

export interface MileageLog {
  id: string;
  org_id: string;
  driver_id?: string | null;
  trip_id?: string | null;
  log_date: string;
  start_odometer?: number | null;
  end_odometer?: number | null;
  miles: number;
  notes?: string | null;
  created_at: string;
}

export const useMileageLogs = () =>
  useQuery({ queryKey: ["mileage-logs"], queryFn: () => api.get<MileageLog[]>("/mileage-logs") });

export const useCreateMileageLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      driver_id?: string; trip_id?: string; log_date: string;
      start_odometer?: number; end_odometer?: number; miles: number; notes?: string;
    }) => api.post<MileageLog>("/mileage-logs", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage-logs"] });
      toast.success("Mileage logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteMileageLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/mileage-logs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mileage-logs"] });
      toast.success("Log deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Expenses
// ============================================================

export interface Expense {
  id: string;
  org_id: string;
  expense_date: string;
  category: string;
  vendor_name?: string | null;
  amount: number;
  notes?: string | null;
  photo_path?: string | null;
  receipt_id?: string | null;
  trip_id?: string | null;
  created_at: string;
}

export const useExpenses = (dateFrom?: string, dateTo?: string) =>
  useQuery({
    queryKey: ["expenses", dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const qs = params.toString();
      return api.get<Expense[]>(`/expenses${qs ? `?${qs}` : ""}`);
    },
  });

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { expense_date: string; category: string; vendor_name?: string; amount: number; notes?: string; trip_id?: string }) =>
      api.post<Expense>("/expenses", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUploadExpensePhoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, file }: { expenseId: string; file: File }) =>
      api.upload<Expense>(`/expenses/${expenseId}/photo`, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Photo attached");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Profit by date range
// ============================================================

export interface ProfitByRange {
  date_from: string;
  date_to: string;
  revenue: number;
  total_expenses: number;
  profit: number;
  expense_breakdown: { category: string; amount: number }[];
}

export const useProfitByRange = (dateFrom: string, dateTo: string) =>
  useQuery({
    queryKey: ["profit-by-range", dateFrom, dateTo],
    queryFn: () => api.get<ProfitByRange>(`/reports/profit-by-range?date_from=${dateFrom}&date_to=${dateTo}`),
    enabled: !!dateFrom && !!dateTo,
  });

// ============================================================
// Organization settings
// ============================================================

export interface Organization {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export const useMyOrganization = () =>
  useQuery({ queryKey: ["my-org"], queryFn: () => api.get<Organization>("/organizations/me") });

export const useUpdateMyOrganization = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string }) => api.patch<Organization>("/organizations/me", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-org"] });
      toast.success("Organization updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Purchases (receipts)
// ============================================================

export interface ReceiptLine {
  id: string;
  line_type: string;
  product_raw: string;
  product_id?: string | null;
  is_new_product: boolean;
  match_confidence: string;
  quantity: number;
  units_per_case?: number | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  expiry_date?: string | null;
  shelf_label?: string | null;
  needs_review: boolean;
  review_note?: string | null;
}

export interface Purchase {
  id: string;
  org_id?: string | null;
  document_type: "inventory_purchase" | "expense";
  expense_category?: string | null;
  vendor_name?: string | null;
  receipt_date?: string | null;
  receipt_time?: string | null;
  filename: string;
  file_path?: string | null;
  status: string;
  total_amount?: number | null;
  missing_prices: boolean;
  extraction_provider?: string | null;
  raw_text?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  lines: ReceiptLine[];
}

export const usePurchases = (status?: string) =>
  useQuery({
    queryKey: ["purchases", status],
    queryFn: () => api.get<Purchase[]>(status ? `/purchases?status=${status}` : "/purchases"),
  });

export const usePurchase = (id?: string) =>
  useQuery({
    queryKey: ["purchase", id],
    queryFn: () => api.get<Purchase>(`/purchases/${id}`),
    enabled: !!id,
  });

export const useUploadPurchase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.upload<Purchase>("/purchases/upload", file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Receipt read — review the details below");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdatePurchaseLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ receiptId, lineId, ...body }: { receiptId: string; lineId: string } & Record<string, unknown>) =>
      api.patch<ReceiptLine>(`/purchases/${receiptId}/lines/${lineId}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["purchase", vars.receiptId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdatePurchaseSummary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ receiptId, ...body }: { receiptId: string } & Record<string, unknown>) =>
      api.patch<Purchase>(`/purchases/${receiptId}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["purchase", vars.receiptId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export interface VoiceFillAction {
  line_id: string;
  product_raw: string;
  expiration_date?: string | null;
  units_per_case?: number | null;
  skip: boolean;
}

export interface VoiceFillResult {
  transcript: string;
  actions: VoiceFillAction[];
}

export const useVoiceFill = () => {
  return useMutation({
    mutationFn: ({ receiptId, audioBlob }: { receiptId: string; audioBlob: Blob }) => {
      const file = new File([audioBlob], "recording.webm", { type: audioBlob.type || "audio/webm" });
      return api.upload<VoiceFillResult>(`/purchases/${receiptId}/voice-fill`, file, "audio");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, ...body }: { batchId: string } & Record<string, unknown>) =>
      api.patch(`/batches/${batchId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-batches"] });
      qc.invalidateQueries({ queryKey: ["expiring-soon"] });
      toast.success("Batch updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeletePurchaseLine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ receiptId, lineId }: { receiptId: string; lineId: string }) =>
      api.delete(`/purchases/${receiptId}/lines/${lineId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["purchase", vars.receiptId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useConfirmPurchase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Purchase>(`/purchases/${id}/confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Purchase confirmed — inventory updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useRejectPurchase = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/purchases/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Purchase rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Expiration tracking
// ============================================================

export interface InventoryBatch {
  id: string;
  product_id: string;
  location_type: string;
  quantity: number;
  unit_cost: number;
  expiry_date?: string | null;
  shelf_label?: string | null;
  received_at: string;
}

export interface ExpiringBatch {
  batch_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  expiry_date: string;
  purchased_date?: string | null;
  shelf_label?: string | null;
  days_until_expiry: number;
}

export const useProductBatches = (productId?: string) =>
  useQuery({
    queryKey: ["product-batches", productId],
    queryFn: () => api.get<InventoryBatch[]>(`/products/${productId}/batches`),
    enabled: !!productId,
  });

export const useExpiringSoon = (days = 14) =>
  useQuery({
    queryKey: ["expiring-soon", days],
    queryFn: () => api.get<ExpiringBatch[]>(`/inventory/expiring-soon?days=${days}`),
  });

// ============================================================
// Analytics (profit summary/by-machine)
// ============================================================

export interface ProfitSummary {
  total_revenue: number;
  total_cost: number;
  total_profit: number;
}

export interface ProfitByMachine {
  machine_id: string;
  machine_name: string;
  location_name: string;
  revenue: number;
  cost: number;
  profit: number;
}

export const useProfitSummary = () =>
  useQuery({
    queryKey: ["profit-summary"],
    queryFn: () => api.get<ProfitSummary>("/api/analytics/profit/summary"),
    retry: false,
  });

export const useProfitByMachine = () =>
  useQuery({
    queryKey: ["profit-by-machine"],
    queryFn: () => api.get<ProfitByMachine[]>("/api/analytics/profit/by-machine"),
    retry: false,
  });

export interface MarginPricePoint {
  price: number;
  margin_dollar: number;
  margin_pct: number | null;
  locations: string[];
}

export interface ProductMargin {
  product_id: string;
  product_name: string;
  cost_price: number;
  last_supplier?: string | null;
  price_points: MarginPricePoint[];
}

export const useMarginByProduct = () =>
  useQuery({
    queryKey: ["margin-by-product"],
    queryFn: () => api.get<ProductMargin[]>("/reports/margin-by-product"),
  });

// ============================================================
// Dashboard layout (customization)
// ============================================================

export interface DashboardLayout {
  widgets: string[];
  available_widgets: string[];
}

export const useDashboardLayout = () =>
  useQuery({ queryKey: ["dashboard-layout"], queryFn: () => api.get<DashboardLayout>("/dashboard/layout") });

export const useUpdateDashboardLayout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgets: string[]) => api.patch<{ widgets: string[] }>("/dashboard/layout", { widgets }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-layout"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============================================================
// Assistant chat
// ============================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PendingAction {
  name: string;
  label: string;
  args: Record<string, unknown>;
}

export interface ChatResponse {
  reply: string;
  navigate?: string | null;
  pending_action?: PendingAction | null;
}

export const useAssistantChat = () =>
  useMutation({
    mutationFn: (messages: ChatMessage[]) => api.post<ChatResponse>("/assistant/chat", { messages }),
    onError: (e: Error) => toast.error(e.message),
  });

export const useExecuteAssistantAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: { name: string; args: Record<string, unknown> }) =>
      api.post<ChatResponse>("/assistant/execute-action", action),
    onSuccess: () => {
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
