import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import api from "@/lib/axios";
import { CheckCircle, Loader2, RotateCcw } from "lucide-react";
import React, { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";

const VerifyOTP = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef([]);
  const { email } = useParams();
  const navigate = useNavigate();

  const handleChange = (index, value) => {
    if (value.length > 1) return;
    const updatedOtp = [...otp];
    updatedOtp[index] = value;
    setOtp(updatedOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const digits = pastedData.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const finalOtp = otp.join("");
    if (finalOtp.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.post(`/user/verify-otp/${email}`, {
        otp: finalOtp,
      });
      setSuccessMessage(res.data.message);
      setIsVerified(true);
      setTimeout(() => {
        navigate(`/change-password/${email}`);
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const clearOtp = () => {
    setOtp(["", "", "", "", "", ""]);
    setError("");
    inputRefs.current[0]?.focus();
  };

  return (
    <AuthLayout>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Verify your email
        </h1>
        <p className="text-gray-400 text-sm">
          We've sent a 6-digit verification code to{" "}
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      {/* Glass Card */}
      <Card className="w-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Enter verification code
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {isVerified
              ? "Code verified successfully! Redirecting..."
              : "Enter the 6-digit code sent to your email"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert className="bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <p className="text-emerald-400 text-sm text-center">
              {successMessage}
            </p>
          )}

          {isVerified ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="bg-emerald-500/10 rounded-full p-3">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-lg text-white">
                  Verification successful
                </h3>
                <p className="text-gray-400 text-sm">
                  Your email has been verified. You'll be redirected to reset
                  your password.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                <span className="text-sm text-gray-400">Redirecting...</span>
              </div>
            </div>
          ) : (
            <>
              {/* OTP Input */}
              <div className="flex justify-between gap-2">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    maxLength={1}
                    ref={(el) => (inputRefs.current[index] = el)}
                    className="w-12 h-12 text-center text-xl font-bold bg-white/5 border-white/10 text-white focus:border-emerald-400"
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleVerify}
                  disabled={isLoading || otp.some((digit) => digit === "")}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify code"
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={clearOtp}
                  className="w-full rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
                  disabled={isLoading || isVerified}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-400">
            Wrong email?{" "}
            <Link
              to="/forgot-password"
              className="text-emerald-400 hover:underline font-medium"
            >
              Go back
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
};

export default VerifyOTP;
