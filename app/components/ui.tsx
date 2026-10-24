import type { ComponentProps, ReactNode } from "react";

/**
 * The few building blocks every page shares, so the look lives in one place.
 * Colours come from the theme in app/app.css (brand = terracotta, stone
 * neutrals, a warm paper background).
 */

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** A steaming bowl, drawn in currentColor. */
export function BowlIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 12h18a9 9 0 0 1-18 0Z" />
      <path d="M8 8c0-1.5 1-1.5 1-3M12 8c0-1.5 1-1.5 1-3M16 8c0-1.5 1-1.5 1-3" />
    </svg>
  );
}

/* Heroicons (MIT), mini set. */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}

export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V5Z" clipRule="evenodd" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-900/20">
        <BowlIcon className="size-5" />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">Recipes</span>
    </span>
  );
}

const buttonVariants = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-700 focus-visible:outline-brand-600",
  secondary:
    "bg-white text-stone-800 ring-1 ring-stone-300 ring-inset hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:hover:bg-stone-800",
  ghost:
    "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
  danger:
    "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        buttonVariants[variant],
        className,
      )}
    />
  );
}

export const inputClass = cx(
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-stone-900 shadow-sm ring-1 ring-stone-300 ring-inset",
  "placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:outline-none",
  "dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:placeholder:text-stone-500",
);

export function Field({
  label,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
      <input {...props} className={inputClass} />
      {hint ? <span className="text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "warning" }) {
  return (
    <div
      role="alert"
      className={cx(
        "rounded-xl px-4 py-3 text-sm ring-1 ring-inset",
        tone === "error"
          ? "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900"
          : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
      )}
    >
      {children}
    </div>
  );
}

const kindStyles = {
  bake: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  cook: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export function KindBadge({ kind }: { kind: "bake" | "cook" }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", kindStyles[kind])}>
      {kind === "bake" ? "Bake" : "Cook"}
    </span>
  );
}

/**
 * Centered card on a warm backdrop, for the pages you see before (or
 * instead of) the app proper: sign-in, sign-up, OAuth consent.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_10%_-10%,var(--color-brand-200),transparent_60%),radial-gradient(50rem_35rem_at_110%_110%,var(--color-amber-200),transparent_60%)] opacity-70 dark:bg-[radial-gradient(60rem_40rem_at_10%_-10%,var(--color-brand-900),transparent_60%),radial-gradient(50rem_35rem_at_110%_110%,var(--color-amber-950),transparent_60%)] dark:opacity-60"
      />
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl bg-white/90 p-6 shadow-xl shadow-stone-900/5 ring-1 ring-stone-900/5 backdrop-blur sm:p-8 dark:bg-stone-900/80 dark:ring-white/10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-stone-600 dark:text-stone-400">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <p className="mt-6 text-center text-sm text-stone-600 dark:text-stone-400">{footer}</p>
        ) : null}
      </div>
    </main>
  );
}

export const textLinkClass =
  "font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300";
