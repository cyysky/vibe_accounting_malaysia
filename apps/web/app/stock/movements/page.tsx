"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, Package } from "lucide-react";
import { api } from "../../../lib/api";
import type { Item, StockMovement } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const fmt = (n: number) => (n ?? 0).toLocaleString("en-MY", { style: "currency", currency: "MYR" });

function MovementForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const itemsQ = useQuery({ queryKey: ["items"], queryFn: () => api.items() });
  const [itemId, setItemId] = useState("");
  const [type, setType] = useState("RECEIVE");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
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
      title="New Stock Movement"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} disabled={!itemId || quantity === 0} onClick={() => create.mutate({ itemId, type: type as "RECEIVE" | "ISSUE" | "ADJUST" | "TRANSFER", quantity, unitCost, reference, notes, date })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Item *</div>
          <select className="w-full rounded-md border px-3 py-2" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select…</option>
            {(itemsQ.data ?? []).map((i: Item) => (
              <option key={i.id} value={i.id}>{i.code} — {i.name} (on hand: {Number(i.onHand).toLocaleString("en-MY")})</option>
            ))}
          </select>
        </label>
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
          <div className="mb-1 font-medium text-slate-700">Quantity * <span className="text-xs text-slate-400">(positive for in, negative for out)</span></div>
          <input type="number" step="0.0001" className="w-full rounded-md border px-3 py-2" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Unit cost</div>
          <input type="number" step="0.0001" className="w-full rounded-md border px-3 py-2" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Date *</div>
          <input type="date" className="w-full rounded-md border px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium text-slate-700">Reference</div>
          <input className="w-full rounded-md border px-3 py-2" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO/SO/Manual" />
        </label>
        <label className="text-sm md:col-span-2">
          <div className="mb-1 font-medium text-slate-700">Notes</div>
          <textarea className="w-full rounded-md border px-3 py-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

export default function StockMovementsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["stockMovements"], queryFn: () => api.stockMovements() });
  const [creating, setCreating] = useState(false);

  const totalIn = (q.data ?? []).filter((m) => Number(m.quantity) > 0).reduce((s, m) => s + Number(m.quantity), 0);
  const totalOut = (q.data ?? []).filter((m) => Number(m.quantity) < 0).reduce((s, m) => s + Number(m.quantity), 0);

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        description="Receipts, issues, adjustments and transfers."
        breadcrumbs={[{ label: "Stock", href: "/stock" }, { label: "Movements" }]}
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New movement</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-slate-500 flex items-center gap-1"><ArrowDown className="h-3 w-3 text-emerald-600" /> Inflow</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{totalIn.toLocaleString("en-MY", { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs uppercase text-slate-500 flex items-center gap-1"><ArrowUp className="h-3 w-3 text-rose-600" /> Outflow</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{totalOut.toLocaleString("en-MY", { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 md:col-span-2">
          <div className="text-xs uppercase text-slate-500">Net change</div>
          <div className={`mt-1 text-xl font-semibold tabular-nums ${totalIn + totalOut >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {(totalIn + totalOut).toLocaleString("en-MY", { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <DataTable<StockMovement>
        data={q.data ?? []}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        empty={
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <Package className="h-10 w-10" /> No stock movements yet.
          </div>
        }
        columns={[
          { key: "date", header: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString("en-MY") },
          { key: "item", header: "Item", render: (r) => r.item ? <Link href={"/stock/" + r.item.id} className="text-blue-600 hover:underline">{r.item.code} — {r.item.name}</Link> : "—" },
          { key: "type", header: "Type", render: (r) => <StatusBadge status={r.type} /> },
          { key: "quantity", header: "Qty", align: "right", render: (r) => <span className={`tabular-nums ${Number(r.quantity) > 0 ? "text-emerald-700" : "text-rose-700"}`}>{Number(r.quantity).toLocaleString("en-MY", { maximumFractionDigits: 2 })}</span> },
          { key: "unitCost", header: "Unit cost", align: "right", render: (r) => fmt(Number(r.unitCost)) },
          { key: "reference", header: "Reference", render: (r) => r.reference ?? "—" },
          { key: "notes", header: "Notes" },
        ]}
      />
      {creating && <MovementForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["items"] }); }} />}
    </div>
  );
}
