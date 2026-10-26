import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const sizes = { md: "h-11 px-4 text-sm", lg: "h-14 px-6 text-base" };
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90",
  secondary: "border border-line bg-surface hover:border-ink",
  ghost: "text-muted hover:text-ink",
  danger: "border border-line bg-surface text-wrong hover:border-wrong",
};

export const buttonClass = (variant: Variant = "primary", size: keyof typeof sizes = "md") =>
  `${base} ${sizes[size]} ${variants[variant]}`;

export function Button({ variant = "primary", size = "md", className = "", ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button {...p} className={`${buttonClass(variant, size)} ${className}`} />;
}

export function LinkButton({ variant = "primary", size = "md", className = "", ...p }:
  ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link {...p} className={`${buttonClass(variant, size)} ${className}`} />;
}

export const inputClass =
  "h-11 w-full rounded-(--radius-control) border border-line bg-surface px-3 text-base placeholder:text-muted/60";

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div {...p} className={`rounded-(--radius-card) border border-line bg-surface ${className}`} />;
}
