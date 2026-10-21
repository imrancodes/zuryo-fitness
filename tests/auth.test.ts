import { describe, expect, test } from "bun:test";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { PASSWORD, createUser, makeRequest, sessionFrom } from "./helpers";

const registration = (email: string, role = "customer") =>
  makeRequest("/api/auth/register", {
    method: "POST",
    body: { name: "Riya Sharma", email, password: PASSWORD, role },
  });

describe("registration", () => {
  test("creates a user, sets a session and hides the password hash", async () => {
    const response = await register(registration("Riya@Example.com"));
    const text = await response.text();

    expect(response.status).toBe(201);
    expect(text).not.toContain("passwordHash");
    expect(JSON.parse(text).user).toMatchObject({ email: "riya@example.com", role: "customer" });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  test("rejects a duplicate email regardless of case", async () => {
    await register(registration("dupe@example.com"));
    const response = await register(registration("DUPE@example.com"));

    expect(response.status).toBe(409);
  });

  test("does not allow registering as admin", async () => {
    const response = await register(registration("sneaky@example.com", "admin"));

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("login", () => {
  test("returns the same generic error for a wrong password and an unknown email", async () => {
    const email = await createUser("customer");
    const wrongPassword = await login(makeRequest("/api/auth/login", { method: "POST", body: { email, password: "nope-nope" } }));
    const unknownEmail = await login(makeRequest("/api/auth/login", { method: "POST", body: { email: "ghost@example.com", password: PASSWORD } }));

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
  });

  test("rejects malformed input", async () => {
    const response = await login(makeRequest("/api/auth/login", { method: "POST", body: { email: "not-an-email" } }));

    expect(response.status).toBe(400);
  });

  test("signs in and ignores an unsafe redirect target", async () => {
    const email = await createUser("trainer");
    const response = await login(
      makeRequest("/api/auth/login", { method: "POST", body: { email, password: PASSWORD, next: "//evil.com" } })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redirectTo).toBe("/trainer");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(sessionFrom(response)).not.toBe("");
  });
});

describe("current user", () => {
  test("returns 401 without a session", async () => {
    const response = await me(makeRequest("/api/auth/me"));

    expect(response.status).toBe(401);
  });

  test("returns only the safe public profile", async () => {
    const email = await createUser("customer");
    const session = sessionFrom(await login(makeRequest("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } })));
    const response = await me(makeRequest("/api/auth/me", { session }));
    const { user } = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(user).sort()).toEqual(["avatarUrl", "email", "id", "name", "role"]);
  });

  test("logout clears the session cookie", async () => {
    const response = await logout();

    expect(response.headers.get("set-cookie")).toMatch(/zuryo_session=;.*Max-Age=0/i);
  });
});
