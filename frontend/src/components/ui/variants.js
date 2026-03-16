import { cn } from "../../utils/cn";

const BUTTON_BASE =
  "ui-btn inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_VARIANTS = {
  primary:
    "border-emerald-700 bg-emerald-700 text-white shadow-sm hover:border-emerald-800 hover:bg-emerald-800",
  secondary:
    "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50",
  ghost:
    "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50",
  danger: "border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700",
};

const BUTTON_SIZES = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-10 px-3.5 text-sm",
  lg: "min-h-11 px-4 text-sm",
};

const CARD_BASE =
  "ui-card rounded-2xl border border-zinc-200 bg-white shadow-sm";

const CARD_VARIANTS = {
  default: "",
  elevated: "shadow-md",
  subtle: "border-zinc-200 bg-zinc-50/70 shadow-sm",
};

const INPUT_BASE =
  "ui-input w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition hover:border-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const INPUT_VARIANTS = {
  default: "",
  invalid: "border-red-400 focus:border-red-500 focus:ring-red-300/40",
  success: "border-emerald-500 focus:border-emerald-600 focus:ring-emerald-100",
};

const BADGE_BASE = "ui-badge inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

const BADGE_VARIANTS = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
};

export function buttonVariants({ variant = "primary", size = "md", fullWidth = false, className } = {}) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary, BUTTON_SIZES[size] || BUTTON_SIZES.md, fullWidth && "w-full", className);
}

export function cardVariants({ variant = "default", className } = {}) {
  return cn(CARD_BASE, CARD_VARIANTS[variant] || CARD_VARIANTS.default, className);
}

export function inputVariants({ variant = "default", className } = {}) {
  return cn(INPUT_BASE, INPUT_VARIANTS[variant] || INPUT_VARIANTS.default, className);
}

export function badgeVariants({ variant = "neutral", className } = {}) {
  return cn(BADGE_BASE, BADGE_VARIANTS[variant] || BADGE_VARIANTS.neutral, className);
}
