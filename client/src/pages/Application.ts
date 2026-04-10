import mongoose, { Document, Schema } from "mongoose";

export interface IApplication extends Document {
  user: mongoose.Types.ObjectId;
  company: string;
  role: string;
  jdLink?: string;
  notes?: string;
  dateApplied: Date;
  status: string;
  salary?: number;
}

const applicationSchema = new Schema<IApplication>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    company: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    jdLink: {
      type: String,
    },
    notes: {
      type: String,
    },
    dateApplied: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Applied", "Phone Screen", "Interview", "Offer", "Rejected"],
      default: "Applied",
    },
    salary: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const Application = mongoose.model<IApplication>("Application", applicationSchema);

export default Application;