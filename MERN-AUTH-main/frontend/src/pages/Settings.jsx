import React from "react";
import { Button } from "@/components/ui/button";
import { Construction, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const Settings = () => {
  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden bg-[#0B0F19] flex items-center justify-center px-4">
      {/* Gradient blobs */}
      <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-emerald-500/20 blur-[160px]" />
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-cyan-500/20 blur-[160px]" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-lg">
        {/* Icon */}
        <div className="rounded-full p-4 bg-white/5 border border-white/10">
          <Construction className="h-12 w-12 text-emerald-400" />
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-white">Coming Soon</h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            We're building something great. Settings page with profile
            management, preferences, and more is on the way.
          </p>
        </div>

        {/* Available now section */}
        <div className="w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <p className="text-sm text-gray-400 uppercase tracking-wider font-medium">
            Available now
          </p>

          <Link
            to="/2fa-setup"
            className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-emerald-500/10">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">
                  Two-Factor Authentication
                </p>
                <p className="text-gray-400 text-sm">
                  Secure your account with 2FA
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-emerald-400 transition" />
          </Link>
        </div>

        {/* Back link */}
        <Button
          asChild
          variant="outline"
          className="rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
};

export default Settings;
