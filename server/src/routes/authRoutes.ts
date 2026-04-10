import express from "express";
import { loginUser, registerUser } from "../controllers/authController";
import protect from "../middleware/authMiddleware";

const router = express.Router();

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

router.get("/me", protect, (req, res) => {
  res.status(200).json({
    message: "Protected route accessed successfully",
  });
});

export default router;