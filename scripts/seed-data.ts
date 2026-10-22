import { DEMO_ACCOUNTS } from "@/lib/demo";
import type { BookingMode } from "@/lib/booking";
import type { ExperienceLevel, FitnessGoal, PreferredTime, WorkoutType } from "@/lib/fitness";
import type { ServiceZone } from "@/lib/zones";

export const SEED_DAYS = 8;

export const DAILY_WINDOWS = [
  { startTime: "06:00", endTime: "13:00" },
  { startTime: "14:00", endTime: "21:00" },
] as const;

export type SeedTrainer = { name: string; email: string; specialties: string[]; zones: [ServiceZone, ServiceZone] };

export const TRAINERS: SeedTrainer[] = [
  { ...DEMO_ACCOUNTS.trainer, specialties: ["Strength", "Mobility"], zones: ["Mumbai", "Thane"] },
  { name: "Rohan Das", email: "rohan.trainer@zuryo.dev", specialties: ["Yoga", "Flexibility"], zones: ["Thane", "Navi Mumbai"] },
  { name: "Meera Iyer", email: "meera.trainer@zuryo.dev", specialties: ["HIIT", "Weight loss"], zones: ["Delhi", "Mumbai"] },
  { name: "Kabir Singh", email: "kabir.trainer@zuryo.dev", specialties: ["Boxing", "Conditioning"], zones: ["Bengaluru", "Navi Mumbai"] },
  { name: "Ananya Rao", email: "ananya.trainer@zuryo.dev", specialties: ["Pilates", "Core"], zones: ["Bengaluru", "Delhi"] },
  { name: "Vikram Joshi", email: "vikram.trainer@zuryo.dev", specialties: ["Functional", "Endurance"], zones: ["Navi Mumbai", "Thane"] },
];

type SeedProfile = {
  age: number;
  fitnessGoals: FitnessGoal[];
  experienceLevel: ExperienceLevel;
  workoutPreferences: { workoutTypes: WorkoutType[]; preferredTimes: PreferredTime[] };
  assessments: { daysAgo: number; weight: number }[];
};

export type SeedCustomer = {
  name: string;
  email: string;
  profile: SeedProfile | null;
  package: { totalSessions: number; source: "seed" | "admin"; daysAgo: number } | null;
};

export const CUSTOMERS: SeedCustomer[] = [
  {
    ...DEMO_ACCOUNTS.customer,
    profile: {
      age: 32,
      fitnessGoals: ["build_muscle", "general_fitness"],
      experienceLevel: "intermediate",
      workoutPreferences: { workoutTypes: ["strength", "hiit"], preferredTimes: ["morning", "evening"] },
      assessments: [
        { daysAgo: 30, weight: 78.2 },
        { daysAgo: 14, weight: 77.1 },
        { daysAgo: 0, weight: 76.4 },
      ],
    },
    package: { totalSessions: 10, source: "seed", daysAgo: 30 },
  },
  {
    name: "Neha Kapoor",
    email: "neha.customer@zuryo.dev",
    profile: {
      age: 27,
      fitnessGoals: ["lose_weight", "improve_endurance"],
      experienceLevel: "beginner",
      workoutPreferences: { workoutTypes: ["cardio", "yoga"], preferredTimes: ["morning", "afternoon"] },
      assessments: [
        { daysAgo: 20, weight: 68.5 },
        { daysAgo: 4, weight: 67.3 },
      ],
    },
    package: { totalSessions: 2, source: "admin", daysAgo: 20 },
  },
  {
    name: "Arjun Malhotra",
    email: "arjun.customer@zuryo.dev",
    profile: {
      age: 24,
      fitnessGoals: ["sports_performance"],
      experienceLevel: "advanced",
      workoutPreferences: { workoutTypes: ["boxing", "strength"], preferredTimes: ["morning", "evening"] },
      assessments: [{ daysAgo: 12, weight: 72 }],
    },
    package: null,
  },
  { name: "Sana Sheikh", email: "sana.customer@zuryo.dev", profile: null, package: null },
];

export type SeedOutcome =
  | "completed"
  | "upcoming_paid"
  | "upcoming_unpaid"
  | "expired_checkout"
  | "failed_payment"
  | "cancelled"
  | "cancelled_failed"
  | "missed_paid"
  | "missed_unpaid";

export type SeedWorkout = {
  exercises: { name: string; sets?: number; reps?: number; notes?: string }[];
  trainerNotes: string;
  suggestedNextWorkout: string;
  feedback?: { rating: number; comment: string };
};

export type SeedBooking = {
  key: string;
  customer: string;
  trainer: string;
  zone: ServiceZone;
  day: number;
  time: string;
  mode: BookingMode;
  outcome: SeedOutcome;
  workout?: SeedWorkout;
};

