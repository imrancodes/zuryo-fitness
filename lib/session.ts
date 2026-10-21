import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { isRole, type Role } from "@/lib/roles";

export const SESSION_COOKIE = "zuryo_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  role: Role;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long");
  }

  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });

    if (typeof payload.userId !== "string" || !isRole(payload.role)) {
      return null;
    }

    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export async function setSessionCookie(response: NextResponse, user: { id: string; role: Role }) {
  const token = await signSession({ userId: user.id, role: user.role });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
