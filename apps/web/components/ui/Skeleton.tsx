import clsx from "clsx";

export function Skeleton({ className, rows = 1 }: { className?: string; rows?: number }) {
  return (
    <div className={"space-y-2 " + (className ?? "")}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 w-full animate-pulse rounded bg-slate-200" style={{ width: clsx("100%", i === rows - 1 && "60%") }} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={"rounded-lg border bg-white p-4 shadow-sm " + (className ?? "")}>
      <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-6 w-1/2 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex gap-3 border-b bg-slate-50 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-3 flex-1 animate-pulse rounded bg-slate-200" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c} className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
