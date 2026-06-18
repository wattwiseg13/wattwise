import type { Meter, MeterStatus } from "@/types";

const areas = ["Tzaneen North", "Tzaneen South", "Nkowankowa", "Lenyenye", "Letsitele"];
const names = [
  "Casious Mookamedi", "Thandi Mokoena", "Sipho Dlamini", "Naledi Khumalo",
  "Refilwe Mahlangu", "Tebogo Mathebula", "Lerato Ncube", "Kgomotso Phiri",
  "Mpho Sibanda", "Zanele Nkosi", "Bongani Mthembu", "Palesa Radebe",
  "Tshepo Maluleke", "Nomvula Zungu", "Kabelo Letsoalo", "Dineo Molefe",
  "Andile Cele", "Khanyisile Vilakazi", "Sibusiso Hadebe", "Lindiwe Mabaso",
  "Tumelo Sithole", "Boipelo Khoza", "Mandla Buthelezi", "Precious Maseko",
];

const statuses: MeterStatus[] = [
  "normal","normal","normal","normal","normal","normal","normal","normal","normal","normal",
  "normal","normal","normal","normal","warning","warning","warning","warning",
  "critical","critical","critical","offline","offline","normal",
];

const meterLocations: ReadonlyArray<readonly [number, number]> = [
  [-23.8214, 30.1579], [-23.8282, 30.1686], [-23.8351, 30.1621], [-23.8428, 30.1742],
  [-23.8497, 30.1538], [-23.8159, 30.1811], [-23.8268, 30.1467], [-23.8389, 30.1882],
  [-23.8541, 30.1664], [-23.8118, 30.1602], [-23.8237, 30.1924], [-23.8455, 30.1408],
  [-23.8588, 30.1817], [-23.8049, 30.1748], [-23.8316, 30.1339], [-23.8662, 30.1584],
  [-23.8175, 30.2011], [-23.8412, 30.2018], [-23.8731, 30.1741], [-23.7978, 30.1516],
  [-23.8523, 30.1279], [-23.8794, 30.1913], [-23.8087, 30.1361], [-23.8627, 30.1433],
];

export const meters: Meter[] = Array.from({ length: 24 }, (_, i) => {
  const status = statuses[i];
  const baseline = 1800 + Math.floor(Math.random() * 600);
  return {
    id: `NXM-${String(i + 1).padStart(3, "0")}-TZN`,
    address: `${10 + i} Mokoena St, ${areas[i % areas.length]}`,
    area: areas[i % areas.length],
    consumerName: names[i],
    consumerPhone: `+27 8${i % 10} 555 ${1000 + i}`,
    status,
    currentDraw: status === "offline" ? 0 :
      status === "critical" ? baseline * 1.65 :
      status === "warning" ? baseline * 1.32 :
      baseline * (0.85 + Math.random() * 0.2),
    baselineWatts: baseline,
    deviationThreshold: 45,
    lastSeenAt: new Date(Date.now() - (status === "offline" ? 3600_000 * 4 : Math.random() * 60_000)).toISOString(),
    tamperEvents: status === "critical" ? 3 + Math.floor(Math.random() * 4) :
                  status === "warning" ? 1 + Math.floor(Math.random() * 2) : 0,
    installedAt: new Date(Date.now() - 365 * 24 * 3600_000 * (1 + Math.random() * 3)).toISOString(),
    hardwareVersion: "NX-Gateway v2.1",
    firmwareVersion: "1.4.7",
    lat: meterLocations[i][0],
    lng: meterLocations[i][1],
  };
});

export const usageHistory = (meterId: string) => {
  const seed = meterId.charCodeAt(4) || 1;
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    date: new Date(Date.now() - (29 - i) * 86400_000).toISOString().slice(0, 10),
    kWh: 12 + Math.sin((i + seed) * 0.7) * 4 + Math.random() * 3,
    hadTamper: Math.random() < 0.08,
  }));
};

export const hourlyUsageToday = () =>
  Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    kWh: 0.5 + Math.abs(Math.sin(h * 0.4)) * 2.5 + (h >= 17 && h <= 21 ? 1.8 : 0) + Math.random() * 0.3,
  }));
