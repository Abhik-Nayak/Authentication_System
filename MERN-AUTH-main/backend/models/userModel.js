import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String },
    avatar: { type: String },
    isVerified: { type: Boolean, default: false },
    isLoggedIn: { type: Boolean, default: false },
    token: { type: String, default: null },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    // 🔐 2FA fields
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String }, // encrypted base32
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
