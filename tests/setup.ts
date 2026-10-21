import { afterAll, mock } from "bun:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

mock.module("server-only", () => ({}));

const nextServer = await import("next/server");
mock.module("next/server", () => ({ ...nextServer, connection: async () => {} }));

const mongo = await MongoMemoryServer.create();

process.env.MONGODB_URI = mongo.getUri("zuryo-test");
process.env.SESSION_SECRET = "test-only-secret-with-at-least-32-characters";

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
