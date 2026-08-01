export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export type MaterialSize = {
  id: number;
  material_id: number;
  label: string;
  rate_per_month?: number | null;
  rate_per_day?: number | null;
  unit?: string;
};

export type Material = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  sizes: MaterialSize[];
};

export type TallyOrder = {
  id: number;
  order_no: string;
  type: "rental" | "project";
  customer_name: string | null;
  site_name: string | null;
  status: string;
};

export type MovementItem = {
  id: number;
  material_id: number;
  material_size_id: number | null;
  quantity: number;
  scanned_count: number;
  material?: Material;
  material_size?: MaterialSize;
};

export type MaterialMovement = {
  id: number;
  type: "inward" | "outward";
  tally_order_id: number | null;
  dc_number: string | null;
  grn_number: string | null;
  linked_dc_number?: string | null;
  destination: string | null;
  status: string;
  notes: string | null;
  due_date?: string | null;
  return_condition?: string | null;
  started_at: string | null;
  completed_at: string | null;
  supervisor?: User;
  tally_order?: TallyOrder;
  items: MovementItem[];
};

export type ScanSession = {
  id: number;
  material_movement_id: number;
  material_id: number;
  material_size_id: number | null;
  status: string;
  matched_count: number;
  mismatch_count: number;
  material?: Material;
  material_size?: MaterialSize;
};

export type ScanDetectionResult = {
  feedback: "match" | "mismatch";
  session: ScanSession;
  detection?: {
    yolo_class?: string;
    material_code?: string;
    confidence?: number;
  };
  message?: string;
  quantity_status?: "ok" | "reached" | "exceeded";
  expected_quantity?: number;
  scanned_count?: number;
};

export type ActiveScanResponse = {
  movement: MaterialMovement | null;
  session: ScanSession | null;
};

export type DashboardStats = {
  today_inward: number;
  today_outward: number;
  active_scans: number;
  mismatches_today: number;
  material_categories: number;
  pending_approvals?: number;
  open_tally_orders?: number;
  dc_today_value?: number;
  grn_today_value?: number;
  dc_total_value?: number;
  grn_total_value?: number;
};
