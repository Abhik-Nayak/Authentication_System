import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OTPInput from "@/components/ui/OTPInput";
import api from "@/lib/axios";
import AuthLayout from "@/components/AuthLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, CheckCircle, ArrowLeft } from "lucide-react";

export default function TwoFactorSettings() {
  const accessToken = localStorage.getItem("accessToken");
  const navigate = useNavigate();
  const [step, setStep] = useState("idle"); // idle | qr | success
  const [qrCode, setQrCode] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEnable2FA = async () => {
    try {
      setLoading(true);
      const res = await api.post(
        `user/2fa/setup`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      setQrCode(res.data.qrCode);
      setStep("qr");
    } catch (err) {
      setError("Failed to setup 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;

    try {
      setLoading(true);
      setError("");
      await api.post(
        "user/2fa/verify",
        { token: otp },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      setStep("success");
    } catch (err) {
      setError("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-fit rounded-full p-3 bg-emerald-500/10 mb-2">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Two-Factor Authentication
        </h1>
        <p className="text-gray-400 text-sm">
          Add an extra layer of security to your account
        </p>
      </div>

      {/* Glass Card */}
      <Card className="w-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            {step === "idle" && "Setup 2FA"}
            {step === "qr" && "Scan QR Code"}
            {step === "success" && "2FA Enabled"}
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            {step === "idle" &&
              "Protect your account with an authenticator app"}
            {step === "qr" &&
              "Scan the QR code with Google Authenticator or Authy"}
            {step === "success" &&
              "Your account is now protected with 2FA"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* STEP 0: Enable */}
          {step === "idle" && (
            <Button
              onClick={handleEnable2FA}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                "Enable 2FA"
              )}
            </Button>
          )}

          {/* STEP 1: QR + OTP */}
          {step === "qr" && (
            <div className="space-y-4">
              <img
                src={qrCode}
                alt="2FA QR Code"
                className="mx-auto border border-white/10 rounded-lg bg-white p-2"
              />

              <OTPInput value={otp} onChange={setOtp} />

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <Button
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Enable"
                )}
              </Button>
            </div>
          )}

          {/* STEP 2: SUCCESS */}
          {step === "success" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-fit rounded-full p-3 bg-emerald-500/10">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-emerald-400 text-lg font-semibold">
                2FA Enabled Successfully
              </p>
              <p className="text-gray-400 text-sm">
                Your account is now protected with two-factor authentication.
              </p>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
