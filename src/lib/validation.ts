import { z } from "zod";

// Product validation schema
export const productSchema = z.object({
  name: z.string()
    .min(1, "Product name is required")
    .max(100, "Product name must be less than 100 characters")
    .trim(),
  sku: z.string()
    .min(1, "SKU is required")
    .max(50, "SKU must be less than 50 characters")
    .trim()
    .regex(/^[A-Z0-9-]+$/, "SKU must contain only uppercase letters, numbers, and hyphens"),
  category: z.string()
    .min(1, "Category is required")
    .max(50, "Category must be less than 50 characters")
    .trim(),
  cost_price: z.coerce.number()
    .positive("Cost price must be positive")
    .max(99999.99, "Cost price is too large"),
  sell_price: z.coerce.number()
    .positive("Sell price must be positive")
    .max(99999.99, "Sell price is too large"),
  unit_size: z.string()
    .max(50, "Unit size must be less than 50 characters")
    .optional(),
  barcode: z.string()
    .max(50, "Barcode must be less than 50 characters")
    .optional(),
  reorder_point: z.coerce.number()
    .int("Reorder point must be a whole number")
    .min(0, "Reorder point cannot be negative")
    .max(99999, "Reorder point is too large"),
  tax_rate: z.coerce.number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%"),
}).refine(data => data.sell_price >= data.cost_price, {
  message: "Sell price must be greater than or equal to cost price",
  path: ["sell_price"],
});

// Machine validation schema
export const machineSchema = z.object({
  asset_tag: z.string()
    .min(1, "Asset tag is required")
    .max(50, "Asset tag must be less than 50 characters")
    .trim(),
  serial: z.string()
    .min(1, "Serial number is required")
    .max(50, "Serial number must be less than 50 characters")
    .trim(),
  model: z.string()
    .min(1, "Model is required")
    .max(100, "Model must be less than 100 characters")
    .trim(),
  status: z.enum(["active", "inactive", "maintenance"]),
  cashless_enabled: z.boolean().default(false),
  location_id: z.string().uuid("Invalid location ID").optional().nullable(),
  telemetry_device_id: z.string()
    .max(50, "Telemetry device ID must be less than 50 characters")
    .optional()
    .nullable(),
});

// Location validation schema
export const locationSchema = z.object({
  name: z.string()
    .min(1, "Location name is required")
    .max(100, "Location name must be less than 100 characters")
    .trim(),
  address: z.string()
    .min(1, "Address is required")
    .max(200, "Address must be less than 200 characters")
    .trim(),
  contact_name: z.string()
    .max(100, "Contact name must be less than 100 characters")
    .optional()
    .nullable(),
  latitude: z.coerce.number()
    .min(-90, "Invalid latitude")
    .max(90, "Invalid latitude")
    .optional()
    .nullable(),
  longitude: z.coerce.number()
    .min(-180, "Invalid longitude")
    .max(180, "Invalid longitude")
    .optional()
    .nullable(),
  commission_type: z.enum(["percentage", "fixed"]),
  commission_value: z.coerce.number()
    .min(0, "Commission value cannot be negative"),
  payout_frequency: z.enum(["weekly", "biweekly", "monthly"]),
});

// Transfer validation schema
export const transferSchema = z.object({
  product_id: z.string().uuid("Invalid product ID"),
  from_location_id: z.string().uuid("Invalid from location ID"),
  from_location_type: z.enum(["warehouse", "vehicle", "machine"]),
  to_location_id: z.string().uuid("Invalid to location ID"),
  to_location_type: z.enum(["warehouse", "vehicle", "machine"]),
  quantity: z.coerce.number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be positive")
    .max(99999, "Quantity is too large"),
  notes: z.string()
    .max(500, "Notes must be less than 500 characters")
    .optional()
    .nullable(),
});

// Sale validation schema
export const saleSchema = z.object({
  machine_id: z.string().uuid("Invalid machine ID"),
  product_id: z.string().uuid("Invalid product ID"),
  qty: z.coerce.number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be positive")
    .max(999, "Quantity is too large"),
  unit_price: z.coerce.number()
    .positive("Unit price must be positive")
    .max(99999.99, "Unit price is too large"),
  payment_method: z.enum(["cash", "card", "mobile"]),
  occurred_at: z.string().datetime().optional(),
});

// Helper to format validation errors
export const formatValidationErrors = (error: z.ZodError) => {
  return error.errors.map(err => ({
    field: err.path.join("."),
    message: err.message,
  }));
};

// Helper to validate with detailed errors
export const validateWithErrors = <T>(schema: z.ZodSchema<T>, data: unknown) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      errors: formatValidationErrors(result.error),
    };
  }
  return {
    success: true,
    data: result.data,
  };
};
