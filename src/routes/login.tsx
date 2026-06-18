import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Building2, Wrench, Zap } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { Role } from "@/types";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · NexMotion Energy Gateway" }] }),
  component: LoginPage,
});

const roles: { id: Role; label: string; desc: string; Icon: typeof Home }[] = [
  { id: "consumer", label: "Household Consumer", desc: "Monitor your meter and usage", Icon: Home },
  { id: "municipality", label: "Municipality Operator", desc: "Oversee all meters in your area", Icon: Building2 },
  { id: "technician", label: "Field Technician", desc: "Respond to tamper alerts on-site", Icon: Wrench },
];

function LoginPage() {
  const [email, setEmail] = useState("casious@nexmotion.za");
  const [password, setPassword] = useState("••••••••");
  const [role, setRole] = useState<Role>("consumer");
  const [remember, setRemember] = useState(true);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, role);
    const target = role === "consumer" ? "/dashboard" : role === "municipality" ? "/municipality" : "/technician";
    navigate({ to: target });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="hidden lg:flex relative bg-navy text-white p-12 flex-col justify-between overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal/20 grid place-items-center">
              <Zap className="w-5 h-5 text-teal" />
            </div>
            <div>
              <div className="font-bold text-lg">NexMotion</div>
              <div className="text-[11px] uppercase tracking-widest text-slate">Energy Gateway</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold leading-tight">Power, transparency and accountability — for every South African household.</h2>
          <p className="text-slate-200 mt-4 text-sm">Live meter telemetry, tamper detection and load-shedding awareness — built for municipalities and consumers from Tzaneen to Sandton.</p>
        </div>
        {/* Circuit SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 600 800" fill="none">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00C9A7" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="600" height="800" fill="url(#grid)" />
          <g stroke="#00C9A7" strokeWidth="2" fill="none">
            <path d="M 60 120 L 200 120 L 200 280 L 400 280 L 400 180 L 540 180" />
            <path d="M 60 400 L 180 400 L 180 540 L 360 540 L 360 660 L 540 660" />
            <path d="M 300 60 L 300 220 L 500 220 L 500 380" />
          </g>
          <g fill="#00C9A7">
            <circle cx="60" cy="120" r="5" /><circle cx="200" cy="280" r="5" />
            <circle cx="400" cy="180" r="5" /><circle cx="540" cy="180" r="5" />
            <circle cx="180" cy="540" r="5" /><circle cx="360" cy="660" r="5" />
            <circle cx="300" cy="60" r="5" /><circle cx="500" cy="380" r="5" />
          </g>
          <g fill="#F59E0B">
            <circle cx="400" cy="280" r="6" /><circle cx="500" cy="220" r="6" />
          </g>
        </svg>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <Zap className="w-6 h-6 text-teal" />
            <span className="font-bold">NexMotion Energy Gateway</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to access your gateway.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Email address</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-teal/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-teal/40"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded" />
              Remember me on this device
            </label>
          </div>

          <div className="mt-6">
            <div className="text-xs font-medium mb-2">I'm signing in as</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {roles.map((r) => {
                const active = role === r.id;
                return (
                  <button
                    type="button" key={r.id} onClick={() => setRole(r.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      active ? "border-teal bg-teal/5" : "border-border hover:border-slate"
                    }`}
                  >
                    <r.Icon className={`w-5 h-5 mb-2 ${active ? "text-teal" : "text-muted-foreground"}`} />
                    <div className="text-xs font-semibold">{r.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{r.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" className="mt-6 w-full bg-teal text-navy font-semibold py-2.5 rounded-lg hover:bg-teal-600 transition-colors text-sm">
            Sign in to Gateway
          </button>

          <p className="text-[11px] text-muted-foreground text-center mt-4">
            By signing in you accept the NexMotion data-use policy and consent to telemetry being shared with your local municipality.
          </p>
        </form>
      </div>
    </div>
  );
}
