import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "Something went wrong.";
}

export function Button({ tone = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" }) {
  const toneClass = tone === "primary"
    ? "bg-primary text-primary-ink hover:opacity-90"
    : "border border-border bg-surface text-fg hover:border-primary";
  return <button className={`inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium disabled:opacity-50 ${toneClass} ${className}`} {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 w-full rounded-md border border-border bg-bg px-3 text-fg outline-none focus:border-primary ${props.className ?? ""}`} />;
}

export function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 w-full rounded-md border border-border bg-bg px-3 py-2 text-fg outline-none focus:border-primary ${props.className ?? ""}`} />;
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "bad" }) {
  return <p className={`rounded-md border border-border px-3 py-2 text-sm ${tone === "bad" ? "text-fg" : "text-muted"}`}>{children}</p>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl text-fg">{value}</p>
    </div>
  );
}
