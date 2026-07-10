"use client";
import clsx from "clsx";

const VARIANT: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-sky-100 text-sky-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  VOID: "bg-rose-100 text-rose-700",
  APPLIED: "bg-emerald-100 text-emerald-700",
  OPEN: "bg-sky-100 text-sky-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  POSTED: "bg-emerald-100 text-emerald-700",
  REVERSED: "bg-amber-100 text-amber-700",
  RECEIVE: "bg-emerald-100 text-emerald-700",
  ISSUE: "bg-rose-100 text-rose-700",
  ADJUST: "bg-amber-100 text-amber-700",
  TRANSFER: "bg-sky-100 text-sky-700",
  NOT_SUBMITTED: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-700",
  SUBMITTED: "bg-sky-100 text-sky-700",
  VALID: "bg-emerald-100 text-emerald-700",
  INVALID: "bg-rose-100 text-rose-700",
  BANK: "bg-sky-100 text-sky-700",
  CASH: "bg-emerald-100 text-emerald-700",
  CHEQUE: "bg-amber-100 text-amber-700",
  CARD: "bg-violet-100 text-violet-700",
  EFT: "bg-sky-100 text-sky-700",
  OTHER: "bg-slate-100 text-slate-700",
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null;
  const cls = VARIANT[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={clsx("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", cls, className)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
