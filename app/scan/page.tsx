"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CameraScanner } from "@/components/CameraScanner";
import { ProtectedPage } from "@/components/ProtectedPage";
import {
  ScanFeedbackSignal,
  ScanSignalStatus,
} from "@/components/ScanFeedbackSignal";
import { apiFetch, getStoredToken } from "@/lib/api";
import { isAudioUnlocked, playFeedbackTone, unlockAudio } from "@/lib/audio";
import { getScanProgress } from "@/lib/scan-progress";
import {
  clearScanWorkflow,
  loadScanWorkflow,
  saveScanWorkflow,
  type PersistedScanWorkflow,
} from "@/lib/scan-workflow-storage";
import type {
  ActiveScanResponse,
  Material,
  MaterialMovement,
  ScanDetectionResult,
  ScanSession,
  TallyOrder,
} from "@/lib/types";

type Location = { id: number; name: string; type: string };
type Quotation = { id: number; quote_no: string; customer_name: string };
type Indent = { id: number; indent_no: string; project_name: string };

function applyPersistedForm(state: PersistedScanWorkflow) {
  return {
    workflowType: state.workflowType,
    movementType: state.movementType,
    materialId: state.materialId,
    sizeId: state.sizeId,
    orderId: state.orderId,
    quotationId: state.quotationId,
    indentId: state.indentId,
    sourceLocationId: state.sourceLocationId,
    destinationLocationId: state.destinationLocationId,
    returnCondition: state.returnCondition,
    quantity: state.quantity,
    destination: state.destination,
  };
}

function buildPersistedWorkflow(
  movement: MaterialMovement,
  session: ScanSession,
  form: Omit<PersistedScanWorkflow, "movementId" | "sessionId">,
): PersistedScanWorkflow {
  return {
    movementId: movement.id,
    sessionId: session.id,
    ...form,
  };
}

