import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const SESSION_RECORD_STATUSES = ["in_progress", "completed"] as const;

const exerciseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sets: { type: Number, min: 0 },
    reps: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const sessionRecordSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: SESSION_RECORD_STATUSES, default: "in_progress" },
    startedAt: { type: Date },
    endsAt: { type: Date },
    completedAt: { type: Date },
    exercises: { type: [exerciseSchema], default: [] },
    durationMinutes: { type: Number, min: 0 },
    trainerNotes: { type: String, trim: true },
    customerFeedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true },
    },
    suggestedNextWorkout: { type: String, trim: true },
  },
  { timestamps: true }
);

sessionRecordSchema.index({ customerId: 1, startedAt: -1 });
sessionRecordSchema.index({ trainerId: 1, startedAt: -1 });
sessionRecordSchema.index({ trainerId: 1, status: 1 });
sessionRecordSchema.index({ customerId: 1, status: 1, completedAt: -1 });

export type SessionRecordDocument = InferSchemaType<typeof sessionRecordSchema>;
export type SessionRecordRecord = SessionRecordDocument & { _id: Types.ObjectId };

export const SessionRecord: Model<SessionRecordDocument> =
  models.SessionRecord ?? model("SessionRecord", sessionRecordSchema);
