import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/api";

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

export function useProfitAnalytics() {
  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [machines, setMachines] = useState<ProfitByMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);

        const s = await fetch(`${API_BASE_URL}/api/analytics/profit/summary`);
        const m = await fetch(`${API_BASE_URL}/api/analytics/profit/by-machine`);

        if (!s.ok || !m.ok) {
          throw new Error("API error");
        }

        const summaryJson = await s.json();
        const machinesJson = await m.json();

        setSummary(summaryJson);
        setMachines(machinesJson);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  return { summary, machines, loading, error };
}
