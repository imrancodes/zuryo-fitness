export const SERVICE_ZONES = ["Mumbai", "Thane", "Navi Mumbai", "Delhi", "Bengaluru"] as const;

export type ServiceZone = (typeof SERVICE_ZONES)[number];

export const LEGACY_ZONE_NAMES: Record<string, ServiceZone> = {
  Indiranagar: "Mumbai",
  Koramangala: "Thane",
  "HSR Layout": "Navi Mumbai",
  Whitefield: "Delhi",
  Jayanagar: "Bengaluru",
};
