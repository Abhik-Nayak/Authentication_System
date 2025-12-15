import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Logo from "../components/Logo";
import useForm from "../hooks/useForm";
import { useAuthApi } from "../hooks/useAuthApi";
import { toast } from "react-toastify";

export default function Login() {
  const { values, handleChange } = useForm({ email: "", password: "" });
  const { login } = useAuthApi();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await login(values);
      // Save token and basic user
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      toast.success("Logged in");
      navigate("/");
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message;
      toast.error(msg || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card>
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <div className="text-sm text-slate-400">Welcome back</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            name="email"
            value={values.email}
            onChange={handleChange}
            placeholder="you@company.com"
          />
          <Input
            label="Password"
            name="password"
            value={values.password}
            onChange={handleChange}
            type="password"
          />

          <div className="flex items-center justify-between gap-4">
            <Button type="submit" className="bg-indigo-600 text-white">
              Login
            </Button>
            <Link to="/register" className="text-sm text-slate-500">
              Create account
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
