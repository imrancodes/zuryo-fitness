import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";

export async function runTransaction<T>(work: (session: ClientSession) => Promise<T>) {
  await connectToDatabase();
  return mongoose.connection.transaction(work);
}
