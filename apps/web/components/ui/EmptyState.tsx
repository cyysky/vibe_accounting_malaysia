import { ReactNode } from "react";
import clsx from "clsx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx("flex flex-col items-center gap-3 rounded-lg border border-dashed bg-white px-6 py-12 text-center", className)}>
      {icon && <div className="text-slate-400">{icon}</div>}
      <div>
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
      </div>
      {action}
    </div>
  );
}
