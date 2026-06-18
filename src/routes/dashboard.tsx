import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLiveData } from "@/store/liveDataStore";
import { useAlerts } from "@/store/alertsStore";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";
import {
  AlertTriangle, ShieldAlert, CheckCircle, Zap, X,
  Lightbulb, ShoppingCart, ArrowRight, Thermometer, Tv,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { UsagePieChart } from "@/components/charts/UsagePieChart";
import { CountUp } from "@/components/ui/count-up";
import { toast } from "sonner";

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
      <div className="space-y-5 min-w-0">
        <MetricRow todayKWh={todayKWh} />
        <BuyElectricity />
        <UsageBreakdown todayKWh={todayKWh} />
        <QuickSuggestions />
        <LoadSheddingCard />
      </div>
      <AlertsFeed />
    </div>
  );
}

/* ─── Metric cards (2 simplified) ─────────────────────────── */
function MetricRow({ todayKWh }: { todayKWh: number }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#EBF5FF] grid place-items-center flex-shrink-0">
            <Zap className="w-5 h-5 text-[#005EB8]" />
          </div>
          <span className="text-sm font-semibold text-slate-500 leading-tight">Units Used Today</span>
        </div>
        <div className="font-mono text-3xl font-bold text-[#005EB8] tabular-nums">
          <CountUp value={todayKWh} decimals={1} />
          <span className="text-base font-normal text-slate-400 ml-1">kWh</span>
        </div>
        <div className="text-xs text-slate-400 mt-1">Since midnight</div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 grid place-items-center flex-shrink-0">
            <span className="font-extrabold text-amber-600 text-base">R</span>
          </div>
          <span className="text-sm font-semibold text-slate-500 leading-tight">Cost Today</span>
        </div>
        <div className="font-mono text-3xl font-bold text-amber-600 tabular-nums">
          {formatZAR(todayKWh * TARIFF_PER_KWH)}
        </div>
        <div className="text-xs text-slate-400 mt-1">Estimated spend</div>
      </div>
    </div>
  );
}

/* ─── Buy Electricity ─────────────────────────────────────── */
function BuyElectricity() {
  return (
    <div className="bg-[#005EB8] rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 grid place-items-center flex-shrink-0">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Buy Electricity</h2>
            <p className="text-blue-100 text-sm mt-0.5">Add units to your meter — works 24/7</p>
          </div>
        </div>
        <button
          onClick={() => toast.info("Opening prepaid portal…")}
          className="bg-white text-[#005EB8] font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-blue-50 transition-colors shadow flex items-center gap-1.5 flex-shrink-0"
        >
          Buy now <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[50, 100, 200].map((amt) => (
          <button
            key={amt}
            onClick={() => toast.success(`R${amt} electricity purchase started`)}
            className="bg-white/10 hover:bg-white/20 active:bg-white/25 transition-colors rounded-xl py-4 text-center border border-white/20"
          >
            <div className="font-bold text-2xl">R{amt}</div>
            <div className="text-[11px] text-blue-200 mt-0.5">Quick buy</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Usage breakdown (pie) ──────────────────────────────── */
function UsageBreakdown({ todayKWh }: { todayKWh: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-slate-900">Where is your electricity going?</h2>
          <p className="text-xs text-slate-400 mt-0.5">Estimated by appliance</p>
        </div>
        <span className="text-xs bg-[#EBF5FF] text-[#005EB8] font-semibold px-2.5 py-1 rounded-full">Live estimate</span>
      </div>
      <UsagePieChart totalKWh={todayKWh} />
    </div>
  );
}

/* ─── Quick Suggestions ───────────────────────────────────── */
const TIPS = [
  {
    Icon: Thermometer,
    title: "Switch off your geyser 1 hour before loadshedding starts",
    saving: "Save up to R8 per day",
    bg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    Icon: Zap,
    title: "Set your geyser to 55°C — still hot, but uses less electricity",
    saving: "Save up to R150 per month",
    bg: "bg-[#EBF5FF]",
    iconColor: "text-[#005EB8]",
  },
  {
    Icon: Tv,
    title: "Unplug TVs and chargers when you are not using them",
    saving: "Save up to R30 per month",
    bg: "bg-slate-50",
    iconColor: "text-slate-600",
  },
];

function QuickSuggestions() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div>
          <h2 className="font-bold text-slate-900">Tips to save money</h2>
          <p className="text-xs text-slate-400 mt-0.5">Small changes make a big difference</p>
        </div>
      </div>

      <div className="space-y-3">
        {TIPS.map(({ Icon, title, saving, bg, iconColor }) => (
          <div key={title} className={`flex items-start gap-3 p-3.5 ${bg} rounded-xl`}>
            <div className="w-8 h-8 rounded-lg bg-white grid place-items-center flex-shrink-0 shadow-sm">
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800 leading-snug">{title}</p>
              <span className="inline-block mt-1.5 text-[11px] font-bold text-[#005EB8]">{saving}</span>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/reports"
        className="mt-4 w-full flex items-center justify-center gap-2 bg-[#005EB8] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#003F8A] transition-colors"
      >
        View my full usage report <ArrowRight className="w-4 h-4" />
      </Link>
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
          <div className="text-xl font-bold text-slate-900">Power off: 18:00 – 20:30</div>
          <div className="text-sm text-slate-500 mt-0.5">Group 7 — Tzaneen North</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400 uppercase tracking-wide">{isActive ? "Power back in" : "Power off in"}</div>
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
        Get ready: charge devices and switch on geyser before 17:45
      </div>
    </div>
  );
}

/* ─── Alerts feed ────────────────────────────────────────── */
function AlertsFeed() {
  const alerts = useAlerts((s) => s.alerts);
  const dismiss = useAlerts((s) => s.dismiss);

  const config = {
    critical: { Icon: ShieldAlert, border: "border-l-red-500",    icon: "text-red-500",    bg: "bg-red-50/60" },
    warning:  { Icon: AlertTriangle, border: "border-l-amber-400", icon: "text-amber-500",  bg: "bg-amber-50/60" },
    info:     { Icon: CheckCircle,   border: "border-l-[#005EB8]", icon: "text-[#005EB8]",  bg: "bg-[#EBF5FF]/60" },
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
