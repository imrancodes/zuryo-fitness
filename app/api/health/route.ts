import { connection } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  await connection();

  try {
    const db = await connectToDatabase();
    await db.connection.db?.admin().ping();
    return Response.json({ status: "ok", database: "connected" });
  } catch {
    return Response.json(
      { status: "error", message: "Database connection failed" },
      { status: 500 }
    );
  }
}
