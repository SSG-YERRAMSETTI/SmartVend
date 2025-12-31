// frontend/src/hooks/useRestockRecommendations.ts
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/api";

export interface RestockRecommendation {
  machine_id: string;
  product_id: string;
  product_name: string;
  current_stock: number;
  predicted_need: number;
  recommended_restock: number;
  reason: string;
}

export function useRestockRecommendations() {
  const [data, setData] = useState<RestockRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE_URL}/api/recommendations/restock`);
        if (!res.ok) {
          throw new Error(`Failed to load recommendations: ${res.status} ${res.statusText}`);
        }

        const json = await res.json();

        // If backend returns snake_case keys, we normalize here.
        const mapped: RestockRecommendation[] = json.map((item: any) => ({
          machine_id: item.machine_id,
          product_id: item.product_id,
          product_name: item.product_name,
          current_stock: item.current_stock,
          predicted_need: item.predicted_need,
          recommended_restock: item.recommended_restock,
          reason: item.reason,
        }));

        setData(mapped);
      } catch (err: any) {
        console.error("Error fetching restock recommendations:", err);
        setError(err.message || "Failed to load recommendations");
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, []);

  return { data, loading, error };
}
