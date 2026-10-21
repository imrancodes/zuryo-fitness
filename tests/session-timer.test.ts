import { describe, expect, test } from "bun:test";
import {
  clockOffset,
  correctedNow,
  deriveSessionStatus,
  isRecordEditable,
  remainingSeconds,
  sessionEndsAt,
  startWindowError,
  timerPhase,
} from "@/lib/session-timer";
import { addMinutes } from "@/lib/time";

const startedAt = new Date("2026-10-26T04:30:00.000Z");
const endsAt = sessionEndsAt(startedAt);
const at = (minutes: number, seconds = 0) => new Date(startedAt.getTime() + minutes * 60_000 + seconds * 1000);

describe("session timer", () => {
  test("ends exactly 60 minutes after the start", () => {
    expect(endsAt.getTime() - startedAt.getTime()).toBe(60 * 60_000);
  });

  test("counts down from the persisted end time and never goes below zero", () => {
    expect(remainingSeconds(endsAt, at(0))).toBe(3600);
    expect(remainingSeconds(endsAt, at(59, 30))).toBe(30);
    expect(remainingSeconds(endsAt, at(75))).toBe(0);
  });

  test("the five-minute warning starts at exactly 55 minutes", () => {
    expect(timerPhase(remainingSeconds(endsAt, at(54, 59)))).toBe("running");
    expect(timerPhase(remainingSeconds(endsAt, at(55)))).toBe("warning");
    expect(timerPhase(remainingSeconds(endsAt, at(59, 59)))).toBe("warning");
    expect(timerPhase(remainingSeconds(endsAt, at(60)))).toBe("ended");
  });

  test("a wrong device clock does not change the remaining time", () => {
    const serverNow = at(20);
    const honestClient = serverNow.getTime();
    const fastClient = honestClient + 2 * 60 * 60_000;
    const slowClient = honestClient - 2 * 60 * 60_000;

    for (const clientNow of [honestClient, fastClient, slowClient]) {
      const offset = clockOffset(serverNow, clientNow);
      expect(remainingSeconds(endsAt, correctedNow(offset, clientNow + 10_000))).toBe(40 * 60 - 10);
    }
  });
});

describe("start window and status", () => {
  const scheduled = new Date("2026-10-26T04:30:00.000Z");

  test("opens 15 minutes before and closes 30 minutes after the scheduled start", () => {
    expect(startWindowError(scheduled, addMinutes(scheduled, -16))).toContain("can be started from");
    expect(startWindowError(scheduled, addMinutes(scheduled, -15))).toBeNull();
    expect(startWindowError(scheduled, addMinutes(scheduled, 30))).toBeNull();
    expect(startWindowError(scheduled, addMinutes(scheduled, 31))).toContain("closed");
  });

  test("derives every lifecycle status from persisted data", () => {
    const running = { status: "in_progress", endsAt: addMinutes(scheduled, 60) };

    expect(deriveSessionStatus("confirmed", null, scheduled, scheduled)).toBe("scheduled");
    expect(deriveSessionStatus("confirmed", null, scheduled, addMinutes(scheduled, 31))).toBe("missed");
    expect(deriveSessionStatus("cancelled", null, scheduled, scheduled)).toBe("cancelled");
    expect(deriveSessionStatus("confirmed", running, scheduled, addMinutes(scheduled, 59))).toBe("in_progress");
    expect(deriveSessionStatus("confirmed", running, scheduled, addMinutes(scheduled, 60))).toBe("completed");
  });

  test("workout notes stay editable for 24 hours after completion", () => {
    const completed = { status: "completed", endsAt, completedAt: endsAt };

    expect(isRecordEditable({ status: "in_progress", endsAt }, at(30))).toBe(true);
    expect(isRecordEditable(completed, addMinutes(endsAt, 24 * 60))).toBe(true);
    expect(isRecordEditable(completed, addMinutes(endsAt, 24 * 60 + 1))).toBe(false);
  });
});
