import React from "react";
import clsx from "clsx";

export default function Button({
  children,
  className,
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
