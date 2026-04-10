import { getData } from "@/context/userContext";
import api from "@/lib/axios";
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

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
          One more step to secure your account
        </p>
      </div>

      {/* Glass Card */}
      <Card className="w-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Verify Identity
          </CardTitle>
          <CardDescription className="text-center text-gray-400">
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="w-full text-center tracking-[0.5em] text-lg font-mono bg-white/5 border-white/10 text-white h-12 focus:border-emerald-400"
            placeholder="000000"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <Button
            onClick={handleVerify}
            disabled={loading || otp.length !== 6}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Login"
            )}
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
