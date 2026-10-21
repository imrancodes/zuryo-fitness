import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const trainerAvailabilitySchema = new Schema(
  {
    trainerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    startTime: { type: Date, required: true },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator(this: { startTime: Date }, value: Date) {
          return value > this.startTime;
        },
        message: "endTime must be after startTime",
      },
    },
    serviceZone: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

trainerAvailabilitySchema.index({ trainerId: 1, startTime: 1, endTime: 1 });
trainerAvailabilitySchema.index({ serviceZone: 1, date: 1, isAvailable: 1 });

export type TrainerAvailabilityDocument = InferSchemaType<typeof trainerAvailabilitySchema>;

export const TrainerAvailability: Model<TrainerAvailabilityDocument> =
  models.TrainerAvailability ?? model("TrainerAvailability", trainerAvailabilitySchema);
