import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    user: {
      // redundant but useful for querying fast
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const Chat = mongoose.model("Chat", chatSchema);
