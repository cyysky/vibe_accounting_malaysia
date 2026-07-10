"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { api } from "../../../lib/api";
import type { AuthUser } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const ROLE_DESC: Record<string, string> = {
  OWNER: "Full access including account book configuration and user management.",
  ADMIN: "Full operational access; cannot delete the account book.",
  ACCOUNTANT: "Can manage GL, journals, reports and approve transactions.",
  CLERK: "Can create invoices, bills and payments. Limited approvals.",
  VIEWER: "Read-only access to all operational screens.",
};

export default function UsersPage() {
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const me = meQ.data as AuthUser | undefined;
  const [roles] = useState<Array<keyof typeof ROLE_DESC>>(["OWNER", "ADMIN", "ACCOUNTANT", "CLERK", "VIEWER"]);

  return (
    <div>
      <PageHeader title="Users & Roles" description="Role-based access control matrix." breadcrumbs={[{ label: "Settings" }, { label: "Users" }]} />

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 flex items-center gap-2"><Users className="h-4 w-4" /> Current user</h2>
        {me ? (
          <div className="text-sm text-slate-600">
            <p><span className="font-medium">{me.name}</span> ({me.email}) — <StatusBadge status={me.role} /></p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Roles</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <StatusBadge status="ISSUED" />
                <span className="text-sm font-semibold text-slate-700">{r}</span>
              </div>
              <p className="text-xs text-slate-500">{ROLE_DESC[r]}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 text-xs text-slate-500">
        User management is currently handled via the API (<code>POST /api/auth/register</code>).
        A self-service user administration page is on the roadmap.
      </p>
    </div>
  );
}
