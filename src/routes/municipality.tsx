import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { StatusBadge } from "@/components/ui/status-badge";
import { meters } from "@/mock/meters";
import { useAlerts } from "@/store/alertsStore";
import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, Send, AlertCircle, Activity, DollarSign, Zap, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatZAR } from "@/lib/format";
import { DispatchModal } from "@/components/ui/dispatch-modal";
import { toast } from "sonner";
import { MeterNetworkMap } from "@/components/maps/MeterNetworkMap";

export const Route = createFileRoute("/municipality")({
  head: () => ({ meta: [{ title: "Network · NexMotion" }] }),
  component: () => (
    <AppLayout title="Municipality Network Overview">
      <Municipality />
    </AppLayout>
  ),
});

function Municipality() {
  const alerts = useAlerts((s) => s.alerts);
  const online = meters.filter((m) => m.status !== "offline").length;
  const withTamper = meters.filter((m) => m.tamperEvents > 0).length;
  const illegal = alerts.filter((a) => /illegal|bypass|anomaly/i.test(a.description)).length;
  const totalKWh = meters.reduce((s, m) => s + (m.currentDraw / 1000) * 8, 0);
  const revenueAtRisk = withTamper * 487;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Meters online" value={`${online} / ${meters.length}`} icon={Wifi} accent="text-teal-600" />
        <KPI label="Active tamper alerts" value={String(withTamper)} icon={AlertCircle} accent="text-coral" />
        <KPI label="Illegal connection suspects" value={String(illegal)} icon={Zap} accent="text-amber-600" sub="last 7 days" />
        <KPI label="Network kWh today" value={totalKWh.toFixed(1)} icon={Activity} sub="across all meters" />
        <KPI label="Revenue at risk" value={formatZAR(revenueAtRisk)} icon={DollarSign} accent="text-coral" />
      </div>

      <MeterNetworkMap meters={meters} />
      <MeterTable />
      <TamperLog />
      <LoadSheddingControl />
    </div>
  );
}

