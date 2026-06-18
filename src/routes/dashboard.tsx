import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { CountUp } from "@/components/ui/count-up";
import { WaveformChart, Sparkline } from "@/components/charts/WaveformChart";
import { DailyBarChart } from "@/components/charts/BarCharts";
import { useLiveData } from "@/store/liveDataStore";
import { useAlerts } from "@/store/alertsStore";
import { hourlyUsageToday } from "@/mock/meters";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";
import { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle, Zap, Phone, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · NexMotion" }] }),
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
  const hourly = useMemo(() => hourlyUsageToday(), []);
  const currentHour = new Date().getHours();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6 min-w-0">
        {/* Metric row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Current power</div>
            <div className="mt-1 font-mono text-2xl font-bold text-teal-600">
              <CountUp value={current.watts} /> <span className="text-sm text-muted-foreground">W</span>
            </div>
            <div className="mt-2 -mx-1"><Sparkline data={readings.slice(-60).map((r) => r.watts)} /></div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Voltage</div>
            <div className="mt-1 font-mono text-2xl font-bold">
              <CountUp value={current.voltage} decimals={1} /> <span className="text-sm text-muted-foreground">V</span>
            </div>
            <div className="mt-6 text-[11px] text-muted-foreground">Nominal 230 V</div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Today's usage</div>
            <div className="mt-1 font-mono text-2xl font-bold">
              <CountUp value={todayKWh} decimals={2} /> <span className="text-sm text-muted-foreground">kWh</span>
            </div>
            <div className="mt-6 text-[11px] text-muted-foreground">Since 00:00 SAST</div>
          </Card>
          <Card>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated cost today</div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-600">
              {formatZAR(todayKWh * TARIFF_PER_KWH)}
            </div>
            <div className="mt-6 text-[11px] text-muted-foreground">@ R {TARIFF_PER_KWH}/kWh</div>
          </Card>
        </div>

        {/* Waveform */}
        <Card>
          <CardTitle hint={<span className="font-mono text-teal-600">{Math.round(current.watts)} W · live</span>}>
            Live power draw (W)
          </CardTitle>
          <WaveformChart height={240} />
        </Card>

        {/* Daily bars */}
        <Card>
          <CardTitle hint="Hourly · today">Daily usage breakdown</CardTitle>
          <DailyBarChart data={hourly} currentHour={currentHour} />
        </Card>

        {/* Load shedding */}
        <LoadSheddingCard />

        {/* USSD panel */}
        <USSDQuickPanel />
      </div>

      {/* Alerts sidebar */}
      <div>
        <AlertsFeed />
      </div>
    </div>
  );
}

function LoadSheddingCard() {
  const start = new Date(); start.setHours(18, 0, 0, 0);
  const end = new Date(); end.setHours(20, 30, 0, 0);
  const now = new Date();
  const isActive = now >= start && now <= end;
  const target = isActive ? end : start;
  const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diffSec / 3600), m = Math.floor((diffSec % 3600) / 60), s = diffSec % 60;
  const progress = isActive ? Math.min(100, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100) : 0;

  return (
    <Card className="bg-gradient-to-br from-amber-200/30 to-card border-amber/30">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber text-white text-[11px] font-bold">
              <Zap className="w-3 h-3" /> STAGE 2
            </span>
            <span className="text-[11px] text-muted-foreground">EskomSePush · updated 5 min ago</span>
          </div>
          <div className="mt-2 text-2xl font-bold">Today 18:00 – 20:30</div>
          <div className="text-sm text-muted-foreground">Group 7 — Tzaneen North</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase text-muted-foreground">{isActive ? "Restores in" : "Starts in"}</div>
          <div className="font-mono text-3xl font-bold text-amber-600 tabular-nums">
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
          </div>
        </div>
      </div>
      <div className="mt-4 h-2 bg-amber/20 rounded-full overflow-hidden">
        <div className="h-full bg-amber transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 text-xs text-amber-600 font-medium">💡 Charge devices and geyser before 17:45</div>
    </Card>
  );
}

