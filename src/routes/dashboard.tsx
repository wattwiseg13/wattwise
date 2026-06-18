import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLiveData } from "@/store/liveDataStore";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";
import { AlertTriangle, Zap, Lightbulb, ShoppingCart, ArrowRight, X } from "lucide-react";
import { UsagePieChart } from "@/components/charts/UsagePieChart";
import { CountUp } from "@/components/ui/count-up";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · WattWise" }] }),
  component: () => (
    <AppLayout title="My Energy Dashboard">
      <ConsumerDashboard />
    </AppLayout>
  ),
});

function ConsumerDashboard() {
  const todayKWh = useLiveData((s) => s.todayKWh);
  const [alertVisible, setAlertVisible] = useState(true);

  return (
    <div className="space-y-4">
      {alertVisible && <SmartMeterAlert onClose={() => setAlertVisible(false)} />}
      <QuickStatsRow todayKWh={todayKWh} />
      <UsageBreakdown todayKWh={todayKWh} />
      <LoadSheddingCard />
    </div>
  );
}

/* ─── Smart Meter Alert Banner ─────────────────────────────── */
function SmartMeterAlert({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-100 grid place-items-center flex-shrink-0 mt-0.5">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Smart Meter Alert</span>
          <span className="text-[10px] text-white bg-amber-500 px-2 py-0.5 rounded-full font-semibold">Arduino · Live</span>
        </div>
        <p className="text-sm font-semibold text-amber-900 leading-snug">
          Your <strong>geyser</strong> has used <strong>8.2 kWh</strong> today — estimated cost{" "}
          <strong>R23.41</strong>. This is 40% above your daily average.
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Switch it off now to save money. Restart after loadshedding ends.
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-amber-400 hover:text-amber-700 transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── 4-card quick stats row ──────────────────────────────── */
function QuickStatsRow({ todayKWh }: { todayKWh: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Units Used */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Zap className="w-3.5 h-3.5 text-[#005EB8]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Units Used</span>
        </div>
        <div className="font-mono text-2xl font-bold text-[#005EB8] tabular-nums">
          <CountUp value={todayKWh} decimals={1} />
        </div>
        <div className="text-[10px] text-slate-400 mt-1">kWh today</div>
      </div>

      {/* Est. Cost */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-xs font-bold text-amber-500 leading-none">R</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. Cost</span>
        </div>
        <div className="font-mono text-2xl font-bold text-amber-600 tabular-nums">
          {formatZAR(todayKWh * TARIFF_PER_KWH)}
        </div>
        <div className="text-[10px] text-slate-400 mt-1">Since midnight</div>
      </div>

      {/* Suggestions → reports */}
      <Link
        to="/reports"
        className="bg-[#EBF5FF] rounded-2xl border border-blue-100 shadow-sm p-4 hover:bg-blue-100 transition-colors group"
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <Lightbulb className="w-3.5 h-3.5 text-[#005EB8]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#005EB8]">Suggestions</span>
        </div>
        <div className="text-2xl font-bold text-[#005EB8]">3</div>
        <div className="text-[10px] text-[#005EB8] mt-1 flex items-center gap-0.5">
          Tips for you
          <ArrowRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* Buy electricity */}
      <button
        onClick={() => toast.info("Opening prepaid portal…")}
        className="bg-[#005EB8] rounded-2xl shadow-sm p-4 hover:bg-[#004FA3] active:bg-[#003F8A] transition-colors text-left w-full"
      >
        <div className="flex items-center gap-1.5 mb-2.5">
          <ShoppingCart className="w-3.5 h-3.5 text-white/80" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Buy</span>
        </div>
        <div className="text-2xl font-bold text-white">Units</div>
        <div className="text-[10px] text-blue-200 mt-1">Add electricity</div>
      </button>
    </div>
  );
}

/* ─── Live estimate (pie chart) ──────────────────────────── */
function UsageBreakdown({ todayKWh }: { todayKWh: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-slate-900">Where is your electricity going?</h2>
          <p className="text-xs text-slate-400 mt-0.5">Live estimate by appliance</p>
        </div>
        <span className="text-xs bg-[#EBF5FF] text-[#005EB8] font-semibold px-2.5 py-1 rounded-full">
          Live estimate
        </span>
      </div>
      <UsagePieChart totalKWh={todayKWh} />
    </div>
  );
}

/* ─── Load shedding ──────────────────────────────────────── */
function LoadSheddingCard() {
  const start = new Date(); start.setHours(18, 0, 0, 0);
  const end   = new Date(); end.setHours(20, 30, 0, 0);
  const now   = new Date();
  const isActive = now >= start && now <= end;
  const target   = isActive ? end : start;
  const diffSec  = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
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
          <div className="text-xl font-bold text-slate-900">Power off: 18:00 – 20:30</div>
          <div className="text-sm text-slate-500 mt-0.5">Group 7 — Tzaneen North</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">
            {isActive ? "Power back in" : "Power off in"}
          </div>
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
        Get ready: charge your devices and switch on the geyser before 17:45
      </div>
    </div>
  );
}
