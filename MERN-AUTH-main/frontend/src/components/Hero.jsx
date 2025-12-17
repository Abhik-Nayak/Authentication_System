import { ArrowRight, Zap } from "lucide-react";
import React from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { getData } from "@/context/userContext";

const Hero = () => {
  const { user } = getData();
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0B0F19]">
      {/* AI Gradient Atmosphere */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[160px]" />
      <div className="absolute top-40 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-500/20 blur-[160px]" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[160px]" />

      <section className="relative z-10 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center text-center space-y-8">
            {/* AI Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-emerald-400 backdrop-blur-md text-sm">
              <Zap className="h-4 w-4" />
              AI-Powered Notes • Smart • Secure
            </div>

            {/* Main Heading */}
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-white">
              Your{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                AI assistant
              </span>{" "}
              for thinking, writing & organizing
            </h1>

            {/* Subheading */}
            <p className="max-w-2xl text-gray-400 text-base md:text-xl leading-relaxed">
              Turn scattered ideas into structured knowledge. Our AI helps you
              write better notes, auto-organize content, and instantly find what
              matters.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button
                onClick={() => navigate("/create-todo")}
                size="lg"
                className="h-12 px-8 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition"
              >
                Start with AI Notes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button
               onClick={() => navigate("/settings")}
                variant="outline"
                size="lg"
                className="h-12 px-8 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                See AI in action
              </Button>
            </div>

            {/* AI Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 max-w-4xl w-full">
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-left">
                <h3 className="text-white font-semibold mb-1">
                  🧠 Smart Summaries
                </h3>
                <p className="text-sm text-gray-400">
                  AI summarizes long notes into clear insights instantly.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-left">
                <h3 className="text-white font-semibold mb-1">
                  ⚡ Auto Organization
                </h3>
                <p className="text-sm text-gray-400">
                  Notes are auto-tagged and grouped by meaning.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-4 text-left">
                <h3 className="text-white font-semibold mb-1">
                  🔍 Instant Search
                </h3>
                <p className="text-sm text-gray-400">
                  Ask questions and AI finds answers from your notes.
                </p>
              </div>
            </div>

            {/* Trust Line */}
            <p className="text-xs md:text-sm text-gray-500 pt-8">
              Free forever • Privacy-first • Powered by AI
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Hero;
