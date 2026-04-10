import React from "react";
import { BrainCircuitIcon } from "lucide-react";
import { Link } from "react-router-dom";

const AuthLayout = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0F19] flex items-center justify-center px-4">
      {/* Gradient blobs */}
      <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-emerald-500/30 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-cyan-500/30 blur-[120px]" />

      {/* Logo */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-2"
      >
        <BrainCircuitIcon className="h-6 w-6 text-emerald-400" />
        <span className="font-bold text-xl text-white">
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            AI
          </span>
          Notes
        </span>
      </Link>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md space-y-6 flex flex-col items-center">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
