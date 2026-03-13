'use client';

import * as React from "react";

type ButtonVariant = "primary" | "ghost" | "outline" | "gradient" | "subtle";
type ButtonSize = "sm" | "md" | "lg" | "icon";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function buttonClasses(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = opts ?? {};

  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-blue-600 text-white shadow-[0px_2px_4px_-2px_rgba(21,93,252,0.20),0px_4px_6px_-1px_rgba(21,93,252,0.20)] hover:-translate-y-px hover:shadow-lg active:translate-y-px",
    ghost:
      "bg-transparent text-slate-950 hover:bg-gray-50 hover:-translate-y-px hover:shadow-md active:translate-y-px",
    outline:
      "border border-gray-300 bg-white text-slate-900 hover:border-gray-400 hover:bg-gray-50",
    gradient:
      "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:-translate-y-px hover:shadow-md active:translate-y-px",
    subtle:
      "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:-translate-y-px active:translate-y-px",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-xs leading-5",
    md: "h-10 px-4 text-sm leading-5",
    lg: "h-11 px-6 text-sm leading-5",
    icon: "h-9 w-9 text-sm",
  };

  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonClasses({ variant, size, className })}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

