export type Role = "admin" | "employee";
export type User = { id: string; email: string; name: string; role: Role; employee_id?: string | null; picture?: string | null };
export type KPI = { id: string; name: string; weight: number; target: number; unit: string };
export type Position = { id: string; name: string; point_value?: number | null; kpis: KPI[] };
export type Employee = {
  id: string; full_name: string; phone: string; email?: string | null; position_id: string; position_name: string;
  hire_date: string; base_salary: number; status: "active" | "inactive";
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
