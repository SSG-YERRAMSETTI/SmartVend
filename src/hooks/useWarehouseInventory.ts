import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/api";

export interface WarehouseInventoryItem {
  product_id: string;
  name: string;
  sku?: string | null;
  quantity: number;
  avg_unit_cost: number;
}

export function useWarehouseInventory() {
  const [items, setItems] = useState<WarehouseInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE_URL}/api/inventory/warehouse`);
        if (!res.ok) {
          throw new Error(`Failed to load inventory: ${res.statusText}`);
        }
        const data = await res.json();
        setItems(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load inventory");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { items, loading, error };
}
