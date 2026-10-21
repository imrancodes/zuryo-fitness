import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

const fitnessProfileSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    age: { type: Number, min: 13, max: 100 },
    weight: { type: Number, min: 20, max: 300 },
    fitnessGoals: { type: [String], default: [] },
    experienceLevel: { type: String, enum: EXPERIENCE_LEVELS, default: "beginner" },
    workoutPreferences: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type FitnessProfileDocument = InferSchemaType<typeof fitnessProfileSchema>;

export const FitnessProfile: Model<FitnessProfileDocument> =
  models.FitnessProfile ?? model("FitnessProfile", fitnessProfileSchema);