function KPI({ label, value, icon: Icon, accent = "", sub }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: string; sub?: string }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`w-4 h-4 ${accent || "text-muted-foreground"}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold font-mono ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function MeterTable() {
  type SortKey = "id" | "status" | "currentDraw" | "tamperEvents";
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "tamperEvents", dir: "desc" });
  const [page, setPage] = useState(1);
  const [dispatchFor, setDispatchFor] = useState<typeof meters[number] | null>(null);
  const perPage = 20;

  const filtered = useMemo(() => {
    let list = meters.filter((m) =>
      (statusFilter === "all" || m.status === statusFilter) &&
      (search === "" || m.id.toLowerCase().includes(search.toLowerCase()) || m.address.toLowerCase().includes(search.toLowerCase()) || m.consumerName.toLowerCase().includes(search.toLowerCase()))
    );
    list = [...list].sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      const comparison = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? comparison : -comparison;
    });
    return list;
  }, [search, statusFilter, sort]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const toggleSort = (key: SortKey) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  const SortIcon = ({ k }: { k: SortKey }) => sort.key !== k ? null : sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;

  return (
    <Card>
      <CardTitle hint={`${filtered.length} meters`}>Meter registry</CardTitle>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, address or consumer…"
          className="flex-1 min-w-[200px] border border-input rounded-lg px-3 py-1.5 text-xs bg-background"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-input rounded-lg px-3 py-1.5 text-xs bg-background">
          <option value="all">All statuses</option>
          <option value="normal">Normal</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
          <option value="offline">Offline</option>
        </select>
      </div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <Th onClick={() => toggleSort("id")}>Meter ID <SortIcon k="id" /></Th>
              <Th>Address</Th>
              <Th>Consumer</Th>
              <Th onClick={() => toggleSort("status")}>Status <SortIcon k="status" /></Th>
              <Th onClick={() => toggleSort("currentDraw")}>Draw (W) <SortIcon k="currentDraw" /></Th>
              <Th>Last seen</Th>
              <Th onClick={() => toggleSort("tamperEvents")}>Tampers <SortIcon k="tamperEvents" /></Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {paged.map((m) => (
              <tr key={m.id} onClick={() => navigate({ to: "/meter/$meterId", params: { meterId: m.id } })}
                className="border-b border-border hover:bg-muted/40 cursor-pointer">
                <td className="px-5 py-2.5 font-mono">{m.id}</td>
                <td className="px-5 py-2.5">{m.address}</td>
                <td className="px-5 py-2.5">{m.consumerName}</td>
                <td className="px-5 py-2.5"><StatusBadge status={m.status} /></td>
                <td className="px-5 py-2.5 font-mono">{Math.round(m.currentDraw)}</td>
                <td className="px-5 py-2.5 text-muted-foreground">{formatDistanceToNow(new Date(m.lastSeenAt), { addSuffix: true })}</td>
                <td className="px-5 py-2.5">
                  {m.tamperEvents > 0 ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-coral-100 text-coral-600 font-bold text-[10px]">{m.tamperEvents}</span> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-5 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setDispatchFor(m)} className="text-teal-600 hover:underline text-xs font-medium">Dispatch</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <div>Page {page} of {Math.max(1, Math.ceil(filtered.length / perPage))}</div>
        <div className="flex gap-1">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border border-border rounded disabled:opacity-40">Prev</button>
          <button disabled={page * perPage >= filtered.length} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border border-border rounded disabled:opacity-40">Next</button>
        </div>
      </div>
      {dispatchFor && (
        <DispatchModal open onClose={() => setDispatchFor(null)} meterId={dispatchFor.id} address={dispatchFor.address}
          summary={dispatchFor.tamperEvents > 0 ? `${dispatchFor.tamperEvents} tamper event(s) detected on this meter.` : undefined} />
      )}
    </Card>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <th onClick={onClick} className={`px-5 py-2 font-medium ${onClick ? "cursor-pointer hover:text-foreground" : ""}`}>{children}</th>;
}

function TamperLog() {
  const alerts = useAlerts((s) => s.alerts);
  return (
    <Card>
      <CardTitle>Tamper event log</CardTitle>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 text-xs py-2 border-b border-border last:border-0">
            <span className="font-mono text-teal-600 w-32 flex-shrink-0">{a.meterId}</span>
            <span className="flex-1 truncate">{a.description}</span>
            <StatusBadge status={a.severity === "critical" ? "critical" : "warning"} />
            <span className="text-muted-foreground w-28 text-right">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
            <span className={`w-32 text-right text-xs ${a.assignedTo ? "" : "text-amber-600 font-medium"}`}>
              {a.assignedTo ?? "Unassigned"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LoadSheddingControl() {
  const [stage, setStage] = useState("2");
  const [group, setGroup] = useState("7");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:30");
  const [ussd, setUssd] = useState(true);
  const [history, setHistory] = useState<{ stage: string; group: string; at: string }[]>([
    { stage: "2", group: "5", at: new Date(Date.now() - 86400_000).toISOString() },
    { stage: "1", group: "12", at: new Date(Date.now() - 2 * 86400_000).toISOString() },
  ]);

  const broadcast = () => {
    setHistory((h) => [{ stage, group, at: new Date().toISOString() }, ...h].slice(0, 5));
    toast.success(`Broadcast sent to Group ${group} · Stage ${stage}${ussd ? " (incl. USSD push)" : ""}`);
  };

  return (
    <Card>
      <CardTitle>Load-shedding broadcast control</CardTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Stage"><select value={stage} onChange={(e)=>setStage(e.target.value)} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background">{[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></Field>
        <Field label="Group"><select value={group} onChange={(e)=>setGroup(e.target.value)} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background">{Array.from({length:16},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}</select></Field>
        <Field label="Start time"><input type="time" value={start} onChange={(e)=>setStart(e.target.value)} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"/></Field>
        <Field label="End time"><input type="time" value={end} onChange={(e)=>setEnd(e.target.value)} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"/></Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={ussd} onChange={(e)=>setUssd(e.target.checked)} />Send USSD push to offline consumers</label>
        <button onClick={broadcast} className="inline-flex items-center gap-2 bg-teal text-navy font-semibold px-4 py-2 rounded-lg text-sm hover:bg-teal-600"><Send className="w-4 h-4"/>Broadcast to Group {group}</button>
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <div className="text-xs font-medium mb-2 text-muted-foreground">Recent broadcasts</div>
        <div className="space-y-1 text-xs">
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>Stage {h.stage} · Group {h.group}</span>
              <span>{formatDistanceToNow(new Date(h.at), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
