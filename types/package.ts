export type PackageSummary = {
  purchased: number;
  used: number;
  remaining: number;
  activePackages: number;
};

export type PackageView = {
  id: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  status: "active" | "exhausted" | "expired" | "cancelled";
  source: "seed" | "admin";
  createdAt: string;
};

export type DeductionView = {
  id: string;
  bookingId: string;
  outcome: "deducted" | "no_package";
  sessionDate: string | null;
  createdAt: string;
};

export type AdminPackageView = PackageView & {
  customer: { id: string; name: string; email: string };
};
