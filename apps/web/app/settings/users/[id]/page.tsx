"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserCircle2, Save, Power, Trash2, History, Mail, Calendar } from "lucide-react";
import { api, type AuthUser } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { useToast } from "../../../../components/ui/Toast";
import { Skeleton } from "../../../../components/ui/Skeleton";

const ROLE_DESC: Record<string, string> = {
  OWNER: "Full access including account book configuration and user management.",
  ADMIN: "Full operational access; cannot delete the account book.",
  ACCOUNTANT: "Can manage GL, journals, reports and approve transactions.",
  CLERK: "Can create invoices, bills and payments. Limited approvals.",
  VIEWER: "Read-only access to all operational screens.",
};

const ROLES: AuthUser["role"][] = ["OWNER", "ADMIN", "ACCOUNTANT", "CLERK", "VIEWER"];

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const user = useQuery({ queryKey: ["user", id], queryFn: () => api.getUserById(id) });
  const auditQ = useQuery({ queryKey: ["audit-user", id], queryFn: () => api.auditLogFor("User", id) });

  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<AuthUser["role"] | null>(null);

  const update = useMutation({
    mutationFn: (patch: { name?: string; role?: AuthUser["role"]; active?: boolean }) => api.updateUser(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user", id] });
      qc.invalidateQueries({ queryKey: ["users"] });
      setName(null);
      setRole(null);
      toast.success("User updated");
    },
    onError: (e: Error) => toast.error("Update failed", e.message),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      window.location.href = "/settings/users";
    },
  });

  const toast = useToast();
  if (user.isLoading) return (
    <div className="space-y-4 p-8">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg border bg-white" />)}</div>
    </div>
  );
  if (user.error) return <p className="p-8 text-rose-600">Failed to load: {(user.error as Error).message}</p>;
  const u = user.data!;
  const canManage = me.data?.role === "OWNER" || me.data?.role === "ADMIN";
  const isOwner = me.data?.role === "OWNER";
  const isMe = me.data?.id === u.id;

  const currentName = name ?? u.name;
  const currentRole = role ?? u.role;
  const dirty = (name !== null && name !== u.name) || (role !== null && role !== u.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title={u.name}
        description={"User " + u.email}
        breadcrumbs={[{ label: "Users", href: "/settings/users" }, { label: u.name }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={u.active === false ? "INACTIVE" : "ACTIVE"} />
            {canManage && !isMe && (
              <Button
                variant="secondary"
                onClick={() => update.mutate({ active: !(u.active !== false) })}
              >
                <Power className="h-4 w-4" /> {u.active === false ? "Re-activate" : "Deactivate"}
              </Button>
            )}
            {isOwner && !isMe && (
              <Button variant="ghost" onClick={() => { if (confirm("Remove this user?")) remove.mutate(); }}>
                <Trash2 className="h-4 w-4 text-rose-600" /> Remove
              </Button>
            )}
            <Link href="/settings/users">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="User ID" value={u.id} mono />
        <Stat label="Role" value={u.role} />
        <Stat label="Account book" value={u.accountBookId ?? "—"} mono />
        <Stat label="Status" value={u.active === false ? "Inactive" : "Active"} />
      </div>

      {canManage && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700"><UserCircle2 className="h-4 w-4" /> Edit profile</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-medium text-slate-700">Name</div>
              <input className="w-full rounded-md border px-3 py-2" value={currentName} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-sm">
              <div className="mb-1 font-medium text-slate-700">Role</div>
              <select className="w-full rounded-md border px-3 py-2" value={currentRole} onChange={(e) => setRole(e.target.value as AuthUser["role"])}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">{ROLE_DESC[currentRole]}</p>
            </label>
          </div>
          {update.error && <p className="mt-2 text-sm text-rose-600">{(update.error as Error).message}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              disabled={!dirty}
              loading={update.isPending}
              onClick={() => update.mutate({
                name: name !== null ? name : undefined,
                role: role !== null ? role : undefined,
              })}
            >
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><Mail className="h-4 w-4" /> Identity</h3>
        <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div><dt className="text-xs uppercase text-slate-500">Email</dt><dd>{u.email}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Display name</dt><dd>{u.name}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Role</dt><dd>{u.role}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Active</dt><dd>{u.active === false ? "No" : "Yes"}</dd></div>
        </dl>
      </div>

      {(u.createdAt || u.lastLoginAt) && (
        <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><Calendar className="h-4 w-4" /> Timeline</h3>
          <dl className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {u.createdAt && <div><dt className="text-xs uppercase text-slate-500">Member since</dt><dd>{new Date(u.createdAt).toLocaleString("en-MY")}</dd></div>}
            {u.updatedAt && <div><dt className="text-xs uppercase text-slate-500">Updated</dt><dd>{new Date(u.updatedAt).toLocaleString("en-MY")}</dd></div>}
            {u.lastLoginAt && <div><dt className="text-xs uppercase text-slate-500">Last login</dt><dd>{new Date(u.lastLoginAt).toLocaleString("en-MY")}</dd></div>}
          </dl>
        </div>
      )}

      {(auditQ.data ?? []).length > 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><History className="h-4 w-4" /> Activity</h3>
          <ol className="space-y-1 text-slate-600">
            {auditQ.data!.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <StatusBadge status={e.action === "CREATE" ? "ACTIVE" : e.action === "DELETE" ? "INACTIVE" : "DRAFT"} />
                <span className="font-medium">{e.action}</span>
                {e.user && <span className="text-slate-400">by {e.user.name ?? e.user.email}</span>}
                <time className="ml-auto text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("en-MY")}</time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={"mt-1 text-base font-semibold " + (mono ? "font-mono text-xs truncate" : "")} title={value}>{value}</div>
    </div>
  );
}
