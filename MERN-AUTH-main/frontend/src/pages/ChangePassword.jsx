import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/axios";
import { Loader2, Lock } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const ChangePassword = () => {
  const { email } = useParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.post(`/user/change-password/${email}`, {
        newPassword,
        confirmPassword,
      });

      setSuccess(res.data.message);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <AuthLayout>
      {/* Icon */}
      <div className="mx-auto w-fit rounded-full p-3 bg-emerald-500/10">
        <Lock className="h-8 w-8 text-emerald-400" />
      </div>

      {/* Glass Card */}
      <div className="w-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl p-6 space-y-4">
        {/* Title */}
        <h2 className="text-2xl font-semibold text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Change Password
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-gray-400 text-center">
          Set a new password for{" "}
          <span className="text-white font-medium">{email}</span>
        </p>

          {/* Error / Success */}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          {success && (
            <p className="text-emerald-400 text-sm text-center">{success}</p>
          )}

          {/* Inputs */}
          <div className="space-y-4 pt-2">
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-400"
            />

            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-400"
            />

            {/* Button */}
            <Button
              disabled={isLoading}
              onClick={handleChangePassword}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing password...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ChangePassword;
