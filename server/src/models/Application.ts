import mongoose, { Document, Schema } from "mongoose";

export interface IApplication extends Document {
  user: mongoose.Types.ObjectId;
  company: string;
  role: string;
  jdLink?: string;
  notes?: string;
  dateApplied: Date;
  followUpDate?: Date;
  status:
    | "applied"
    | "interviewing"
    | "offered"
    | "rejected"
    | "accepted"
    | "Applied"
    | "Phone Screen"
    | "Interview"
    | "Offer"
    | "Rejected";
  salary?: string;
}

const applicationSchema = new Schema<IApplication>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    jdLink: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    dateApplied: {
      type: Date,
      required: true,
      default: Date.now,
    },
    followUpDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: [
        "applied",
        "interviewing",
        "offered",
        "rejected",
        "accepted",
        "Applied",
        "Phone Screen",
        "Interview",
        "Offer",
        "Rejected",
      ],
      default: "Applied",
    },
    salary: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Application = mongoose.model<IApplication>("Application", applicationSchema);

export default Application;