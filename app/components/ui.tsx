import type { ComponentProps, ReactNode } from "react";

/**
 * The few building blocks every page shares, so the look lives in one place.
 * The look is a printed cookbook (see app/app.css): black ink, one red,
 * hairline rules, small caps, no cards or shadows.
 */

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* Heroicons (MIT), mini set. */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}

/** The wordmark: "Recipes" set like a book's spine. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-baseline gap-2", className)}>
      <span className="display text-2xl leading-none">Recipes</span>
      <span className="text-red" aria-hidden="true">❦</span>
    </span>
  );
}

/** A centred printer's ornament between sections. */
export function Ornament({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx("flex items-center gap-4 text-red", className)}>
      <span className="h-px flex-1 bg-rule/40" />
      <span className="text-lg">❦</span>
      <span className="h-px flex-1 bg-rule/40" />
    </div>
  );
}

const buttonVariants = {
  primary: "bg-ink text-paper hover:bg-red",
  secondary: "border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "text-muted hover:text-red",
  danger: "text-red hover:underline",
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
        "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[1.05rem] smallcaps transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className,
      )}
    />
  );
}

/** Inputs are a ruled line to write on, not a box. */
export const inputClass = cx(
  "block w-full border-0 border-b border-ink bg-transparent px-0 py-2 text-xl text-ink",
  "placeholder:text-muted/70 placeholder:italic focus:border-red focus:ring-0 focus:outline-none",
);

export function Field({
  label,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-sm text-muted smallcaps">{label}</span>
      <input {...props} className={inputClass} />
      {hint ? <span className="mt-1 text-sm text-muted italic">{hint}</span> : null}
    </label>
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "warning" }) {
  return (
    <div
      role="alert"
      className={cx(
        "border-l-2 py-1 pl-4 text-[1.05rem]",
        tone === "error" ? "border-red text-red" : "border-ink",
      )}
    >
      <span className="mr-2 smallcaps">{tone === "error" ? "Erratum." : "Note."}</span>
      {children}
    </div>
  );
}

/** Bake or cook, as a small-caps label in the spot colour. */
export function KindLabel({ kind, className }: { kind: "bake" | "cook"; className?: string }) {
  return <span className={cx("text-red smallcaps", className)}>{kind === "bake" ? "Bake" : "Cook"}</span>;
}

/**
 * A title page, for the pages you see before (or instead of) the app
 * proper: sign-in, sign-up, OAuth consent.
 */
export function AuthShell({
  eyebrow = "Recipes · a private collection",
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md">
        <a href="/" className="block text-center text-sm text-muted smallcaps hover:text-red">
          {eyebrow}
        </a>
        <div className="mt-6 border-[3px] border-double border-rule px-6 py-10 sm:px-10">
          <h1 className="text-center display text-5xl leading-none">{title}</h1>
          {subtitle ? (
            <p className="mt-4 text-center text-lg text-muted italic">{subtitle}</p>
          ) : null}
          <Ornament className="my-8" />
          {children}
        </div>
        {footer ? <p className="mt-6 text-center text-lg italic">{footer}</p> : null}
      </div>
    </main>
  );
}

export const textLinkClass = "not-italic text-red smallcaps underline-offset-4 hover:underline";
