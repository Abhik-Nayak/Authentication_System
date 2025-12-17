import { getData } from "@/context/userContext";
import api from "@/lib/axios";
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function TwoFactorLogin() {
  const { setUser } = getData();
  const [params] = useSearchParams();
  const userId = params.get("userId");
  const navigate = useNavigate();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (otp.length !== 6) return;

    try {
      setLoading(true);
      const res = await api.post("user/2fa/login", { userId, token: otp });
      localStorage.setItem("accessToken", res.data.accessToken);
      setUser(res.data.user);
      navigate("/");
    } catch (err) {
      setError("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19]">
      <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-xl w-full max-w-sm text-center space-y-4">
        <h2 className="text-xl font-semibold text-white">
          Two-Factor Authentication
        </h2>

        <p className="text-sm text-gray-400">
          Enter the 6-digit code from your authenticator app
        </p>

        <input
          type="text"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          className="w-full text-center tracking-widest text-lg bg-white/5 border border-white/10 text-white rounded-lg py-2 outline-none"
          placeholder="••••••"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold py-2 rounded-lg"
        >
          {loading ? "Verifying..." : "Verify & Login"}
        </button>
      </div>
    </div>
  );
}
