import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { fitnessFields } from "@/models/FitnessProfile";

const fitnessAssessmentSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...fitnessFields,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

fitnessAssessmentSchema.index({ customerId: 1, createdAt: -1 });

export type FitnessAssessmentDocument = InferSchemaType<typeof fitnessAssessmentSchema>;

export const FitnessAssessment: Model<FitnessAssessmentDocument> =
  models.FitnessAssessment ?? model("FitnessAssessment", fitnessAssessmentSchema);
