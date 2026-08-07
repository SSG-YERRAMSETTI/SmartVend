import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: { value: number }[];
  color?: string;
}

export function Sparkline({ data, color = "hsl(var(--primary))" }: SparklineProps) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
