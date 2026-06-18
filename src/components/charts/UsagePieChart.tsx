import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";

const SLICES = [
  { name: "Geyser", pct: 0.35, color: "#005EB8" },
  { name: "Kitchen", pct: 0.22, color: "#1E6FBA" },
  { name: "Lighting", pct: 0.18, color: "#4A90D9" },
  { name: "Appliances", pct: 0.15, color: "#7BB3E8" },
  { name: "Other", pct: 0.10, color: "#C5DFF8" },
];

interface Props {
  totalKWh: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md px-4 py-3 text-sm">
      <div className="font-semibold text-slate-800">{name}</div>
      <div className="text-slate-500 mt-0.5">{value} kWh &nbsp;·&nbsp; {formatZAR(value * TARIFF_PER_KWH)}</div>
    </div>
  );
}

export function UsagePieChart({ totalKWh }: Props) {
  const data = SLICES.map((s) => ({
    name: s.name,
    value: parseFloat((totalKWh * s.pct).toFixed(2)),
    color: s.color,
    pct: Math.round(s.pct * 100),
  }));

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="w-full md:w-64 h-56 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2.5 w-full">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-slate-700 flex-1">{d.name}</span>
            <span className="text-sm font-semibold text-slate-800 tabular-nums">{d.value} kWh</span>
            <span className="text-xs text-slate-400 tabular-nums w-9 text-right">{d.pct}%</span>
          </div>
        ))}
        <div className="mt-1 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Total today</span>
          <span className="text-sm font-bold text-[#005EB8] tabular-nums">{totalKWh.toFixed(2)} kWh</span>
        </div>
      </div>
    </div>
  );
}
