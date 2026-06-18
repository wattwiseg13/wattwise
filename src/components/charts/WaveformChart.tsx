import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLiveData } from "@/store/liveDataStore";
import { format } from "date-fns";

export function WaveformChart({ height = 240, points }: { height?: number; points?: { timestamp: number; watts: number }[] }) {
  const readings = useLiveData((s) => s.readings);
  const data = (points ?? readings).slice(-300).map((r) => ({
    t: r.timestamp,
    label: format(r.timestamp, "HH:mm:ss"),
    watts: Math.round(r.watts),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="wave" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00C9A7" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#00C9A7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} interval={Math.floor(data.length / 6)} />
        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} width={40} />
        <Tooltip
          contentStyle={{ background: "#0B1628", border: "1px solid #1A3458", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#94A3B8" }}
          formatter={(v: number) => [`${v} W`, "Power"]}
        />
        <Area type="monotone" dataKey="watts" stroke="#00C9A7" strokeWidth={2} fill="url(#wave)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00C9A7" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#00C9A7" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke="#00C9A7" strokeWidth={1.5} fill="url(#spark)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
