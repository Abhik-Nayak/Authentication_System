import React from "react";

export default function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold">
        AG
      </div>
      <div>
        <div className="text-lg font-semibold">AlphaGPT</div>
        <div className="text-xs text-slate-400">Dashboard</div>
      </div>
    </div>
  );
}
