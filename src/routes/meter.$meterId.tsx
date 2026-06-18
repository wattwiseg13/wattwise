import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { StatusBadge } from "@/components/ui/status-badge";
import { WaveformChart } from "@/components/charts/WaveformChart";
import { UsageHistoryChart } from "@/components/charts/BarCharts";
import { meters, usageHistory } from "@/mock/meters";
import { useAlerts } from "@/store/alertsStore";
import { CountUp } from "@/components/ui/count-up";
import { useLiveData } from "@/store/liveDataStore";
import { formatZAR, TARIFF_PER_KWH } from "@/lib/format";
import { ArrowLeft, Download, Send, AlertTriangle, ShieldAlert, CheckCircle, Pencil } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";
import { DispatchModal } from "@/components/ui/dispatch-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/meter/$meterId")({
  head: () => ({ meta: [{ title: "Meter detail · NexMotion" }] }),
  component: MeterDetailPage,
});

function MeterDetailPage() {
  const { meterId } = useParams({ from: "/meter/$meterId" });
  const meter = meters.find((m) => m.id === meterId);
  return (
    <AppLayout title={`Meter ${meterId}`}>
      {meter ? <MeterDetail meterId={meterId} /> : <div className="text-sm text-muted-foreground">Meter not found.</div>}
    </AppLayout>
  );
}

function MeterDetail({ meterId }: { meterId: string }) {
  const meter = meters.find((m) => m.id === meterId)!;
  const current = useLiveData((s) => s.current);
  const todayKWh = useLiveData((s) => s.todayKWh);
  const history = useMemo(() => usageHistory(meterId), [meterId]);
  const alerts = useAlerts((s) => s.alerts).filter((a) => a.meterId === meterId);
  const [dispatch, setDispatch] = useState(false);
  const [baseline, setBaseline] = useState(meter.baselineWatts);
  const [threshold, setThreshold] = useState(meter.deviationThreshold);
  const [editBaseline, setEditBaseline] = useState(false);
  const [editThreshold, setEditThreshold] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/municipality" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"><ArrowLeft className="w-3 h-3" />Back to network</Link>
          <h2 className="text-2xl font-mono font-bold">{meter.id}</h2>
          <div className="text-sm text-muted-foreground mt-1">{meter.address}</div>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={meter.status} />
            <span className="text-xs text-muted-foreground">Last seen {formatDistanceToNow(new Date(meter.lastSeenAt), { addSuffix: true })}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDispatch(true)} className="inline-flex items-center gap-2 bg-teal text-navy font-semibold px-3 py-2 rounded-lg text-sm hover:bg-teal-600"><Send className="w-4 h-4"/>Dispatch Technician</button>
          <button onClick={() => toast.success("Report exported")} className="inline-flex items-center gap-2 border border-border px-3 py-2 rounded-lg text-sm hover:bg-muted"><Download className="w-4 h-4"/>Export PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniMetric label="Current draw" value={<><CountUp value={current.watts}/> W</>} mono />
        <MiniMetric label="Voltage" value={<><CountUp value={current.voltage} decimals={1}/> V</>} mono />
        <MiniMetric label="Today usage" value={<><CountUp value={todayKWh} decimals={2}/> kWh</>} mono />
        <MiniMetric label="Cost today" value={formatZAR(todayKWh * TARIFF_PER_KWH)} accent="text-amber-600" />
      </div>

      <Card>
        <CardTitle hint="Last 5 minutes">Live power draw</CardTitle>
        <WaveformChart height={240} />
      </Card>

      <Card>
        <CardTitle hint={`${alerts.length} events`}>Tamper history</CardTitle>
        {alerts.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">No tamper events recorded for this meter.</div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => {
              const Icon = a.severity === "critical" ? ShieldAlert : a.severity === "warning" ? AlertTriangle : CheckCircle;
              const border = a.severity === "critical" ? "border-l-coral" : "border-l-amber";
              return (
                <div key={a.id} className={`border-l-4 ${border} bg-muted/40 rounded-r-lg p-3`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${a.severity === "critical" ? "text-coral" : "text-amber"}`} />
                    <span className="text-xs font-medium">{a.description}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{format(new Date(a.createdAt), "yyyy-MM-dd HH:mm")}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 ml-6">
                    Deviation: +{a.deviationPct ?? 42}% · {a.assignedTo ? `Dispatched to ${a.assignedTo}` : "Not dispatched"}
                    {a.resolutionNote && ` · ${a.resolutionNote}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle hint="Last 30 days · coral marks tamper days">Usage history</CardTitle>
        <UsageHistoryChart data={history} />
      </Card>

      <Card>
        <CardTitle>Meter information</CardTitle>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Info label="Consumer">{meter.consumerName}</Info>
          <Info label="Contact"><span className="font-mono">{meter.consumerPhone}</span></Info>
          <Info label="Installed">{format(new Date(meter.installedAt), "PP")}</Info>
          <Info label="Hardware version">{meter.hardwareVersion}</Info>
          <Info label="Firmware version">{meter.firmwareVersion}</Info>
          <Info label="Serial bridge"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal animate-pulse" />Online</span></Info>
          <Info label="Baseline watts">
            {editBaseline ? (
              <input type="number" value={baseline} onChange={(e)=>setBaseline(Number(e.target.value))}
                onBlur={()=>{setEditBaseline(false); toast.success("Baseline updated");}}
                autoFocus className="font-mono border border-input rounded px-2 py-0.5 w-24"/>
            ) : (
              <button onClick={()=>setEditBaseline(true)} className="font-mono inline-flex items-center gap-1 hover:text-teal-600">{baseline} W <Pencil className="w-3 h-3"/></button>
            )}
          </Info>
          <Info label="Deviation threshold">
            {editThreshold ? (
              <input type="number" value={threshold} onChange={(e)=>setThreshold(Number(e.target.value))}
                onBlur={()=>{setEditThreshold(false); toast.success("Threshold updated");}}
                autoFocus className="font-mono border border-input rounded px-2 py-0.5 w-20"/>
            ) : (
              <button onClick={()=>setEditThreshold(true)} className="font-mono inline-flex items-center gap-1 hover:text-teal-600">{threshold}% <Pencil className="w-3 h-3"/></button>
            )}
          </Info>
        </div>
      </Card>

      <DispatchModal open={dispatch} onClose={()=>setDispatch(false)} meterId={meter.id} address={meter.address}
        summary={meter.tamperEvents > 0 ? `${meter.tamperEvents} active tamper event(s) require investigation.` : undefined} />
    </div>
  );
}

function MiniMetric({ label, value, mono, accent = "" }: { label: string; value: React.ReactNode; mono?: boolean; accent?: string }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${mono ? "font-mono" : ""} ${accent}`}>{value}</div>
    </Card>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}
