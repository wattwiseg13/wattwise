import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardTitle } from "@/components/ui/card-basic";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { User as UserIcon, Cpu, Bell } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · NexMotion" }] }),
  component: () => (
    <AppLayout title="Settings">
      <SettingsPage />
    </AppLayout>
  ),
});

const tabs = [
  { id: "account", label: "Account", Icon: UserIcon },
  { id: "hardware", label: "Hardware", Icon: Cpu },
  { id: "notifications", label: "Notifications", Icon: Bell },
] as const;

function SettingsPage() {
  const [tab, setTab] = useState<typeof tabs[number]["id"]>("account");
  return (
    <div className="max-w-3xl">
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2 ${
              tab === t.id ? "border-teal text-teal-600" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.Icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "account" && <AccountTab />}
      {tab === "hardware" && <HardwareTab />}
      {tab === "notifications" && <NotificationsTab />}
    </div>
  );
}

function AccountTab() {
  const user = useAuthStore((s) => s.user);
  return (
    <Card>
      <CardTitle>Account</CardTitle>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-teal/15 text-teal-600 grid place-items-center text-xl font-bold">
            {user?.name.split(" ").map(n=>n[0]).slice(0,2).join("")}
          </div>
          <button className="text-xs text-teal-600 hover:underline">Upload photo</button>
        </div>
        <Field label="Full name" defaultValue={user?.name} />
        <Field label="Email" defaultValue={user?.email} type="email" />
        <Field label="Phone number" defaultValue="+27 82 555 0101" />
        <div className="text-xs"><span className="text-muted-foreground">Role: </span><span className="font-semibold capitalize">{user?.role}</span></div>
        <div className="border-t border-border pt-4">
          <div className="text-sm font-medium mb-3">Change password</div>
          <Field label="Current password" type="password" />
          <Field label="New password" type="password" />
        </div>
        <button onClick={() => toast.success("Account saved")} className="bg-teal text-navy font-semibold px-4 py-2 rounded-lg text-sm hover:bg-teal-600">Save changes</button>
      </div>
    </Card>
  );
}

function HardwareTab() {
  const [threshold, setThreshold] = useState(45);
  return (
    <Card>
      <CardTitle>Hardware configuration</CardTitle>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="COM port" defaultValue="COM3" />
          <div>
            <Label>Baud rate</Label>
            <select defaultValue="9600" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background">
              {[2400, 4800, 9600, 19200, 38400, 57600, 115200].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => toast.success("Serial bridge connected · NX-Gateway v2.1")} className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Test connection</button>

        <div className="border-t border-border pt-4">
          <Field label="Baseline watts" defaultValue="1950" type="number" />
          <div>
            <Label>Deviation threshold ({threshold}%)</Label>
            <input type="range" min={10} max={100} value={threshold} onChange={(e)=>setThreshold(Number(e.target.value))} className="w-full accent-teal" />
          </div>
          <div className="mt-3">
            <Label>Sample interval</Label>
            <select defaultValue="1000" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background">
              <option value="500">500 ms</option><option value="1000">1 s</option>
              <option value="2000">2 s</option><option value="5000">5 s</option>
            </select>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <Field label="EskomSePush API key" placeholder="esp_xxxxxxxxxxxx" type="password" />
        </div>

        <button onClick={() => toast.success("Hardware settings saved")} className="bg-teal text-navy font-semibold px-4 py-2 rounded-lg text-sm hover:bg-teal-600">Save hardware settings</button>
      </div>
    </Card>
  );
}

function NotificationsTab() {
  const user = useAuthStore((s) => s.user);
  return (
    <Card>
      <CardTitle>Notifications</CardTitle>
      <div className="space-y-4">
        <Toggle label="Email alerts for critical tamper events" defaultChecked />
        <Toggle label="SMS alerts (charges may apply)" />
        <Field label="SMS phone number" defaultValue="+27 82 555 0101" />
        <Toggle label="Browser push notifications" defaultChecked />
        {user?.role === "municipality" && <Toggle label="USSD push broadcast (municipality only)" defaultChecked />}
        <div>
          <Label>Notification frequency</Label>
          <select defaultValue="immediately" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background">
            <option value="immediately">Immediately</option>
            <option value="15min">Every 15 minutes</option>
            <option value="hourly">Hourly digest</option>
          </select>
        </div>
        <button onClick={() => toast.success("Notification preferences saved")} className="bg-teal text-navy font-semibold px-4 py-2 rounded-lg text-sm hover:bg-teal-600">Save preferences</button>
      </div>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{children}</label>;
}
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label>{label}</Label>
      <input {...props} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background" />
    </div>
  );
}
function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <button onClick={() => setOn(!on)} className="flex items-center justify-between w-full text-left text-sm">
      <span>{label}</span>
      <span className={`w-10 h-5 rounded-full p-0.5 transition-colors ${on ? "bg-teal" : "bg-muted"}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
