import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";

const VerifyEmail = () => {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  // Ideally pass email via location.state during redirect
  const email = localStorage.getItem("pendingEmail");

  const handleResend = async () => {
    if (!email) {
      toast.error("Email not found. Please register again.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/user/resend-verification", { email });

      toast.success("Verification email sent again!");
      setCooldown(true);

      // Disable resend for 30 seconds
      setTimeout(() => setCooldown(false), 30000);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to resend email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0F19] flex items-center justify-center px-4">
      {/* Gradient blobs */}
      <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-emerald-500/30 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-cyan-500/30 blur-[120px]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl p-8 text-center space-y-6">
          {/* Title */}
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Check your email
          </h2>

          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed">
            We've sent you an email to verify your account. Please check your
            inbox and click the verification link to continue.
          </p>

          {/* Button */}
          <Button
            onClick={handleResend}
            disabled={loading || cooldown}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resending...
              </>
            ) : cooldown ? (
              "Please wait before resending"
            ) : (
              "Resend verification email"
            )}
          </Button>

          {/* Helper text */}
          <p className="text-xs text-gray-500">
            Didn’t receive the email? Check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
