import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const aiRecommendationSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    recommendation: { type: Schema.Types.Mixed, default: null },
    inputHash: { type: String, default: null },
    model: { type: String, default: null },
    promptVersion: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    regenerations: { type: [Date], default: [] },
    lastFailureAt: { type: Date, default: null },
    lastFailureKind: { type: String, default: null },
  },
  { timestamps: true }
);

export type AiRecommendationDocument = InferSchemaType<typeof aiRecommendationSchema>;
export type AiRecommendationRecord = Omit<AiRecommendationDocument, "regenerations"> & {
  _id: Types.ObjectId;
  regenerations: Date[];
};

export const AiRecommendationCache: Model<AiRecommendationDocument> =
  models.AiRecommendation ?? model("AiRecommendation", aiRecommendationSchema);
