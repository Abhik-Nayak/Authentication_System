import { useState } from "react";
import OTPInput from "@/components/ui/OTPInput";
import api from "@/lib/axios";

export default function TwoFactorSettings() {
  const accessToken = localStorage.getItem("accessToken");
  const [step, setStep] = useState("idle"); // idle | qr | success
  const [qrCode, setQrCode] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // STEP 1: Enable 2FA → get QR
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

  // STEP 2: Verify OTP
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;

    try {
      setLoading(true);
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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0F19] flex items-center justify-center px-4">
      {/* Gradient blobs */}
      <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-emerald-500/30 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-cyan-500/30 blur-[120px]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl p-8 space-y-6 text-center">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Two-Factor Authentication
          </h2>

          {/* STEP 0: Enable */}
          {step === "idle" && (
            <button
              onClick={handleEnable2FA}
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold py-2 rounded-lg transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Enabling..." : "Enable 2FA"}
            </button>
          )}

          {/* STEP 1: QR + OTP */}
          {step === "qr" && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Scan this QR code using Google Authenticator or Authy
              </p>

              <img
                src={qrCode}
                alt="2FA QR Code"
                className="mx-auto border border-white/10 rounded-lg bg-white p-2"
              />

              <OTPInput value={otp} onChange={setOtp} />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                onClick={handleVerifyOTP}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold py-2 rounded-lg transition hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify & Enable"}
              </button>
            </div>
          )}

          {/* STEP 2: SUCCESS */}
          {step === "success" && (
            <div className="space-y-3">
              <p className="text-emerald-400 text-lg font-semibold">
                🎉 2FA Enabled Successfully
              </p>
              <p className="text-gray-300 text-sm">
                Your account is now protected with two-factor authentication.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
