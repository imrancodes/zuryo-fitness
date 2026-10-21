import { afterAll, mock } from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

mock.module("server-only", () => ({}));

const nextServer = await import("next/server");
mock.module("next/server", () => ({ ...nextServer, connection: async () => {} }));

const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });

process.env.MONGODB_URI = mongo.getUri("zuryo-test");
process.env.SESSION_SECRET = "test-only-secret-with-at-least-32-characters";
process.env.GEMINI_API_KEY = "";

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