const AARAV = DEMO_ACCOUNTS.customer.email;
const NEHA = "neha.customer@zuryo.dev";
const ARJUN = "arjun.customer@zuryo.dev";
const SANA = "sana.customer@zuryo.dev";
const PRIYA = DEMO_ACCOUNTS.trainer.email;
const ROHAN = "rohan.trainer@zuryo.dev";
const MEERA = "meera.trainer@zuryo.dev";
const KABIR = "kabir.trainer@zuryo.dev";
const ANANYA = "ananya.trainer@zuryo.dev";
const VIKRAM = "vikram.trainer@zuryo.dev";

export const BOOKINGS: SeedBooking[] = [
  {
    key: "seed-aarav-1",
    customer: AARAV,
    trainer: PRIYA,
    zone: "Mumbai",
    day: -22,
    time: "07:00",
    mode: "scheduled",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Bench press", sets: 3, reps: 10 },
        { name: "Seated row", sets: 3, reps: 12 },
        { name: "Plank", sets: 3, notes: "30 seconds" },
      ],
      trainerNotes: "First session. Good form on rows; bench press needs a slower lowering phase.",
      suggestedNextWorkout: "Full-body circuit with light dumbbells",
      feedback: { rating: 5, comment: "Very clear coaching and a good pace for a first session." },
    },
  },
  {
    key: "seed-aarav-2",
    customer: AARAV,
    trainer: PRIYA,
    zone: "Mumbai",
    day: -15,
    time: "10:00",
    mode: "scheduled",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Kettlebell swing", sets: 4, reps: 15 },
        { name: "Push-up", sets: 3, reps: 12 },
        { name: "Walking lunge", sets: 3, reps: 10 },
      ],
      trainerNotes: "Strong conditioning work. Keep the hinge on swings and avoid squatting the movement.",
      suggestedNextWorkout: "Lower body strength with goblet squats",
      feedback: { rating: 4, comment: "Great workout, the warm-up felt a little rushed." },
    },
  },
  {
    key: "seed-aarav-3",
    customer: AARAV,
    trainer: PRIYA,
    zone: "Thane",
    day: -8,
    time: "18:00",
    mode: "scheduled",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Goblet squat", sets: 4, reps: 10 },
        { name: "Romanian deadlift", sets: 3, reps: 10 },
        { name: "Glute bridge", sets: 3, reps: 15 },
      ],
      trainerNotes: "Squat depth is improving. Brace before each rep on the deadlifts.",
      suggestedNextWorkout: "Upper body push and pull with core finisher",
    },
  },
  {
    key: "seed-aarav-4",
    customer: AARAV,
    trainer: PRIYA,
    zone: "Mumbai",
    day: -1,
    time: "10:00",
    mode: "scheduled",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Dumbbell shoulder press", sets: 3, reps: 10 },
        { name: "Lat pulldown", sets: 3, reps: 12 },
        { name: "Push-up", sets: 3, reps: 10, notes: "Knees down for the last set" },
        { name: "Dead bug", sets: 3, reps: 12 },
      ],
      trainerNotes: "Good energy today. Shoulder press is steady; keep the ribs down.",
      suggestedNextWorkout: "Lower body strength with lunges and Romanian deadlifts",
    },
  },
  {
    key: "seed-neha-1",
    customer: NEHA,
    trainer: MEERA,
    zone: "Delhi",
    day: -12,
    time: "08:00",
    mode: "scheduled",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Brisk walk intervals", notes: "6 rounds of 2 minutes fast, 1 minute easy" },
        { name: "Bodyweight squat", sets: 2, reps: 12 },
        { name: "Wall push-up", sets: 2, reps: 10 },
      ],
      trainerNotes: "Great start. Kept the intensity light; breathing recovered quickly between intervals.",
      suggestedNextWorkout: "Low-impact cardio circuit",
      feedback: { rating: 5, comment: "Meera made it feel easy to get started again." },
    },
  },
  {
    key: "seed-neha-2",
    customer: NEHA,
    trainer: MEERA,
    zone: "Mumbai",
    day: -5,
    time: "16:30",
    mode: "scheduled",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Step-up", sets: 3, reps: 10 },
        { name: "Mountain climber", sets: 3, notes: "20 seconds" },
        { name: "Cat-cow stretch", sets: 2, reps: 8 },
      ],
      trainerNotes: "Handled more volume than last time. Keep sessions low impact for another week.",
      suggestedNextWorkout: "Yoga flow for mobility and recovery",
    },
  },
  {
    key: "seed-arjun-1",
    customer: ARJUN,
    trainer: KABIR,
    zone: "Navi Mumbai",
    day: -10,
    time: "17:30",
    mode: "scheduled",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Shadow boxing", sets: 4, notes: "3-minute rounds" },
        { name: "Heavy bag combinations", sets: 5, notes: "2-minute rounds" },
        { name: "Medicine ball slam", sets: 3, reps: 12 },
      ],
      trainerNotes: "Sharp footwork. Drop the guard less on the right cross.",
      suggestedNextWorkout: "Strength day: trap-bar deadlift and pull-ups",
    },
  },
  {
    key: "seed-arjun-2",
    customer: ARJUN,
    trainer: KABIR,
    zone: "Bengaluru",
    day: -3,
    time: "07:30",
    mode: "instant",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Trap-bar deadlift", sets: 4, reps: 6 },
        { name: "Pull-up", sets: 4, reps: 8 },
        { name: "Farmer carry", sets: 3, notes: "30 metres" },
      ],
      trainerNotes: "Solid strength session with good bar speed. Two reps in reserve on every set.",
      suggestedNextWorkout: "Conditioning intervals on the bag",
      feedback: { rating: 4, comment: "Good session, booked at short notice and Kabir was on time." },
    },
  },
  {
    key: "seed-sana-1",
    customer: SANA,
    trainer: ROHAN,
    zone: "Navi Mumbai",
    day: -6,
    time: "15:00",
    mode: "instant",
    outcome: "completed",
    workout: {
      exercises: [
        { name: "Sun salutation", sets: 3, notes: "Slow pace" },
        { name: "Warrior II hold", sets: 2, notes: "30 seconds each side" },
        { name: "Seated forward fold", sets: 2, notes: "45 seconds" },
      ],
      trainerNotes: "Good flexibility through the hips. Encouraged completing the fitness profile for better plans.",
      suggestedNextWorkout: "Gentle mobility flow",
    },
  },
  { key: "seed-aarav-cancelled", customer: AARAV, trainer: ROHAN, zone: "Thane", day: -4, time: "11:00", mode: "scheduled", outcome: "cancelled" },
  { key: "seed-sana-cancelled", customer: SANA, trainer: MEERA, zone: "Mumbai", day: -9, time: "14:00", mode: "scheduled", outcome: "cancelled_failed" },
  { key: "seed-neha-missed", customer: NEHA, trainer: ANANYA, zone: "Bengaluru", day: -2, time: "09:00", mode: "scheduled", outcome: "missed_paid" },
  { key: "seed-arjun-missed", customer: ARJUN, trainer: VIKRAM, zone: "Thane", day: -2, time: "19:00", mode: "scheduled", outcome: "missed_unpaid" },
  { key: "seed-aarav-next", customer: AARAV, trainer: PRIYA, zone: "Mumbai", day: 1, time: "07:00", mode: "scheduled", outcome: "upcoming_paid" },
  { key: "seed-aarav-expired", customer: AARAV, trainer: PRIYA, zone: "Thane", day: 3, time: "18:00", mode: "scheduled", outcome: "expired_checkout" },
  { key: "seed-aarav-delhi", customer: AARAV, trainer: MEERA, zone: "Delhi", day: 5, time: "08:00", mode: "scheduled", outcome: "upcoming_paid" },
  { key: "seed-neha-failed", customer: NEHA, trainer: MEERA, zone: "Mumbai", day: 2, time: "17:00", mode: "scheduled", outcome: "failed_payment" },
  { key: "seed-neha-pilates", customer: NEHA, trainer: ANANYA, zone: "Bengaluru", day: 4, time: "09:30", mode: "scheduled", outcome: "upcoming_paid" },
  { key: "seed-neha-thane", customer: NEHA, trainer: VIKRAM, zone: "Thane", day: 5, time: "16:00", mode: "scheduled", outcome: "upcoming_paid" },
  { key: "seed-arjun-next", customer: ARJUN, trainer: KABIR, zone: "Bengaluru", day: 1, time: "06:30", mode: "scheduled", outcome: "upcoming_paid" },
  { key: "seed-arjun-unpaid", customer: ARJUN, trainer: KABIR, zone: "Navi Mumbai", day: 6, time: "19:00", mode: "scheduled", outcome: "upcoming_unpaid" },
  { key: "seed-arjun-core", customer: ARJUN, trainer: ANANYA, zone: "Delhi", day: 2, time: "15:00", mode: "scheduled", outcome: "upcoming_paid" },
  { key: "seed-sana-yoga", customer: SANA, trainer: ROHAN, zone: "Thane", day: 2, time: "11:00", mode: "scheduled", outcome: "upcoming_paid" },
  { key: "seed-sana-unpaid", customer: SANA, trainer: VIKRAM, zone: "Navi Mumbai", day: 3, time: "08:30", mode: "scheduled", outcome: "upcoming_unpaid" },
  { key: "seed-sana-priya", customer: SANA, trainer: PRIYA, zone: "Thane", day: 1, time: "18:00", mode: "scheduled", outcome: "upcoming_paid" },
];
