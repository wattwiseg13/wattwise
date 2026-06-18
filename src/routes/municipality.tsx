import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { StatusBadge } from "@/components/ui/status-badge";
import { meters } from "@/mock/meters";
import { useAlerts } from "@/store/alertsStore";
import { useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Send, AlertCircle, Activity, DollarSign, Zap, Wifi, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatZAR } from "@/lib/format";
import { DispatchModal } from "@/components/ui/dispatch-modal";
import { toast } from "sonner";

export const Route = createFileRoute("/municipality")({
  head: () => ({ meta: [{ title: "Network · WattWise" }] }),
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

  const [meterSearch, setMeterSearch] = useState("");
  const [meterStatusFilter, setMeterStatusFilter] = useState("all");
  const meterSectionRef = useRef<HTMLDivElement>(null);

  const handleDispatchAll = () => {
    setMeterStatusFilter("critical");
    setMeterSearch("");
    setTimeout(() => meterSectionRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    toast.info(`Showing ${withTamper} critical tampered meters in registry`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Meters online" value={`${online} / ${meters.length}`} icon={Wifi} accent="text-[#005EB8]" />
        <KPI label="Active tamper alerts" value={String(withTamper)} icon={AlertCircle} accent="text-red-600" />
        <KPI label="Illegal connection suspects" value={String(illegal)} icon={Zap} accent="text-amber-600" sub="last 7 days" />
        <KPI label="Network kWh today" value={totalKWh.toFixed(1)} icon={Activity} sub="across all meters" />
        <KPI label="Revenue at risk" value={formatZAR(revenueAtRisk)} icon={DollarSign} accent="text-red-600" />
      </div>

      <NetworkMap />

      <div ref={meterSectionRef}>
        <MeterTable
          search={meterSearch} setSearch={setMeterSearch}
          statusFilter={meterStatusFilter} setStatusFilter={setMeterStatusFilter}
        />
      </div>

      <AlertLog onDispatchAll={handleDispatchAll} />
      <LoadSheddingControl />
    </div>
  );
}

function KPI({ label, value, icon: Icon, accent = "", sub }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: string; sub?: string }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
        <Icon className={`w-4 h-4 ${accent || "text-slate-400"}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold font-mono ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
    </Card>
  );
}

function NetworkMap() {
  const [hover, setHover] = useState<typeof meters[number] | null>(null);
  const colorFor = (s: string) =>
    s === "critical" ? "#EF4444" : s === "warning" ? "#F59E0B" : s === "offline" ? "#94A3B8" : "#22C55E";

  return (
    <Card>
      <CardTitle hint="Connect Google Maps API key to enable live map">Network map — GPS meter locations</CardTitle>
      <div className="relative bg-[#001F5E] rounded-xl overflow-hidden" style={{ height: 520 }}>
        <svg viewBox="0 0 800 520" className="w-full h-full">
          <defs>
            <pattern id="streets" width="80" height="60" patternUnits="userSpaceOnUse">
              <rect width="80" height="60" fill="#0B1628" />
              <rect x="2" y="2" width="76" height="56" fill="#112240" rx="2" />
            </pattern>
          </defs>
          <rect width="800" height="520" fill="url(#streets)" />
          {/* Roads */}
          <g stroke="#1A3458" strokeWidth="3">
            <line x1="0" y1="150" x2="800" y2="150" />
            <line x1="0" y1="370" x2="800" y2="370" />
            <line x1="200" y1="0" x2="200" y2="520" />
            <line x1="500" y1="0" x2="500" y2="520" />
          </g>
          {meters.map((m, i) => {
            const x = 60 + (i % 8) * 95 + (Math.sin(i) * 10);
            const y = 60 + Math.floor(i / 8) * 120 + (Math.cos(i) * 10);
            return (
              <g key={m.id}
                onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)}
                className="cursor-pointer">
                <circle cx={x} cy={y} r="8" fill={colorFor(m.status)} opacity="0.3" />
                <circle cx={x} cy={y} r="4" fill={colorFor(m.status)} />
              </g>
            );
          })}
        </svg>
        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-[#001F5E]/90 backdrop-blur rounded-lg px-3 py-2 flex gap-3 text-[11px] text-white border border-white/10">
          {[["Normal","#22C55E"],["Warning","#F59E0B"],["Critical","#EF4444"],["Offline","#94A3B8"]].map(([l,c])=>(
            <div key={l} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:c}}/>{l}</div>
          ))}
        </div>
        {hover && (
          <div className="absolute top-3 right-3 bg-[#001F5E]/95 backdrop-blur rounded-lg p-3 text-xs text-white max-w-xs border border-white/10">
            <div className="font-mono text-blue-400">{hover.id}</div>
            <div className="mt-1">{hover.address}</div>
            <div className="mt-1 text-slate-200">Draw: {Math.round(hover.currentDraw)} W · {formatDistanceToNow(new Date(hover.lastSeenAt), { addSuffix: true })}</div>
          </div>
        )}
      </div>
    </Card>
  );
}

function MeterTable({ search, setSearch, statusFilter, setStatusFilter }: {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "tamperEvents", dir: "desc" });
  const [page, setPage] = useState(1);
  const [dispatchFor, setDispatchFor] = useState<typeof meters[number] | null>(null);
  const perPage = 20;

  const filtered = useMemo(() => {
    let list = meters.filter((m) =>
      (statusFilter === "all" || m.status === statusFilter) &&
      (search === "" || m.id.toLowerCase().includes(search.toLowerCase()) || m.address.toLowerCase().includes(search.toLowerCase()) || m.consumerName.toLowerCase().includes(search.toLowerCase()))
    );
    list = [...list].sort((a, b) => {
      const av = (a as any)[sort.key]; const bv = (b as any)[sort.key];
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [search, statusFilter, sort]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const toggleSort = (key: string) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  const SortIcon = ({ k }: { k: string }) => sort.key !== k ? null : sort.dir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;

  return (
    <Card>
      <CardTitle hint={`${filtered.length} meters`}>Meter registry</CardTitle>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ID, address or consumer…"
          className="flex-1 min-w-[200px] border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8]"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30">
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
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
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
                className="border-b border-slate-100 hover:bg-[#EBF5FF]/40 cursor-pointer">
                <td className="px-5 py-2.5 font-mono">{m.id}</td>
                <td className="px-5 py-2.5">{m.address}</td>
                <td className="px-5 py-2.5">{m.consumerName}</td>
                <td className="px-5 py-2.5"><StatusBadge status={m.status} /></td>
                <td className="px-5 py-2.5 font-mono">{Math.round(m.currentDraw)}</td>
                <td className="px-5 py-2.5 text-slate-400">{formatDistanceToNow(new Date(m.lastSeenAt), { addSuffix: true })}</td>
                <td className="px-5 py-2.5">
                  {m.tamperEvents > 0
                    ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold text-[10px]">{m.tamperEvents}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setDispatchFor(m)} className="text-[#005EB8] hover:underline text-xs font-medium">Dispatch</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
        <div>Page {page} of {Math.max(1, Math.ceil(filtered.length / perPage))}</div>
        <div className="flex gap-1">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-[#EBF5FF] hover:text-[#005EB8] transition-colors">Prev</button>
          <button disabled={page * perPage >= filtered.length} onClick={() => setPage(p => p + 1)}
            className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-[#EBF5FF] hover:text-[#005EB8] transition-colors">Next</button>
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
  return <th onClick={onClick} className={`px-5 py-2 font-medium ${onClick ? "cursor-pointer hover:text-slate-700" : ""}`}>{children}</th>;
}

function AlertLog({ onDispatchAll }: { onDispatchAll: () => void }) {
  const alerts = useAlerts((s) => s.alerts);
  const tamperedCount = meters.filter((m) => m.tamperEvents > 0).length;

  const sourceOf = (a: typeof alerts[number]) =>
    /tamper|bypass|illegal|anomaly/i.test(a.description) || a.severity === "critical"
      ? "tamper"
      : "consumer";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <CardTitle>Consumer alerts &amp; tamper log</CardTitle>
        <button
          onClick={onDispatchAll}
          className="inline-flex items-center gap-1.5 bg-[#005EB8] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#003F8A] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Dispatch all · {tamperedCount} critical meters
        </button>
      </div>
      <div className="space-y-0">
        {alerts.map((a) => {
          const src = sourceOf(a);
          return (
            <div key={a.id} className="flex items-center gap-3 text-xs py-2.5 border-b border-slate-100 last:border-0">
              <span className="font-mono text-[#005EB8] w-32 flex-shrink-0">{a.meterId}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                src === "tamper"
                  ? "bg-red-100 text-red-600"
                  : "bg-[#EBF5FF] text-[#005EB8]"
              }`}>
                {src === "tamper" ? "TAMPER" : "CONSUMER"}
              </span>
              <span className="flex-1 truncate text-slate-700">{a.description}</span>
              <StatusBadge status={a.severity === "critical" ? "critical" : "warning"} />
              <span className="text-slate-400 w-28 text-right">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
              <span className={`w-32 text-right text-xs ${a.assignedTo ? "text-slate-500" : "text-amber-600 font-medium"}`}>
                {a.assignedTo ?? "Unassigned"}
              </span>
            </div>
          );
        })}
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

  const selectCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 focus:border-[#005EB8]";

  return (
    <Card>
      <CardTitle>Load-shedding broadcast control</CardTitle>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Stage"><select value={stage} onChange={(e)=>setStage(e.target.value)} className={selectCls}>{[1,2,3,4,5,6,7,8].map(n=><option key={n}>{n}</option>)}</select></Field>
        <Field label="Group"><select value={group} onChange={(e)=>setGroup(e.target.value)} className={selectCls}>{Array.from({length:16},(_,i)=>i+1).map(n=><option key={n}>{n}</option>)}</select></Field>
        <Field label="Start time"><input type="time" value={start} onChange={(e)=>setStart(e.target.value)} className={selectCls}/></Field>
        <Field label="End time"><input type="time" value={end} onChange={(e)=>setEnd(e.target.value)} className={selectCls}/></Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={ussd} onChange={(e)=>setUssd(e.target.checked)} className="accent-[#005EB8]" />
          Send USSD push to offline consumers
        </label>
        <button onClick={broadcast} className="inline-flex items-center gap-2 bg-[#005EB8] text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#003F8A] transition-colors">
          <Send className="w-4 h-4"/>Broadcast to Group {group}
        </button>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="text-xs font-medium mb-2 text-slate-400">Recent broadcasts</div>
        <div className="space-y-1 text-xs">
          {history.map((h, i) => (
            <div key={i} className="flex justify-between text-slate-400">
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
      <label className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
