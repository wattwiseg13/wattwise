import { create } from "zustand";
import type { Reading } from "@/types";

interface LiveDataState {
  connected: boolean;
  readings: Reading[];
  current: Reading;
  todayKWh: number;
  push: (r: Reading) => void;
  setConnected: (c: boolean) => void;
}

const baseline = 1950;

export const useLiveData = create<LiveDataState>((set) => ({
  connected: true,
  readings: Array.from({ length: 300 }, (_, i) => ({
    timestamp: Date.now() - (300 - i) * 1000,
    watts: baseline + Math.sin(i * 0.1) * 80 + (Math.random() - 0.5) * 60,
    voltage: 230 + (Math.random() - 0.5) * 4,
  })),
  current: { timestamp: Date.now(), watts: baseline, voltage: 230 },
  todayKWh: 18.4,
  setConnected: (c) => set({ connected: c }),
  push: (r) =>
    set((s) => {
      const readings = [...s.readings.slice(-299), r];
      return {
        readings,
        current: r,
        todayKWh: s.todayKWh + r.watts / 1000 / 3600,
      };
    }),
}));

// Simulate live readings
if (typeof window !== "undefined") {
  setInterval(() => {
    const s = useLiveData.getState();
    const last = s.current.watts;
    const drift = (Math.random() - 0.5) * 80;
    const watts = Math.max(200, last + drift);
    s.push({
      timestamp: Date.now(),
      watts,
      voltage: 230 + (Math.random() - 0.5) * 4,
    });
  }, 1000);
}
