import { expect, test } from "bun:test";
import { GET as health } from "@/app/api/health/route";

test("health check pings the real database", async () => {
  const response = await health();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "connected" });
});
