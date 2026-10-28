import type { ReactNode } from "react";

export function Banner({
  tone,
  title,
  children,
  onClose,
}: {
  tone: "seal" | "void" | "paper";
  title: string;
  children?: ReactNode;
  onClose?: () => void;
}) {
  const border = tone === "seal" ? "border-l-[3px] border-l-[var(--color-seal)]" : tone === "void" ? "border-l-[3px] border-l-[var(--color-void)]" : "border-l-[3px] border-l-[var(--color-rule-strong)]";
  return (
    <div className={`sheet ${border} step-change px-4 py-3`} role={tone === "void" ? "alert" : "status"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label" style={{ color: tone === "seal" ? "var(--color-seal)" : tone === "void" ? "var(--color-void)" : undefined }}>
            {title}
          </p>
          {children ? <div className="mt-1 text-sm leading-relaxed">{children}</div> : null}
        </div>
        {onClose ? (
          <button onClick={onClose} className="text-muted hover:text-ink step-change px-1 text-lg leading-none" aria-label="Tutup pemberitahuan">
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
