"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "./Button";
import { useToast } from "./Toast";
import { formatTin, isPlausibleLhdnmTin, pickMyInvoisIdType, pickMyInvoisIdValue } from "../../lib/tinUtils";

interface TinValidatorProps {
  tin: string;
  brn?: string;
  partyName?: string;
  env?: "SANDBOX" | "PRODUCTION";
}

interface TinResult {
  status: "idle" | "loading" | "valid" | "invalid" | "error";
  message?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export function TinValidator({ tin, brn, partyName, env = "SANDBOX" }: TinValidatorProps) {
  const toast = useToast();
  const [result, setResult] = useState<TinResult>({ status: "idle" });
  const normalizedTin = formatTin(tin);

  if (!normalizedTin) {
    return (
      <div className="mt-2 text-xs text-slate-400">
        Set a TIN to enable MyInvois taxpayer validation.
      </div>
    );
  }
  const formatLooksOk = isPlausibleLhdnmTin(normalizedTin);

  async function run() {
    setResult({ status: "loading" });
    try {
      const idType = pickMyInvoisIdType({ brn });
      const idValue = pickMyInvoisIdValue(normalizedTin, { brn });
      const res = (await api.validateEinvoiceTin({ env, tin: normalizedTin, idType, idValue })) as Record<string, unknown>;
      const isValid = res?.valid === true || res?.isValid === true || res?.status === "valid";
      const name = (res?.name as string) || (res?.taxpayerName as string);
      const addr = res?.address as Record<string, string> | undefined;
      setResult({
        status: isValid ? "valid" : "invalid",
        name,
        address: addr?.line1 || addr?.address1,
        city: addr?.city,
        state: addr?.state,
        postalCode: addr?.postalCode,
        message: isValid ? "TIN matches a registered MyInvois taxpayer." : "TIN did not match any registered taxpayer.",
      });
      if (isValid) toast.success("TIN valid", name || "Taxpayer matched");
      else toast.warning("TIN unverified", "No taxpayer matched; double-check the digits.");
    } catch (e) {
      const err = e as Error;
      setResult({ status: "error", message: err.message });
      toast.error("TIN check failed", err.message);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={run} loading={result.status === "loading"}>
          {result.status === "valid" ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          Validate against MyInvois
        </Button>
        <span className="text-xs text-slate-500">
          TIN <span className="font-mono">{normalizedTin}</span> on {env}
        </span>
        {!formatLooksOk && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="Expected 1-2 letter prefix + 8-12 digits (LHDNM)">
            format hint
          </span>
        )}
      </div>
      {result.status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Contacting MyInvois taxpayer endpoint…
        </div>
      )}
      {result.status === "valid" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
          <div className="font-semibold">{result.message}</div>
          {result.name && <div className="mt-1">Registered name: <strong>{result.name}</strong></div>}
          {(result.address || result.city || result.state) && (
            <div className="mt-1 text-emerald-700">
              {[result.address, result.city, result.state, result.postalCode].filter(Boolean).join(", ")}
            </div>
          )}
          {partyName && result.name && partyName.toLowerCase() !== result.name.toLowerCase() && (
            <div className="mt-1 text-amber-700">
              Heads up: stored name "{partyName}" differs from MyInvois registration.
            </div>
          )}
        </div>
      )}
      {result.status === "invalid" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {result.message}
        </div>
      )}
      {result.status === "error" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
          MyInvois check failed: {result.message}
        </div>
      )}
    </div>
  );
}
