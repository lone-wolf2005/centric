import type { MaterialMovement, ScanSession } from "@/lib/types";

export type ScanProgress = {
  expected: number;
  scanned: number;
  status: "ok" | "reached" | "exceeded";
};

export function getScanProgress(
  movement: MaterialMovement | null,
  session: ScanSession | null,
): ScanProgress | null {
  if (!movement || !session) {
    return null;
  }

  const item = movement.items.find(
    (entry) =>
      entry.material_id === session.material_id &&
      (session.material_size_id
        ? entry.material_size_id === session.material_size_id
        : true),
  );

  const expected = item?.quantity ?? 0;
  const scanned = item?.scanned_count ?? session.matched_count;

  let status: ScanProgress["status"] = "ok";
  if (expected > 0) {
    if (scanned > expected) {
      status = "exceeded";
    } else if (scanned >= expected) {
      status = "reached";
    }
  }

  return { expected, scanned, status };
}
