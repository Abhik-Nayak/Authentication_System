import React from "react";

export default function Card({ children, className }) {
  return (
    <div
      className={`w-full max-w-md mx-auto bg-white rounded-2xl p-8 shadow-lg ${
        className || ""
      }`}
    >
      {children}
    </div>
  );
}
