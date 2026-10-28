import type { ReactNode } from "react";

type StampTone = "final" | "draft" | "allow" | "deny" | "error" | "tidak-lisensi";

export function Stamp({ tone, children, size = "sm" }: { tone: StampTone; children: ReactNode; size?: "sm" | "md" }) {
  return (
    <span className={`stamp stamp--${tone} ${size === "md" ? "text-[11px]" : ""}`} role="status">
      {children}
    </span>
  );
}
