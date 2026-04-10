import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BrainCircuitIcon } from "lucide-react";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0F19] flex items-center justify-center px-4">
      {/* Gradient blobs */}
      <div className="absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-emerald-500/30 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-[400px] w-[400px] rounded-full bg-cyan-500/30 blur-[120px]" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        <BrainCircuitIcon className="h-16 w-16 text-emerald-400/50" />

        <h1 className="text-7xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          404
        </h1>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Page not found</h2>
          <p className="text-gray-400 max-w-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <Button
          asChild
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
        >
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
