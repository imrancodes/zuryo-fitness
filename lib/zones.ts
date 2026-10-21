export const SERVICE_ZONES = ["Indiranagar", "Koramangala", "HSR Layout", "Whitefield", "Jayanagar"] as const;

export type ServiceZone = (typeof SERVICE_ZONES)[number];
