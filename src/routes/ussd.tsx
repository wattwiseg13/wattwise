import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card-basic";
import { useState } from "react";
import { Phone, X } from "lucide-react";

export const Route = createFileRoute("/ussd")({
  head: () => ({ meta: [{ title: "USSD Simulator · WattWise" }] }),
  component: () => (
    <AppLayout title="USSD Simulator">
      <USSD />
    </AppLayout>
  ),
});

type Screen = { title: string; lines: string[]; options?: Record<string, string> };

const screens: Record<string, Screen> = {
  start: { title: "Dial *130#", lines: ["Enter *130# and press Dial", "to simulate the offline", "USSD session."] },
  root: {
    title: "WattWise *130#",
    lines: ["Welcome, Casious", "", "1. Balance & units", "2. Current usage", "3. Power alerts", "4. Saving tips", "0. Exit"],
    options: { "1": "balance", "2": "usage", "3": "alerts", "4": "tips", "0": "start" },
  },
  balance: { title: "Balance & units", lines: ["Meter: NXM-001-TZN", "Remaining: 47.2 kWh", "Today's usage: 18.4 kWh", "Estimated cost: R 52.44", "", "0. Back to menu"], options: { "0": "root" } },
  usage: { title: "Current usage", lines: ["Live: 1 982 W", "10s average: 1 956 W", "Today: 18.4 kWh", "", "0. Back to menu"], options: { "0": "root" } },
  alerts: { title: "Power alerts", lines: ["Tamper status: OK ✓", "Load anomaly: none", "", "Load shedding:", "Stage 2 · Today 18:00", "Group 7 — Tzaneen N.", "", "0. Back to menu"], options: { "0": "root" } },
  tips: { title: "Saving tips", lines: ["1. Switch geyser off", "   before bedtime", "2. Use cold water wash", "3. Unplug standby", "   appliances overnight", "", "0. Back to menu"], options: { "0": "root" } },
};

function USSD() {
  const [screen, setScreen] = useState<keyof typeof screens>("start");
  const [input, setInput] = useState("");
  const cur = screens[screen];

  const dial = () => {
    if (input.trim() === "*130#") { setScreen("root"); setInput(""); }
    else setInput("");
  };
  const press = (n: string) => {
    const next = cur.options?.[n];
    if (next) setScreen(next as keyof typeof screens);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="flex flex-col items-center">
          {/* Phone */}
          <div className="w-[280px] h-[560px] rounded-[2.5rem] bg-navy border-8 border-navy-800 p-3 shadow-2xl flex flex-col">
            <div className="h-1 w-16 bg-navy-600 rounded-full mx-auto mb-2" />
            <div className="flex-1 bg-teal/5 border border-teal/20 rounded-2xl p-4 flex flex-col font-mono text-xs text-teal-400 overflow-y-auto">
              <div className="font-bold text-teal pb-2 border-b border-teal/20 mb-3">{cur.title}</div>
              {cur.lines.map((l, i) => <div key={i} className="leading-relaxed">{l || "\u00A0"}</div>)}
            </div>
            <div className="h-1 w-10 bg-navy-600 rounded-full mx-auto mt-2" />
          </div>

          {/* Controls */}
          <div className="mt-6 w-full max-w-md">
            {screen === "start" ? (
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="*130#"
                  className="flex-1 font-mono border border-input rounded-lg px-3 py-2.5 text-center text-lg bg-background"/>
                <button onClick={dial} className="bg-teal text-navy font-bold px-5 rounded-lg hover:bg-teal-600">Dial</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {["1", "2", "3", "4"].map((n) => (
                    <button key={n} onClick={() => press(n)}
                      disabled={!cur.options?.[n]}
                      className="aspect-square rounded-lg border border-border bg-card font-mono text-xl font-bold hover:bg-muted disabled:opacity-40">
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => press("0")} disabled={!cur.options?.["0"]}
                    className="flex-1 py-2 rounded-lg border border-border font-mono font-bold hover:bg-muted disabled:opacity-40">0 · Back</button>
                  <button onClick={() => setScreen("start")}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg bg-coral text-white font-semibold text-sm hover:bg-coral-600">
                    <X className="w-4 h-4"/>End
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground text-center max-w-md flex items-start gap-2">
            <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-teal-600" />
            <span>This simulates the offline USSD experience. On the physical device, consumers dial <span className="font-mono">*130#</span> without any data connection via the SIM800L GSM module — works on every basic feature phone.</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
