import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import mongoSanitize from "express-mongo-sanitize";
import { User } from "../models/User.js";
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

/* ===== APPLY SANITIZE MIDDLEWARE ===== */
router.use(
  mongoSanitize({
    replaceWith: "_",
  })
);

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

/* ===== ZOD SCHEMAS ===== */
const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  name: z.string().min(1, { message: "Name is required" }),
});

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

/* ===== ZOD VALIDATION MIDDLEWARE ===== */
const formatZodErrors = (zodErr) =>
  zodErr.errors.map((e) => ({
    path: e.path.join("."),
    message: e.message,
  }));

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: formatZodErrors(result.error) });
  }
  req.body = result.data; // sanitized + validated
  next();
};

/* ===== ROUTES ===== */

router.post("/register", validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Create user but not verified yet
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const user = await User.create({
      email,
      password,
      name,
      verifyToken,
      verifyTokenExpires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;

    await sendEmail({
      to: email,
      subject: "Verify your Auth System Account",
      html: `
        <h1>Email Verification</h1>
        <p>Click the link below to verify:</p>
        <a href="${verifyUrl}" target="_blank">Verify Email</a>
      `,
    });

    res.json({
      message: "Registration successful. Please verify your email.",
    });
    // res.json({
    //   user: {
    //     id: user._id,
    //     email: user.email,
    //     name: user.name,
    //   },
    // });
  } catch (err) {
    console.log("Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// Add Email Verification Route
router.get("/verify-email/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const user = await User.findOne({
      verifyToken: token,
      verifyTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification token" });
    }

    user.verified = true;
    user.verifyToken = undefined;
    user.verifyTokenExpires = undefined;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.log("Verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (!user.verified) {
      return res.status(400).json({ error: "Please verify your email first." });
    }

    const token = createToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
