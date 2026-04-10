import Groq from "groq-sdk";

export interface ParsedJobData {
  company: string;
  role: string;
  skillsRequired: string[];
  skillsOptional: string[];
  seniority: string;
  location: string;
  resumePoints: string[];
}

export const parseJobDescriptionWithAI = async (
  jobDescription: string
): Promise<ParsedJobData> => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in .env file");
  }

  const groq = new Groq({
    apiKey,
  });

  const prompt = `
You are an AI assistant that extracts structured job information from a job description.

Return ONLY valid JSON in this exact format:
{
  "company": "",
  "role": "",
  "skillsRequired": [],
  "skillsOptional": [],
  "seniority": "",
  "location": "",
  "resumePoints": []
}

Rules:
- company: extract company name if present, otherwise "Unknown"
- role: short clear job title
- skillsRequired: must-have skills only
- skillsOptional: good-to-have or bonus skills
- seniority: one of "intern", "junior", "mid", "senior", "lead", "not specified"
- location: extract location if present, otherwise "Not specified"
- resumePoints: generate 3 to 5 short strong resume bullet points matching the role
- Do not include markdown
- Do not include explanation
- Return JSON only

Job Description:
${jobDescription}
`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response received from Groq");
  }

  try {
    return JSON.parse(content) as ParsedJobData;
  } catch (error) {
    console.error("Groq raw response:", content);
    throw new Error("Failed to parse Groq response as JSON");
  }
};