import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Define the user schema with fields for email, password, and name
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true, // Email must be provided
      unique: true, // Prevent duplicate accounts
      lowercase: true, // Normalize email casing
      trim: true, // Remove surrounding whitespace
    },
    password: {
      type: String,
      required: true,
      minlength: 6, // Basic password length requirement
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: "user",
    },
  },
  { timestamps: true } // Automatically manages createdAt / updatedAt
);

// Pre-save hook to hash password before storing in DB
userSchema.pre("save", async function (next) {
  // Only hash the password if it was modified or is new
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10); // Generate salt with cost factor 10
  this.password = await bcrypt.hash(this.password, salt); // Store hashed password
  next();
});

// Instance method to compare a plain-text password with the hashed one
userSchema.methods.comparePassword = function (candidate) {
  // Returns a promise that resolves to true/false
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", userSchema);
