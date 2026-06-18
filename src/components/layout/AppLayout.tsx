import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wrench, Bell, Smartphone, Settings, FileText,
  LogOut, Zap, Home, Menu, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";
import { useLiveData } from "@/store/liveDataStore";
import { format } from "date-fns";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const navByRole: Record<string, NavItem[]> = {
  consumer: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/alerts", label: "Alerts", icon: Bell },
    { to: "/ussd", label: "USSD Simulator", icon: Smartphone },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  municipality: [
    { to: "/municipality", label: "Network", icon: Building2 },
    { to: "/alerts", label: "Alerts", icon: Bell },
    { to: "/ussd", label: "USSD Simulator", icon: Smartphone },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  technician: [
    { to: "/technician", label: "My Jobs", icon: Wrench },
    { to: "/alerts", label: "Alerts", icon: Bell },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
};

const roleLabel = { consumer: "Consumer", municipality: "Municipality", technician: "Technician" };
const roleBadgeColor = {
  consumer: "bg-[#EBF5FF] text-[#005EB8]",
  municipality: "bg-emerald-50 text-emerald-700",
  technician: "bg-amber-50 text-amber-700",
};

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const connected = useLiveData((s) => s.connected);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [now, setNow] = useState(new Date());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) navigate({ to: "/login" });
  }, [user, navigate]);

  if (!user) return null;

  const items = navByRole[user.role];
  const RoleIcon = user.role === "consumer" ? Home : user.role === "municipality" ? Building2 : Wrench;
  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-slate-100 fixed inset-y-0 left-0 z-30 shadow-sm">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#005EB8] grid place-items-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight">WattWise</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Energy Gateway</div>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeColor[user.role]}`}>
            <RoleIcon className="w-3 h-3" />
            {roleLabel[user.role]}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-[#EBF5FF] text-[#005EB8]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#005EB8]" : "text-slate-400"}`} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-1">
          {/* Live status */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className={connected ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
              {connected ? "Live · Serial bridge" : "Disconnected"}
            </span>
          </div>
          {/* User row */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 group">
            <div className="w-7 h-7 rounded-full bg-[#005EB8] grid place-items-center text-white text-[11px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
            </div>
            <button
              onClick={() => { logout(); navigate({ to: "/login" }); }}
              className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-100 z-50 flex flex-col shadow-xl transition-transform duration-200 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#005EB8] grid place-items-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">WattWise</span>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {items.map((it) => {
            const active = pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setMobileNavOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-[#EBF5FF] text-[#005EB8]" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-[#005EB8]" : "text-slate-400"}`} />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-100">
          <button
            onClick={() => { logout(); navigate({ to: "/login" }); }}
            className="flex items-center gap-2 text-sm text-red-500 font-medium"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 md:ml-60 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-100 sticky top-0 z-20 flex items-center px-4 md:px-6 gap-3 shadow-sm">
          {/* Mobile menu button */}
          <button
            className="md:hidden text-slate-500 hover:text-slate-800 mr-1"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-sm font-semibold text-slate-900 truncate">{title}</h1>

          <div className="flex items-center gap-3 ml-auto">
            {/* Live clock */}
            <div className="font-mono text-xs text-slate-400 tabular-nums hidden sm:block">
              {format(now, "HH:mm:ss")} SAST
            </div>
            {/* Connection dot */}
            <div
              className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
              title={connected ? "Connected" : "Disconnected"}
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 flex justify-around py-2 z-30 shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
        {items.slice(0, 5).map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
                active ? "text-[#005EB8]" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
