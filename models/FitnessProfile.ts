import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { AGE_RANGE, EXPERIENCE_LEVELS, FITNESS_GOALS, PREFERRED_TIMES, WEIGHT_RANGE_KG, WORKOUT_TYPES } from "@/lib/fitness";

export const fitnessFields = {
  age: { type: Number, required: true, min: AGE_RANGE.min, max: AGE_RANGE.max },
  weight: { type: Number, required: true, min: WEIGHT_RANGE_KG.min, max: WEIGHT_RANGE_KG.max },
  fitnessGoals: { type: [{ type: String, enum: FITNESS_GOALS }], default: [] },
  experienceLevel: { type: String, enum: EXPERIENCE_LEVELS, required: true },
};

const fitnessProfileSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    ...fitnessFields,
    workoutPreferences: {
      workoutTypes: { type: [{ type: String, enum: WORKOUT_TYPES }], default: [] },
      preferredTimes: { type: [{ type: String, enum: PREFERRED_TIMES }], default: [] },
    },
  },
  { timestamps: true }
);

export type FitnessProfileDocument = InferSchemaType<typeof fitnessProfileSchema>;
export type FitnessProfileRecord = FitnessProfileDocument & { _id: Types.ObjectId; updatedAt?: Date };

export const FitnessProfile: Model<FitnessProfileDocument> =
  models.FitnessProfile ?? model("FitnessProfile", fitnessProfileSchema);
