import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import authRoutes from "./routes/authRoutes";
import applicationRoutes from "./routes/applicationRoutes";
import aiRoutes from "./routes/aiRoutes";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Job Tracker Backend Ready");
});

app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});