import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import AuthLayout from "@/components/AuthLayout";

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
    <AuthLayout>
      {/* Icon */}
      <div className="mx-auto w-fit rounded-full p-3 bg-emerald-500/10">
        <Mail className="h-8 w-8 text-emerald-400" />
      </div>

      {/* Glass Card */}
      <div className="w-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl p-8 text-center space-y-6">
        <h2 className="text-2xl font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Check your email
        </h2>

        <p className="text-gray-300 text-sm leading-relaxed">
          We’ve sent you an email to verify your account. Please check your
          inbox and click the verification link to continue.
        </p>

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

        <p className="text-xs text-gray-500">
          Didn’t receive the email? Check your spam folder.
        </p>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
