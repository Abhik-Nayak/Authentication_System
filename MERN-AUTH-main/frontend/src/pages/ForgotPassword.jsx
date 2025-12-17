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
import { Label } from "@/components/ui/label";
import { getData } from "@/context/userContext";
import api from "@/lib/axios";
import axios from "axios";
import { CheckCircle, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await api.post(`/user/forgot-password`, {
        email,
      });
      if (res.data.success) {
        navigate(`/verify-otp/${email}`);
        toast.success(res.data.message);
        setEmail("");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0F19] flex items-center justify-center px-4">
      {/* Gradient blobs */}
      <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-emerald-500/30 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-cyan-500/30 blur-[120px]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Reset your password
          </h1>
          <p className="text-gray-400 text-sm">
            Enter your email address and we’ll send you instructions to reset
            your password
          </p>
        </div>

        {/* Glass Card */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Forgot Password
            </CardTitle>
            <CardDescription className="text-center text-gray-400">
              {isSubmitted
                ? "Check your email for reset instructions"
                : "Enter your email address to receive a password reset link"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error */}
            {error && (
              <Alert className="bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success State */}
            {isSubmitted ? (
              <div className="py-6 flex flex-col items-center text-center space-y-4">
                <div className="rounded-full p-3 bg-emerald-500/10">
                  <CheckCircle className="h-6 w-6 text-emerald-400" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-lg text-white">
                    Check your inbox
                  </h3>
                  <p className="text-gray-400 text-sm">
                    We’ve sent a password reset link to{" "}
                    <span className="text-white font-medium">{email}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Didn’t receive the email?{" "}
                    <button
                      className="text-emerald-400 hover:underline font-medium"
                      onClick={() => setIsSubmitted(false)}
                    >
                      Try again
                    </button>
                  </p>
                </div>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Email</Label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-400"
                  />
                </div>

                <Button
                  disabled={isLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset link...
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center">
            <p className="text-sm text-gray-400">
              Remember your password?{" "}
              <Link
                to="/login"
                className="text-emerald-400 hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