const ussdScreens: Record<string, { title: string; lines: string[] }> = {
  root: { title: "NexMotion *130#", lines: ["Welcome, Casious", "1. Balance & units", "2. Current usage", "3. Power alerts", "4. Saving tips", "0. Exit"] },
  "1": { title: "Balance & units", lines: ["Meter: NXM-001-TZN", "Remaining: 47.2 kWh", "Today: 18.4 kWh", "Cost today: R 52.44", "", "0. Back"] },
  "2": { title: "Current usage", lines: ["Live: 1 982 W", "10s avg: 1 956 W", "Today: 18.4 kWh", "", "0. Back"] },
  "3": { title: "Power alerts", lines: ["Tamper: OK ✓", "Load anomaly: none", "", "Load shedding:", "Stage 2 · 18:00", "Group 7", "", "0. Back"] },
  "4": { title: "Saving tips", lines: ["1. Switch geyser off", "   before bed", "2. Use cold wash", "3. Unplug standby", "   devices", "", "0. Back"] },
};

function USSDQuickPanel() {
  const [screen, setScreen] = useState("root");
  const cur = ussdScreens[screen];
  return (
    <Card>
      <CardTitle hint="Offline · *130#">USSD quick access</CardTitle>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="mx-auto md:mx-0 w-48 h-80 rounded-3xl bg-navy border-4 border-navy-800 p-3 flex flex-col shadow-xl">
          <div className="h-1 w-12 bg-navy-600 rounded-full mx-auto mb-2" />
          <div className="flex-1 bg-teal/10 rounded-xl p-3 font-mono text-[11px] text-teal-400 leading-relaxed overflow-y-auto">
            <div className="font-bold border-b border-teal/20 pb-1 mb-2">{cur.title}</div>
            {cur.lines.map((l, i) => <div key={i}>{l || "\u00A0"}</div>)}
          </div>
          <div className="h-1 w-8 bg-navy-600 rounded-full mx-auto mt-2" />
        </div>
        <div className="flex-1 w-full">
          <div className="grid grid-cols-2 gap-2">
            {[["1", "Balance"], ["2", "Usage"], ["3", "Alerts"], ["4", "Tips"]].map(([n, l]) => (
              <button key={n} onClick={() => setScreen(n)}
                className="border border-border rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted text-left">
                <span className="font-mono text-teal-600 mr-2">{n}</span>{l}
              </button>
            ))}
            <button onClick={() => setScreen("root")} className="col-span-2 text-xs text-muted-foreground hover:text-foreground py-1.5">
              ← Reset to main menu
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 flex items-start gap-2">
            <Phone className="w-3 h-3 mt-0.5 flex-shrink-0" />
            This mirrors what you'd get dialling *130# without data — works on any phone via the SIM800L GSM module.
          </p>
        </div>
      </div>
    </Card>
  );
}

function AlertsFeed() {
  const alerts = useAlerts((s) => s.alerts);
  const dismiss = useAlerts((s) => s.dismiss);
  const iconFor = (sev: string) => sev === "critical" ? ShieldAlert : sev === "warning" ? AlertTriangle : CheckCircle;
  const borderFor = (sev: string) => sev === "critical" ? "border-l-coral" : sev === "warning" ? "border-l-amber" : "border-l-teal";
  const colorFor = (sev: string) => sev === "critical" ? "text-coral" : sev === "warning" ? "text-amber" : "text-teal";

  return (
    <Card className="sticky top-20">
      <CardTitle hint={`${alerts.length} events`}>Alerts feed</CardTitle>
      <div className="space-y-2 max-h-[600px] overflow-y-auto -mx-1 px-1">
        {alerts.slice(0, 10).map((a) => {
          const Icon = iconFor(a.severity);
          return (
            <div key={a.id} className={`border-l-4 ${borderFor(a.severity)} bg-muted/40 rounded-r-lg p-3 flex gap-2 items-start`}>
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorFor(a.severity)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium leading-snug">{a.description}</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{a.meterId} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</div>
              </div>
              <button onClick={() => dismiss(a.id)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
