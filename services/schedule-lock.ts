import "server-only";
import type { ClientSession } from "mongoose";
import { ServiceError } from "@/lib/errors";
import { runTransaction } from "@/lib/transaction";
import { User } from "@/models/User";

/*
 * Serializes every change to one trainer's schedule.
 * The transaction first increments `scheduleVersion` on the trainer's own document.
 * Two concurrent transactions for the same trainer therefore write the same document:
 * MongoDB aborts all but one with a WriteConflict and Mongoose retries them. A retried
 * transaction reads the newly committed bookings, so the overlap checks done in `work`
 * cannot race. Throwing inside `work` aborts the transaction and nothing is persisted.
 */
export async function withTrainerLock<T>(trainerId: string, work: (session: ClientSession) => Promise<T>) {
  return runTransaction(async (session) => {
    const locked = await User.updateOne(
      { _id: trainerId, role: "trainer", isActive: true },
      { $inc: { scheduleVersion: 1 } },
      { session }
    );

    if (locked.matchedCount === 0) {
      throw new ServiceError(409, "This trainer is not available");
    }

    return work(session);
  });
}
