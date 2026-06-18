import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLiveData } from "@/store/liveDataStore";
import { useAlerts } from "@/store/alertsStore";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";
import { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle, Zap, X, Lightbulb } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UsagePieChart } from "@/components/charts/UsagePieChart";
import { CountUp } from "@/components/ui/count-up";
import { Sparkline } from "@/components/charts/WaveformChart";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · WattWise" }] }),
  component: () => (
    <AppLayout title="My Energy Dashboard">
      <ConsumerDashboard />
    </AppLayout>
  ),
});

function ConsumerDashboard() {
  const current = useLiveData((s) => s.current);
  const readings = useLiveData((s) => s.readings);
  const todayKWh = useLiveData((s) => s.todayKWh);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
      <div className="space-y-5 min-w-0">
        <MetricRow current={current} readings={readings} todayKWh={todayKWh} />
        <UsageBreakdown todayKWh={todayKWh} />
        <LoadSheddingCard />
      </div>
      <AlertsFeed />
    </div>
  );
}

/* ─── Metric cards ───────────────────────────────────────── */
function MetricRow({
  current,
  readings,
  todayKWh,
}: {
  current: { watts: number; voltage: number };
  readings: { watts: number }[];
  todayKWh: number;
}) {
  const metrics = [
    {
      label: "Live draw",
      value: <><CountUp value={current.watts} /><span className="text-sm font-normal text-slate-400 ml-1">W</span></>,
      sub: <div className="-mx-1 mt-2"><Sparkline data={readings.slice(-60).map((r) => r.watts)} /></div>,
      accent: "text-[#005EB8]",
    },
    {
      label: "Voltage",
      value: <><CountUp value={current.voltage} decimals={1} /><span className="text-sm font-normal text-slate-400 ml-1">V</span></>,
      sub: <div className="mt-2 text-xs text-slate-400">Nominal 230 V</div>,
      accent: "text-slate-800",
    },
    {
      label: "Today's usage",
      value: <><CountUp value={todayKWh} decimals={2} /><span className="text-sm font-normal text-slate-400 ml-1">kWh</span></>,
      sub: <div className="mt-2 text-xs text-slate-400">Since 00:00 SAST</div>,
      accent: "text-slate-800",
    },
    {
      label: "Est. cost today",
      value: <span>{formatZAR(todayKWh * TARIFF_PER_KWH)}</span>,
      sub: <div className="mt-2 text-xs text-slate-400">@ R{TARIFF_PER_KWH}/kWh</div>,
      accent: "text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map(({ label, value, sub, accent }) => (
        <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
          <div className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
          {sub}
        </div>
      ))}
    </div>
  );
}

/* ─── Usage breakdown (pie) ──────────────────────────────── */
function UsageBreakdown({ todayKWh }: { todayKWh: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-slate-900">Today's usage breakdown</h2>
          <p className="text-xs text-slate-400 mt-0.5">Estimated by appliance category</p>
        </div>
        <span className="text-xs bg-[#EBF5FF] text-[#005EB8] font-semibold px-2.5 py-1 rounded-full">Live estimate</span>
      </div>
      <UsagePieChart totalKWh={todayKWh} />
    </div>
  );
}

/* ─── Load shedding ──────────────────────────────────────── */
function LoadSheddingCard() {
  const start = new Date(); start.setHours(18, 0, 0, 0);
  const end = new Date(); end.setHours(20, 30, 0, 0);
  const now = new Date();
  const isActive = now >= start && now <= end;
  const target = isActive ? end : start;
  const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  const progress = isActive
    ? Math.min(100, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)
    : 0;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold">
              <Zap className="w-3 h-3" /> STAGE 2
            </span>
            <span className="text-[11px] text-slate-400">EskomSePush · 5 min ago</span>
          </div>
          <div className="text-xl font-bold text-slate-900">Today 18:00 – 20:30</div>
          <div className="text-sm text-slate-500 mt-0.5">Group 7 — Tzaneen North</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{isActive ? "Restores in" : "Starts in"}</div>
          <div className="font-mono text-3xl font-bold text-amber-600 tabular-nums mt-0.5">
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
          </div>
        </div>
      </div>

      <div className="mt-4 h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 font-medium bg-amber-50 rounded-xl px-3 py-2">
        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
        Charge devices and switch on geyser before 17:45
      </div>
    </div>
  );
}

/* ─── Alerts feed ────────────────────────────────────────── */
function AlertsFeed() {
  const alerts = useAlerts((s) => s.alerts);
  const dismiss = useAlerts((s) => s.dismiss);

  const config = {
    critical: { Icon: ShieldAlert, border: "border-l-red-500", icon: "text-red-500", bg: "bg-red-50/60" },
    warning:  { Icon: AlertTriangle, border: "border-l-amber-400", icon: "text-amber-500", bg: "bg-amber-50/60" },
    info:     { Icon: CheckCircle, border: "border-l-[#005EB8]", icon: "text-[#005EB8]", bg: "bg-[#EBF5FF]/60" },
  } as const;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 xl:sticky xl:top-20 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-900">Alerts</h2>
        <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{alerts.length}</span>
      </div>

      {alerts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-400 mb-2" />
          <p className="text-sm font-semibold text-slate-700">All clear</p>
          <p className="text-xs text-slate-400 mt-0.5">No active alerts right now</p>
        </div>
      )}

      <div className="space-y-2 max-h-[560px] overflow-y-auto -mr-1 pr-1">
        {alerts.slice(0, 12).map((a) => {
          const c = config[a.severity];
          return (
            <div
              key={a.id}
              className={`border-l-4 ${c.border} ${c.bg} rounded-r-xl p-3 flex gap-2.5 items-start`}
            >
              <c.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.icon}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-800 leading-snug">{a.description}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {a.meterId} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </div>
              </div>
              <button
                onClick={() => dismiss(a.id)}
                className="text-slate-300 hover:text-slate-600 transition-colors mt-0.5"
                aria-label="Dismiss alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
