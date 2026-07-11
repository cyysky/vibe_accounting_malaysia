"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Package, AlertTriangle, Plus, BarChart3, Pencil, History } from "lucide-react";
import { api, type Item, type StockMovement } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { DataTable } from "../../../components/ui/DataTable";
import { Modal } from "../../../components/ui/Modal";

const fmt = (n: number) => (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR" });
const qty = (n: number) => Number(n).toLocaleString("en-MY", { maximumFractionDigits: 2 });

function ReceiveForm({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("RECEIVE");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(Number(item.cost ?? 0));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const create = useMutation({
    mutationFn: (p: Parameters<typeof api.createStockMovement>[0]) => api.createStockMovement(p),
    onSuccess: () => onSaved(),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={"New movement — " + item.code}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={!quantity}
            onClick={() => create.mutate({ itemId: item.id, type, quantity, unitCost, date, reference, notes })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Type *</div>
          <select className="w-full rounded-md border px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="RECEIVE">Receive (in)</option>
            <option value="ISSUE">Issue (out)</option>
            <option value="ADJUST">Adjust (correction)</option>
            <option value="TRANSFER">Transfer</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Date *</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Quantity * <span className="text-xs text-slate-400">(positive for in, negative for out)</span></div>
          <input type="number" step="0.0001" className="w-full rounded-md border px-3 py-2" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Unit cost</div>
          <input type="number" step="0.0001" className="w-full rounded-md border px-3 py-2" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Reference</div>
          <input className="w-full rounded-md border px-3 py-2" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO / SO / Manual" />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-1 font-medium text-slate-700">Notes</div>
          <textarea className="w-full rounded-md border px-3 py-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const item = useQuery({ queryKey: ["item", id], queryFn: () => api.getItem(id) });
  const movements = useQuery({
    queryKey: ["stockMovements", { itemId: id }],
    queryFn: () => api.stockMovements(id),
    enabled: !!id,
  });
  const auditQ = useQuery({ queryKey: ["audit-item", id], queryFn: () => api.auditLogFor("Item", id) });
  const [creating, setCreating] = useState(false);

  if (item.isLoading) return <p className="p-8 text-slate-500">Loading item…</p>;
  if (item.error) return <p className="p-8 text-rose-600">Failed to load: {(item.error as Error).message}</p>;
  const i = item.data!;
  const lowStock = Number(i.onHand) <= Number(i.reorderLevel);
  const totalIn = (movements.data ?? []).filter((m) => Number(m.quantity) > 0).reduce((s, m) => s + Number(m.quantity), 0);
  const totalOut = (movements.data ?? []).filter((m) => Number(m.quantity) < 0).reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);
  const inventoryValue = Number(i.onHand) * Number(i.cost);

  return (
    <div className="space-y-6">
      <PageHeader
        title={i.name}
        description={"Item " + i.code + " · UOM " + i.uom}
        breadcrumbs={[{ label: "Stock", href: "/stock" }, { label: i.code }]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={i.active ? "ACTIVE" : "INACTIVE"} />
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New movement
            </Button>
            <Link href="/stock">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
            </Link>
          </div>
        }
      />

      {lowStock && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          On-hand quantity ({qty(Number(i.onHand))}) is at or below the reorder level ({qty(Number(i.reorderLevel))}).
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="On hand" value={qty(Number(i.onHand))} bold={lowStock} />
        <Stat label="Reorder level" value={qty(Number(i.reorderLevel))} />
        <Stat label="Cost / unit" value={fmt(Number(i.cost))} />
        <Stat label="Selling price" value={fmt(Number(i.price))} />
        <Stat label="Inventory value" value={fmt(inventoryValue)} />
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700"><Package className="h-4 w-4" /> Item details</h3>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><dt className="text-xs uppercase text-slate-500">Code</dt><dd className="font-mono">{i.code}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Name</dt><dd>{i.name}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">UOM</dt><dd>{i.uom}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Barcode</dt><dd className="font-mono">{i.barcode ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase text-slate-500">Classification</dt><dd className="font-mono">{i.classification ?? "—"}</dd></div>
          <div className="md:col-span-2"><dt className="text-xs uppercase text-slate-500">Description</dt><dd>{i.description ?? "—"}</dd></div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700"><BarChart3 className="h-4 w-4" /> Movement history</h3>
        <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-emerald-100 bg-emerald-50 px-3 py-2"><div className="text-xs uppercase text-emerald-700">Total in</div><div className="font-semibold tabular-nums">{qty(totalIn)}</div></div>
          <div className="rounded border border-rose-100 bg-rose-50 px-3 py-2"><div className="text-xs uppercase text-rose-700">Total out</div><div className="font-semibold tabular-nums">{qty(totalOut)}</div></div>
          <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2"><div className="text-xs uppercase text-slate-600">Net</div><div className={"font-semibold tabular-nums " + (totalIn - totalOut >= 0 ? "text-emerald-700" : "text-rose-700")}>{qty(totalIn - totalOut)}</div></div>
        </div>
        <DataTable
          data={movements.data ?? []}
          rowKey={(m) => m.id}
          loading={movements.isLoading}
          empty="No movements yet — create a receipt to populate on-hand quantity."
          columns={[
            { key: "date", header: "Date", render: (m) => new Date(m.createdAt).toLocaleString("en-MY") },
            { key: "type", header: "Type", render: (m) => <StatusBadge status={m.type} /> },
            { key: "qty", header: "Qty", align: "right", render: (m) => <span className={"tabular-nums " + (Number(m.quantity) > 0 ? "text-emerald-700" : "text-rose-700")}>{qty(Number(m.quantity))}</span> },
            { key: "uc", header: "Unit cost", align: "right", render: (m) => fmt(Number(m.unitCost)) },
            { key: "ref", header: "Reference", render: (m) => m.reference ?? "—" },
            { key: "notes", header: "Notes" },
          ]}
        />
      </div>

      {(auditQ.data ?? []).length > 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700"><History className="h-4 w-4" /> Activity</h3>
          <ol className="space-y-1 text-slate-600">
            {auditQ.data!.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <Pencil className="h-3 w-3 text-slate-400" />
                <span className="font-medium">{e.action}</span>
                {e.user && <span className="text-slate-400">by {e.user.name ?? e.user.email}</span>}
                <time className="ml-auto text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("en-MY")}</time>
              </li>
            ))}
          </ol>
        </div>
      )}

      {creating && (
        <ReceiveForm
          item={i}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["item", id] });
            qc.invalidateQueries({ queryKey: ["stockMovements", { itemId: id }] });
            qc.invalidateQueries({ queryKey: ["stockMovements"] });
            qc.invalidateQueries({ queryKey: ["items"] });
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={"mt-1 tabular-nums " + (bold ? "text-lg font-semibold text-amber-700" : "text-base font-semibold")}>{value}</div>
    </div>
  );
}
