import React, { useState } from "react";
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
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { getData } from "@/context/userContext";
import Google from "../assets/googleLogo.png";
import api from "@/lib/axios";

const Login = () => {
  const { setUser } = getData();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log(formData);
    try {
      setIsLoading(true);
      const res = await api.post("/user/login", formData);
      if (res.data.success && !res.data.twoFactorRequired) {
        navigate("/");
        setUser(res.data.user);
        localStorage.setItem("accessToken", res.data.accessToken);
        toast.success(res.data.message);
      }
      if (res.data.success && res.data.twoFactorRequired) {
        navigate(`/2fa-login?userId=${res.data.userId}`);
        toast.success(res.data.message);
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
      <div className="relative z-10 w-full max-w-md space-y-6 flex flex-col items-center">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Login to your account
          </h1>
          <p className="text-gray-400">
            Start organizing your thoughts and ideas today
          </p>
        </div>

        {/* Glass Card */}
        <Card className="w-full max-w-sm backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Login
            </CardTitle>
            <CardDescription className="text-center text-gray-400">
              Login into your account to get started with Notes App
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Email */}
              <div className="grid gap-2">
                <Label className="text-gray-300">Email</Label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-emerald-400"
                />
              </div>

              {/* Password */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-emerald-400 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="relative">
                  <Input
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    type={showPassword ? "text" : "password"}
                    required
                    className="bg-white/5 border-white/10 text-white pr-10 focus:border-emerald-400"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3">
            {/* Login Button */}
            <Button
              onClick={handleSubmit}
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-2 w-full">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-gray-500">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Google Login */}
            <Button
              onClick={() =>
                window.open("http://localhost:8000/auth/google", "_self")
              }
              variant="outline"
              className="w-full rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              <img src={Google} alt="Google" className="w-5 mr-2" />
              Continue with Google
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Login;
