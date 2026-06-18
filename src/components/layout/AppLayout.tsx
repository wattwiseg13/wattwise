import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Wrench, Bell, Smartphone, Settings, FileText,
  LogOut, Zap, Home, Activity, Search,
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

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const connected = useLiveData((s) => s.connected);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [now, setNow] = useState(new Date());

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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-navy text-white fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal/20 grid place-items-center">
              <Zap className="w-4 h-4 text-teal" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">NexMotion</div>
              <div className="text-[10px] uppercase tracking-widest text-slate">Energy Gateway</div>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-teal/10 text-teal px-2.5 py-1 text-xs font-medium">
            <RoleIcon className="w-3 h-3" />
            {roleLabel[user.role]}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((it) => {
            const active = pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-teal/15 text-teal" : "text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-teal animate-pulse" : "bg-coral"}`} />
            <span className={connected ? "text-teal" : "text-coral"}>
              {connected ? "Live · Serial bridge" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <div className="w-8 h-8 rounded-full bg-navy-600 grid place-items-center text-xs font-semibold">
              {user.name.split(" ").map((n) => n[0]).slice(0,2).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user.name}</div>
              <div className="text-[10px] text-slate truncate">{user.email}</div>
            </div>
            <button
              onClick={() => { logout(); navigate({ to: "/login" }); }}
              className="text-slate hover:text-coral transition-colors"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-60 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="h-14 bg-slate-800 text-white sticky top-0 z-20 flex items-center px-4 md:px-6 gap-4">
          <h1 className="text-sm font-semibold truncate">{title}</h1>
          <div className="hidden md:flex flex-1 max-w-md mx-auto relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              type="text"
              placeholder="Search meters, addresses, events…"
              className="w-full bg-navy/60 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs placeholder:text-slate focus:outline-none focus:border-teal"
            />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button className="relative text-slate-200 hover:text-white">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-coral text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 grid place-items-center">3</span>
            </button>
            <div className="font-mono text-xs text-teal-400 tabular-nums hidden sm:block">
              {format(now, "yyyy-MM-dd HH:mm:ss")} SAST
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-navy border-t border-white/10 flex justify-around py-2 z-30">
        {items.slice(0, 5).map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${active ? "text-teal" : "text-slate"}`}>
              <Icon className="w-5 h-5" />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
