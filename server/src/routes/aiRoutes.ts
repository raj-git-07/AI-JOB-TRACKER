import express from "express";
import { parseJobDescription } from "../controllers/aiController";
import protect from "../middleware/authMiddleware";

const router = express.Router();

router.post("/parse-jd", protect, parseJobDescription);

export default router;