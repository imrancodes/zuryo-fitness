import "server-only";
import type { ClientSession, Types } from "mongoose";
import { ServiceError } from "@/lib/errors";
import { connectToDatabase } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Package, type PackageRecord } from "@/models/Package";
import { PackageDeduction, type PackageDeductionRecord } from "@/models/PackageDeduction";
import { User } from "@/models/User";
import type { AdminPackageView, DeductionView, PackageSummary, PackageView } from "@/types/package";
import type { GrantPackageInput } from "@/validators/package";

type CreditInput = {
  bookingId: Types.ObjectId;
  sessionRecordId: Types.ObjectId;
  customerId: Types.ObjectId;
};

function toPackageView(item: PackageRecord): PackageView {
  return {
    id: item._id.toString(),
    totalSessions: item.totalSessions,
    usedSessions: item.usedSessions,
    remainingSessions: item.remainingSessions,
    status: item.status as PackageView["status"],
    source: item.source as PackageView["source"],
    createdAt: (item.createdAt ?? new Date()).toISOString(),
  };
}

export async function consumeSessionCredit({ bookingId, sessionRecordId, customerId }: CreditInput, session: ClientSession) {
  const existing = await PackageDeduction.findOne({ bookingId }).session(session).lean<PackageDeductionRecord>();
  if (existing) {
    return existing.outcome;
  }

  const candidate = await Package.findOne({ customerId, status: "active", remainingSessions: { $gte: 1 } })
    .sort({ createdAt: 1 })
    .session(session)
    .lean<PackageRecord>();

  const consumed = candidate
    ? await Package.findOneAndUpdate(
        { _id: candidate._id, status: "active", remainingSessions: { $gte: 1 } },
        { $inc: { usedSessions: 1, remainingSessions: -1 } },
        { new: true, session }
      ).lean<PackageRecord>()
    : null;

  if (consumed?.remainingSessions === 0) {
    await Package.updateOne({ _id: consumed._id, remainingSessions: 0 }, { $set: { status: "exhausted" } }, { session });
  }

  const outcome = consumed ? "deducted" : "no_package";
  await PackageDeduction.create([{ bookingId, sessionRecordId, customerId, packageId: consumed?._id ?? null, outcome }], { session });
  return outcome;
}

export async function getPackageSummary(customerId: string): Promise<PackageSummary> {
  await connectToDatabase();
  const packages = await Package.find({ customerId, status: { $in: ["active", "exhausted"] } }).lean<PackageRecord[]>();

  return packages.reduce(
    (summary, item) => ({
      purchased: summary.purchased + item.totalSessions,
      used: summary.used + item.usedSessions,
      remaining: summary.remaining + (item.status === "active" ? item.remainingSessions : 0),
      activePackages: summary.activePackages + (item.status === "active" ? 1 : 0),
    }),
    { purchased: 0, used: 0, remaining: 0, activePackages: 0 }
  );
}

export async function listPackages(customerId: string) {
  await connectToDatabase();
  const [packages, deductions] = await Promise.all([
    Package.find({ customerId }).sort({ createdAt: -1 }).lean<PackageRecord[]>(),
    PackageDeduction.find({ customerId }).sort({ createdAt: -1 }).limit(20).lean<PackageDeductionRecord[]>(),
  ]);
  const bookings = await Booking.find({ _id: { $in: deductions.map((entry) => entry.bookingId) } }, "startTime").lean();
  const sessionDate = new Map(bookings.map((booking) => [booking._id.toString(), booking.startTime.toISOString()]));

  return {
    packages: packages.map(toPackageView),
    deductions: deductions.map(
      (entry): DeductionView => ({
        id: entry._id.toString(),
        bookingId: entry.bookingId.toString(),
        outcome: entry.outcome as DeductionView["outcome"],
        sessionDate: sessionDate.get(entry.bookingId.toString()) ?? null,
        createdAt: (entry.createdAt ?? new Date()).toISOString(),
      })
    ),
  };
}

export async function grantPackage(input: GrantPackageInput, adminId: string) {
  await connectToDatabase();
  const customer = await User.findOne({ email: input.email, role: "customer", isActive: true }).lean();

  if (!customer) {
    throw new ServiceError(404, "No active customer account uses this email.");
  }

  const created = await Package.create({ customerId: customer._id, totalSessions: input.sessions, source: "admin", grantedBy: adminId });
  return toPackageView(created.toObject() as PackageRecord);
}

export async function listRecentPackages(): Promise<AdminPackageView[]> {
  await connectToDatabase();
  const packages = await Package.find().sort({ createdAt: -1 }).limit(20).lean<PackageRecord[]>();
  const customers = await User.find({ _id: { $in: packages.map((item) => item.customerId) } }, "name email").lean();
  const byId = new Map(customers.map((customer) => [customer._id.toString(), customer]));

  return packages.map((item) => {
    const customer = byId.get(item.customerId.toString());
    return {
      ...toPackageView(item),
      customer: { id: item.customerId.toString(), name: customer?.name ?? "Unknown", email: customer?.email ?? "" },
    };
  });
}
