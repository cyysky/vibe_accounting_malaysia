"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { api } from "../../../lib/api";
import type { AuthUser } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useToast } from "../../../components/ui/Toast";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { DataTable } from "../../../components/ui/DataTable";
import { Modal } from "../../../components/ui/Modal";
import { Field, Input, Select } from "../../../components/ui/Form";

const ROLE_DESC: Record<AuthUser["role"], string> = {
  OWNER: "Full access including account book configuration and user management.",
  ADMIN: "Full operational access; cannot delete the account book.",
  ACCOUNTANT: "Can manage GL, journals, reports and approve transactions.",
  CLERK: "Can create invoices, bills and payments. Limited approvals.",
  VIEWER: "Read-only access to all operational screens.",
};

const ROLES: AuthUser["role"][] = ["OWNER", "ADMIN", "ACCOUNTANT", "CLERK", "VIEWER"];

interface UserForm {
  email: string;
  name: string;
  password: string;
  role: AuthUser["role"];
}

const emptyForm: UserForm = { email: "", name: "", password: "", role: "CLERK" };

export default function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => api.me() });
  const me = meQ.data;
  const usersQ = useQuery({ queryKey: ["users"], queryFn: () => api.listUsers() });

  const createMut = useMutation({
    mutationFn: (input: UserForm) => api.createUser({ ...input, accountBookId: me?.accountBookId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
      setForm(emptyForm);
      setError(null);
      toast.success("User invited", "They can sign in immediately with the password you set.");
    },
    onError: (e: Error) => { setError(e.message); toast.error("Invite failed", e.message); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; role?: AuthUser["role"]; active?: boolean } }) =>
      api.updateUser(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditing(null);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("User removed"); },
    onError: (e: Error) => toast.error("Remove failed", e.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(u: AuthUser) {
    setEditing(u);
    setForm({ email: u.email, name: u.name, password: "", role: u.role });
    setError(null);
    setShowForm(true);
  }

  function submit() {
    if (editing) {
      const patch: { name?: string; role?: AuthUser["role"] } = { name: form.name, role: form.role };
      updateMut.mutate({ id: editing.id, patch });
    } else {
      if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
      createMut.mutate(form);
    }
  }

  const canManage = me?.role === "OWNER" || me?.role === "ADMIN";
  const isOwner = me?.role === "OWNER";
  const users = usersQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage workspace members and their role-based access."
        breadcrumbs={[{ label: "Settings" }, { label: "Users" }]}
        actions={
          <>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Invite User
              </Button>
            )}
          </>
        }
      />

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Workspace members ({users.length})</h2>
          </div>
          {usersQ.isLoading && <span className="text-xs text-slate-500">Loading…</span>}
        </div>
        <DataTable
          data={users}
          loading={usersQ.isLoading}
          rowKey={(u) => u.id}
          empty="No users in this workspace yet."
          columns={[
            {
              key: "name",
              header: "Name",
              render: (u) => (
                <div>
                  <Link href={"/settings/users/" + u.id} className="font-medium text-blue-600 hover:underline">{u.name}</Link>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              render: (u) => <StatusBadge status={u.role} />,
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (u) =>
                canManage ? (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isOwner && u.id !== me?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remove user ${u.email} from this workspace?`)) deleteMut.mutate(u.id);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    )}
                  </div>
                ) : null,
            },
          ]}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Role definitions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center gap-2">
                <StatusBadge status={r} />
                <span className="text-xs text-slate-500">{r === "OWNER" ? "1 user" : ""}</span>
              </div>
              <p className="text-xs text-slate-500">{ROLE_DESC[r]}</p>
            </div>
          ))}
        </div>
      </section>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? `Edit ${editing.email}` : "Invite a new user"}>
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          {!editing && (
            <Field label="Password (min 8 chars)">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          )}
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AuthUser["role"] })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </Field>
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              <X className="mt-0.5 h-3 w-3" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={submit} loading={createMut.isPending || updateMut.isPending}>
              {editing ? "Save changes" : "Create user"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
