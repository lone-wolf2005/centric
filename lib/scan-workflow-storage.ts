const STORAGE_KEY = "centric_active_scan";

export type PersistedScanWorkflow = {
  movementId: number;
  sessionId: number;
  workflowType: "customer" | "internal";
  movementType: "inward" | "outward";
  materialId: string;
  sizeId: string;
  orderId: string;
  quotationId: string;
  indentId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  returnCondition: string;
  quantity: string;
  destination: string;
};

export function saveScanWorkflow(state: PersistedScanWorkflow): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadScanWorkflow(): PersistedScanWorkflow | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedScanWorkflow;
  } catch {
    return null;
  }
}

export function clearScanWorkflow(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}
