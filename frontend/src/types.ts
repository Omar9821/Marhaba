export type Role = "admin" | "inspector" | "employee";
export type User = { id: string; email: string; name: string; role: Role; employee_id?: string | null; picture?: string | null };
export type KPI = { id: string; name: string; weight: number; target: number; unit: string };
export type Position = { id: string; name: string; point_value?: number | null; kpis: KPI[] };
export type Employee = {
  id: string; full_name: string; phone: string; email?: string | null; position_id: string; position_name: string;
  hire_date: string; base_salary: number; status: "active" | "inactive";
  perf_type?: PerfType; post_weight?: number | null;
};
export type InfType = { id: string; name: string; deduction_type: "points" | "percent" | "amount"; value: number; active: boolean };
export type Infraction = { id: string; employee_id: string; type_id: string; date: string; note: string };
export type Settings = {
  currency: string; bonus_mode: "points" | "salary"; point_value: number; multiplier: number; salary_rate: number;
  max_ratio: number; bonus_cap: number; fund_percent: number; competitive_percent: number; competitive_winners: number;
  max_infractions: number; min_score: number;
};
export type Report = {
  month: string; currency?: string;
  employee: { id: string; full_name: string; position_name: string; base_salary: number; status: string };
  kpis: { kpi_id: string; name: string; unit: string; weight: number; target: number; achieved: number; ratio: number; weighted: number }[];
  daily: { date: string; score: number }[]; days_recorded: number;
  score: number; points_deduction: number; effective_score: number; point_value: number; multiplier: number; bonus_mode: string;
  gross_bonus: number; percent_deduction: number; percent_amount: number; amount_deduction: number;
  infractions: { id: string; date: string; type_id: string; type_name: string; deduction_type: string; value: number; note: string }[];
  infractions_count: number; capped: boolean; eligible: boolean; ineligible_reason: string | null;
  net_bonus: number; fund_share: number; competitive_bonus: number; final_bonus: number;
};
export type CompanyReport = {
  month: string; settings: Settings; employees: Report[];
  totals: { employees: number; final_bonus: number; avg_score: number; infractions: number; fund_pool: number; competitive_pool: number; recreation_fund: number; base_salaries: number };
};

// ---- جدول الأداء والمردودية (نموذج Excel) ----
export type PerfType = "commercial" | "finance" | "cutting" | "pool";
export const PERF_TYPE_LABEL: Record<PerfType, string> = { commercial: "تجاري", finance: "مالية", cutting: "تقطيع", pool: "عامل (مجمَّع)" };
export const PERF_BASE_LABEL: Record<PerfType, string> = {
  commercial: "رقم الأعمال المحصَّل الصافي (دج)", finance: "المبالغ المستردة (دج)", cutting: "الأمتار المقطوعة (متر)", pool: "",
};
export type SheetParams = {
  pass_threshold: number; w_hygiene: number; w_respect: number; loss_limit: number; w_loss: number; days_limit: number; w_days: number;
  rate_commercial: number; share_commercial: number; rate_finance: number; share_finance: number; price_meter: number; share_cutting: number;
  fund_ratio: number; pool_rate: number;
  violation_map?: Record<string, ImpactGroup>; violation_types?: { code: string; label: string }[];
};
export type ImpactGroup = "days" | "hygiene" | "respect" | "none";
export const IMPACT_LABEL: Record<ImpactGroup, string> = { days: "التأخرات والغيابات", hygiene: "الهندام والنظافة", respect: "الاحترام", none: "لا يؤثر" };
export type SheetRow = {
  id: string; name: string; perf_type: PerfType; post_weight: number | null;
  hygiene: number | null; respect: "نعم" | "لا" | null; losses: number | null; days: number | null; base: number | null; violations: number;
  hits?: { days: number; hygiene: number; respect: number };
  c: number | null; e: number | null; g: number | null; i: number | null; q: number | null; r: number | null;
  s: number | null; t: number | null; u: number | null; status: string;
};
export type Sheet = {
  month: string; params: SheetParams; turnover: number | null; pool: number | null; pool_weights: number; rows: SheetRow[];
  totals: { gross: number; payable: number; gap: number; fund: number; company_keeps: number } | null;
};
export type ViolationRow = { employee_id: string; name: string; counts: Record<string, number>; note: string; follow_date: string; total: number };
export type ViolationLog = {
  month: string; rows: ViolationRow[]; types: { code: string; label: string }[]; by_type: { code: string; label: string; count: number }[];
  total: number; employees_with: number; expected_alerts: number; alert_threshold: number;
};
