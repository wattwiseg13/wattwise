export const formatZAR = (n: number) =>
  "R " +
  n
    .toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/,/g, " ");

export const formatW = (n: number) =>
  `${Math.round(n).toLocaleString("en-ZA")} W`;

export const formatKWh = (n: number) => `${n.toFixed(2)} kWh`;

// Keep this aligned with backend/app/api/routes/readings.py
export const TARIFF_PER_KWH = 3.90; // R/kWh
