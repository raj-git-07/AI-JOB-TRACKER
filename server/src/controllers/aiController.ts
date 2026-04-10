import { Request, Response } from "express";
import { parseJobDescriptionWithAI } from "../services/aiService";

export const parseJobDescription = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { jobDescription } = req.body;

    if (!jobDescription || !jobDescription.trim()) {
      res.status(400).json({ message: "Job description is required" });
      return;
    }

    const parsedData = await parseJobDescriptionWithAI(jobDescription);

    res.status(200).json({
      message: "Job description parsed successfully",
      data: parsedData,
    });
  } catch (error: any) {
    console.error("AI parse error:", error.message);
    res.status(500).json({
      message: error.message || "Failed to parse job description",
    });
  }
};