export default function ScanPage() {
  const token = getStoredToken();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [orders, setOrders] = useState<TallyOrder[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [indents, setIndents] = useState<Indent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [workflowType, setWorkflowType] = useState<"customer" | "internal">("customer");
  const [movementType, setMovementType] = useState<"inward" | "outward">("outward");
  const [materialId, setMaterialId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [indentId, setIndentId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [returnCondition, setReturnCondition] = useState("normal");
  const [quantity, setQuantity] = useState("1");
  const [destination, setDestination] = useState("");
  const [movement, setMovement] = useState<MaterialMovement | null>(null);
  const [session, setSession] = useState<ScanSession | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [simulateMaterialId, setSimulateMaterialId] = useState("");
  const [showSizeUpdate, setShowSizeUpdate] = useState(false);
  const [scanSignal, setScanSignal] = useState<ScanSignalStatus>(null);
  const [scanSignalLabel, setScanSignalLabel] = useState("");
  const [quantityWarning, setQuantityWarning] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [soundReady, setSoundReady] = useState(false);

  const selectedMaterial = materials.find((item) => item.id === Number(materialId));
  const scanProgress = useMemo(
    () => getScanProgress(movement, session),
    [movement, session],
  );

  const formSnapshot = useMemo(
    () => ({
      workflowType,
      movementType,
      materialId,
      sizeId,
      orderId,
      quotationId,
      indentId,
      sourceLocationId,
      destinationLocationId,
      returnCondition,
      quantity,
      destination,
    }),
    [
      workflowType,
      movementType,
      materialId,
      sizeId,
      orderId,
      quotationId,
      indentId,
      sourceLocationId,
      destinationLocationId,
      returnCondition,
      quantity,
      destination,
    ],
  );

  const refreshMovement = useCallback(
    async (movementId: number) => {
      const updated = await apiFetch<MaterialMovement>(`/movements/${movementId}`, {
        token,
      });
      setMovement(updated);
      return updated;
    },
    [token],
  );

  const applyScanResult = useCallback(
    async (result: ScanDetectionResult) => {
      setSession(result.session);

      if (movement) {
        await refreshMovement(movement.id);
      }

      const label = result.detection?.yolo_class ?? "item";
      const confidence = result.detection?.confidence ?? 0;

      if (result.feedback === "match") {
        setShowSizeUpdate(true);
        setScanSignal("match");
        setScanSignalLabel(`Detected ${label} (${confidence}% confidence)`);

        const scanned = result.scanned_count ?? 0;
        const expected = result.expected_quantity ?? 0;
        const overOrAtTarget =
          result.quantity_status === "exceeded" ||
          result.quantity_status === "reached";

        if (overOrAtTarget) {
          const warningMessage =
            result.quantity_status === "exceeded"
              ? `Quantity increased past target: scanned ${scanned} / expected ${expected}. Extra piece not needed — warning tone.`
              : `Target quantity reached (${scanned}/${expected}). Further scans will warn.`;
          setQuantityWarning(warningMessage);
          setFeedback(warningMessage);
          setScanSignal("warning");
          setScanSignalLabel(warningMessage);
          playFeedbackTone("warning");
        } else {
          setQuantityWarning(null);
          setFeedback(
            `Counted ${label} (${confidence}% confidence). Progress ${scanned}/${expected || "—"}. Confirm size if needed.`,
          );
          playFeedbackTone("match");
        }
      } else {
        // False detection: visual alert only — no beep
        setShowSizeUpdate(false);
        setQuantityWarning(null);
        setScanSignal("mismatch");
        setScanSignalLabel(`Detected ${label} instead of expected item`);
        setFeedback(
          `False detection: ${label} does not match expected material. Item not counted. No sound.`,
        );
      }
    },
    [movement, refreshMovement],
  );

  useEffect(() => {
    setSoundReady(isAudioUnlocked());

    async function unlockOnGesture() {
      await unlockAudio();
      setSoundReady(true);
    }

    window.addEventListener("pointerdown", unlockOnGesture, { once: true });
    window.addEventListener("keydown", unlockOnGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch<Material[]>("/materials", { token }),
      apiFetch<TallyOrder[]>("/tally-orders", { token }),
      apiFetch<Quotation[]>("/quotations", { token }),
      apiFetch<Indent[]>("/indents", { token }),
      apiFetch<Location[]>("/locations", { token }),
    ]).then(([materialList, orderList, quoteList, indentList, locationList]) => {
      setMaterials(materialList);
      setOrders(orderList);
      setQuotations(quoteList);
      setIndents(indentList);
      setLocations(locationList);
      if (materialList[0]) {
        setSimulateMaterialId(String(materialList[0].id));
      }
    });
  }, [token]);

  useEffect(() => {
    if (!token || restored) {
      return;
    }

    async function restoreWorkflow() {
      try {
        const stored = loadScanWorkflow();
        let restoredMovement: MaterialMovement | null = null;
        let restoredSession: ScanSession | null = null;

        if (stored) {
          try {
            restoredMovement = await apiFetch<MaterialMovement>(
              `/movements/${stored.movementId}`,
              { token },
            );
            restoredSession = await apiFetch<ScanSession>(
              `/scan-sessions/${stored.sessionId}`,
              { token },
            );
          } catch {
            clearScanWorkflow();
          }
        }

        if (
          !restoredMovement ||
          !restoredSession ||
          restoredMovement.status !== "scanning" ||
          restoredSession.status !== "active"
        ) {
          const active = await apiFetch<ActiveScanResponse>("/movements/active-scan", {
            token,
          });
          restoredMovement = active.movement;
          restoredSession = active.session;
        }

        if (
          restoredMovement &&
          restoredSession &&
          restoredMovement.status === "scanning" &&
          restoredSession.status === "active"
        ) {
          setMovement(restoredMovement);
          setSession(restoredSession);

          if (stored) {
            Object.entries(applyPersistedForm(stored)).forEach(([key, value]) => {
              switch (key) {
                case "workflowType":
                  setWorkflowType(value as "customer" | "internal");
                  break;
                case "movementType":
                  setMovementType(value as "inward" | "outward");
                  break;
                case "materialId":
                  setMaterialId(value);
                  break;
                case "sizeId":
                  setSizeId(value);
                  break;
                case "orderId":
                  setOrderId(value);
                  break;
                case "quotationId":
                  setQuotationId(value);
                  break;
                case "indentId":
                  setIndentId(value);
                  break;
                case "sourceLocationId":
                  setSourceLocationId(value);
                  break;
                case "destinationLocationId":
                  setDestinationLocationId(value);
                  break;
                case "returnCondition":
                  setReturnCondition(value);
                  break;
                case "quantity":
                  setQuantity(value);
                  break;
                case "destination":
                  setDestination(value);
                  break;
              }
            });
          } else {
            const item = restoredMovement.items[0];
            if (item) {
              setMaterialId(String(item.material_id));
              setSizeId(item.material_size_id ? String(item.material_size_id) : "");
              setQuantity(String(item.quantity));
            }
            setDestination(restoredMovement.destination ?? "");
          }

          const progress = getScanProgress(restoredMovement, restoredSession);
          if (progress && progress.status !== "ok") {
            setQuantityWarning(
              progress.status === "exceeded"
                ? `Warning: scanned quantity (${progress.scanned}) exceeds expected (${progress.expected}).`
                : `Warning: target quantity reached (${progress.scanned}/${progress.expected}).`,
            );
          }

          setFeedback("Scan session resumed. Continue from where you left off.");
          saveScanWorkflow(
            buildPersistedWorkflow(
              restoredMovement,
              restoredSession,
              stored ? applyPersistedForm(stored) : {
                workflowType: "customer",
                movementType: restoredMovement.type,
                materialId: String(restoredMovement.items[0]?.material_id ?? ""),
                sizeId: restoredMovement.items[0]?.material_size_id
                  ? String(restoredMovement.items[0].material_size_id)
                  : "",
                orderId: "",
                quotationId: "",
                indentId: "",
                sourceLocationId: "",
                destinationLocationId: "",
                returnCondition: "normal",
                quantity: String(restoredMovement.items[0]?.quantity ?? "1"),
                destination: restoredMovement.destination ?? "",
              },
            ),
          );
        }
      } catch {
        clearScanWorkflow();
      } finally {
        setRestored(true);
      }
    }

    void restoreWorkflow();
  }, [token, restored]);

  useEffect(() => {
    if (!movement || !session || movement.status !== "scanning") {
      return;
    }

    saveScanWorkflow(buildPersistedWorkflow(movement, session, formSnapshot));
  }, [movement, session, formSnapshot]);

  useEffect(() => {
    if (!scanProgress || scanProgress.status === "ok") {
      return;
    }

    setQuantityWarning(
      scanProgress.status === "exceeded"
        ? `Warning: scanned quantity (${scanProgress.scanned}) exceeds expected (${scanProgress.expected}).`
        : `Warning: target quantity reached (${scanProgress.scanned}/${scanProgress.expected}).`,
    );
  }, [scanProgress]);

  async function createMovement(event: FormEvent) {
    event.preventDefault();
    await unlockAudio();
    setSoundReady(true);
    setFeedback("");
    setQuantityWarning(null);

    try {
      const created = await apiFetch<MaterialMovement>("/movements", {
        token,
        method: "POST",
        body: JSON.stringify({
          type: movementType,
          tally_order_id: orderId ? Number(orderId) : null,
          quotation_id: workflowType === "customer" && quotationId ? Number(quotationId) : null,
          indent_id: workflowType === "internal" && indentId ? Number(indentId) : null,
          source_location_id: sourceLocationId ? Number(sourceLocationId) : null,
          destination_location_id: destinationLocationId ? Number(destinationLocationId) : null,
          return_condition: movementType === "inward" ? returnCondition : null,
          destination,
          items: [
            {
              material_id: Number(materialId),
              material_size_id: sizeId ? Number(sizeId) : null,
              quantity: Number(quantity),
            },
          ],
        }),
      });

      setMovement(created);

      const activeSession = await apiFetch<ScanSession>(`/movements/${created.id}/scan`, {
        token,
        method: "POST",
        body: JSON.stringify({
          material_id: Number(materialId),
          material_size_id: sizeId ? Number(sizeId) : null,
        }),
      });

      setSession(activeSession);
      saveScanWorkflow(buildPersistedWorkflow(created, activeSession, formSnapshot));
      setFeedback("Movement created and scan session started. Point the camera at the item.");
    } catch (movementError) {
      const message =
        movementError instanceof Error ? movementError.message : "Failed to create movement";
      setFeedback(message);
    }
  }

  async function startScan() {
    if (!movement) return;

    await unlockAudio();
    setSoundReady(true);

    try {
      const activeSession = await apiFetch<ScanSession>(`/movements/${movement.id}/scan`, {
        token,
        method: "POST",
        body: JSON.stringify({
          material_id: Number(materialId),
          material_size_id: sizeId ? Number(sizeId) : null,
        }),
      });

      setSession(activeSession);
      saveScanWorkflow(buildPersistedWorkflow(movement, activeSession, formSnapshot));
      setFeedback("Scan session active. Point the camera at the item or upload an image.");
    } catch (scanError) {
      const message =
        scanError instanceof Error ? scanError.message : "Failed to start scan session";
      setFeedback(message);
    }
  }

  async function updateSessionSize(newSizeId: string) {
    if (!session) return;

    const updated = await apiFetch<ScanSession>(
      `/scan-sessions/${session.id}/expected-material`,
      {
        token,
        method: "PATCH",
        body: JSON.stringify({
          material_id: session.material_id,
          material_size_id: newSizeId ? Number(newSizeId) : null,
        }),
      },
    );

    setSession(updated);
    setShowSizeUpdate(false);
    setFeedback("Size updated in system. Continue scanning with the corrected size.");
  }

  async function simulateScan() {
    if (!session) return;

    await unlockAudio();
    setSoundReady(true);

    const result = await apiFetch<ScanDetectionResult>(`/scan-sessions/${session.id}/scan`, {
      token,
      method: "POST",
      body: JSON.stringify({
        detected_material_id: Number(simulateMaterialId),
        confidence: 96.5,
      }),
    });

    await applyScanResult(result);
  }

  async function completeMovement() {
    if (!movement) return;

    await apiFetch(`/movements/${movement.id}/complete`, {
      token,
      method: "POST",
    });

    clearScanWorkflow();
    setFeedback("Movement completed. DC/GRN generated for Tally sync.");
    setSession(null);
    setMovement(null);
    setQuantityWarning(null);
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        {movement && session ? (
          <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-medium text-sky-900">
              Active scan in progress — you can leave this page and return anytime to continue.
            </p>
            <p className="mt-1 text-sm text-sky-800">
              Movement #{movement.id} · Session #{session.id} · Matched {session.matched_count}
              {scanProgress ? ` / ${scanProgress.expected} expected` : ""}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Preparation for Shifting</h2>
          <p className="mt-1 text-sm text-slate-500">
            FRD §8.2: Select expected material name and size manually before AI scanning at the marked position.
          </p>

          <form onSubmit={createMovement} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium md:col-span-2">
              Rental Workflow
              <select
                value={workflowType}
                onChange={(event) => setWorkflowType(event.target.value as "customer" | "internal")}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="customer">Customer Rental (Quotation → Order → DC)</option>
                <option value="internal">Internal Project (Indent → DC)</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              Movement Type
              <select
                value={movementType}
                onChange={(event) => setMovementType(event.target.value as "inward" | "outward")}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="outward">Outward</option>
                <option value="inward">Inward</option>
              </select>
            </label>

            {workflowType === "customer" ? (
              <label className="text-sm font-medium">
                Quotation
                <select
                  value={quotationId}
                  onChange={(event) => setQuotationId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Select quotation</option>
                  {quotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.quote_no} - {q.customer_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="text-sm font-medium">
                Internal Indent
                <select
                  value={indentId}
                  onChange={(event) => setIndentId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="">Select indent</option>
                  {indents.map((indent) => (
                    <option key={indent.id} value={indent.id}>
                      {indent.indent_no} - {indent.project_name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm font-medium">
              Tally Order
              <select
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">No order linked</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.order_no} - {order.customer_name}
                  </option>
                ))}
              </select>
            </label>

            {movementType === "inward" ? (
              <label className="text-sm font-medium">
                Return Condition
                <select
                  value={returnCondition}
                  onChange={(event) => setReturnCondition(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                >
                  <option value="normal">Normal Return</option>
                  <option value="damaged">Damaged Return</option>
                  <option value="scrap">Scrap</option>
                  <option value="repairable">Repairable</option>
                </select>
              </label>
            ) : null}

            <label className="text-sm font-medium">
              Source Location
              <select
                value={sourceLocationId}
                onChange={(event) => setSourceLocationId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Select source</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Destination Location
              <select
                value={destinationLocationId}
                onChange={(event) => setDestinationLocationId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Select destination</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Material
              <select
                value={materialId}
                onChange={(event) => {
                  setMaterialId(event.target.value);
                  setSizeId("");
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Size
              <select
                value={sizeId}
                onChange={(event) => setSizeId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Any size</option>
                {selectedMaterial?.sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Quantity
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </label>

            <label className="text-sm font-medium">
              Destination / Site
              <input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Customer site or yard"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 md:col-span-2"
            >
              Create Movement & Start Scan
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold">AI Scanning</h3>
          <p className="mt-1 text-sm text-slate-500">
            Match under target = count + short beep. At/over quantity = amber warning + different beep. False material = red alert, silent (no count).
          </p>

          {!soundReady ? (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm text-sky-900">
                Tap once to enable beep sounds on this device (required by browsers).
              </p>
              <button
                type="button"
                onClick={async () => {
                  await unlockAudio();
                  setSoundReady(true);
                  playFeedbackTone("match");
                }}
                className="mt-3 rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white"
              >
                Enable Beep Sound
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-emerald-700">Beep sound ready on this device.</p>
              <button
                type="button"
                onClick={() => playFeedbackTone("match")}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium"
              >
                Test Beep
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startScan}
              disabled={!movement}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Start Scan Session
            </button>

            <select
              value={simulateMaterialId}
              onChange={(event) => setSimulateMaterialId(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
            >
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  Manual test: {material.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={simulateScan}
              disabled={!session}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Manual Override
            </button>

            <button
              type="button"
              onClick={completeMovement}
              disabled={!movement}
              className="rounded-xl border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50"
            >
              Complete & Generate DC/GRN
            </button>
          </div>

          {quantityWarning ? (
            <div className="mt-4 rounded-xl border border-amber-400 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Quantity warning</p>
              <p className="mt-1 text-sm text-amber-800">{quantityWarning}</p>
            </div>
          ) : null}

          {session ? (
            <div className="mt-6 space-y-4">
              <ScanFeedbackSignal
                status={scanSignal}
                label={scanSignalLabel}
                onClear={() => {
                  setScanSignal(null);
                  setScanSignalLabel("");
                }}
              />

              <CameraScanner sessionId={session.id} onResult={applyScanResult} />

              {showSizeUpdate && session ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">
                    FRD Case 3: Correct material, different size?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <select
                      value={sizeId}
                      onChange={(event) => setSizeId(event.target.value)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      <option value="">Update to size...</option>
                      {selectedMaterial?.sizes.map((size) => (
                        <option key={size.id} value={size.id}>
                          {size.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateSessionSize(sizeId)}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white"
                    >
                      Update Size & Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSizeUpdate(false)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      Reject — Ask Worker for Correct Size
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {feedback ? (
            <p
              className={`mt-4 text-sm ${
                feedback.includes("failed") ||
                feedback.includes("not running") ||
                feedback.includes("unavailable")
                  ? "text-red-600"
                  : "text-slate-600"
              }`}
            >
              {feedback}
            </p>
          ) : null}

          {session ? (
            <div
              className={`mt-4 grid gap-3 rounded-xl p-4 text-sm md:grid-cols-4 ${
                scanSignal === "match"
                  ? "bg-emerald-50 ring-2 ring-emerald-400"
                  : scanSignal === "mismatch"
                    ? "bg-red-50 ring-2 ring-red-400"
                    : scanProgress?.status === "exceeded" || scanProgress?.status === "reached"
                      ? "bg-amber-50 ring-2 ring-amber-400"
                      : "bg-slate-50"
              }`}
            >
              <p>Expected: {session.material?.name}</p>
              <p className="font-medium text-emerald-700">Matched: {session.matched_count}</p>
              <p className="font-medium text-red-700">Mismatches: {session.mismatch_count}</p>
              <p className="font-medium text-amber-800">
                Progress: {scanProgress?.scanned ?? 0}/{scanProgress?.expected ?? quantity}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </ProtectedPage>
  );
}
