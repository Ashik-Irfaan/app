import { storage } from "@/src/utils/storage";

export const TOKEN_KEY = "mindwell_token";
const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; auth?: boolean };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data?.detail;
    const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg ?? "Request failed" : "Request failed";
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export type Role = "personnel" | "therapist";
export type RiskLevel = "low" | "medium" | "high";

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string | null;
  service_id?: string | null;
  unit?: string | null;
  consent: boolean;
  wearable: { connected: boolean; device?: string | null };
  anon_id?: string;
}

export interface Factor {
  id: string;
  label: string;
  category: string;
  contribution: number;
  severity: number;
  answer: string;
}

export interface AssessmentSummary {
  id: string;
  score: number;
  level: RiskLevel;
  top_factors: Factor[];
  heart_rate?: number | null;
  created_at: string;
}

export interface RiskResult {
  id: string;
  created_at: string;
  score: number;
  level: RiskLevel;
  top_factors: Factor[];
  all_factors: Factor[];
  heart_rate_note?: string | null;
  title: string;
  summary: string;
  actions: string[];
  pathway: string;
  model: string;
  alert_created?: boolean;
}

export interface WearableReading {
  heart_rate: number;
  hrv_ms: number;
  sleep_hours: number;
  steps: number;
  status: "normal" | "moderate" | "elevated";
  trend: number[];
}

export interface WearableState {
  connected: boolean;
  device?: string | null;
  reading?: WearableReading | null;
}

export interface Dashboard {
  user: User;
  latest: AssessmentSummary | null;
  history: AssessmentSummary[];
  today: { sleep: string; workload: string; mood: string } | null;
  wearable: WearableState;
  support_requested: boolean;
}

export interface Question {
  id: string;
  category: string;
  text: string;
  options: string[];
  label: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface PersonnelSummary {
  anon_id: string;
  user_ref: string;
  unit?: string | null;
  score: number;
  level: RiskLevel;
  trend: "rising" | "improving" | "stable";
  last_assessed: string;
  top_factors: Factor[];
  has_open_alert: boolean;
  wearable_connected: boolean;
}

export interface Overview {
  counts: Record<RiskLevel, number>;
  total: number;
  open_alerts: number;
  followed_up: number;
  personnel: PersonnelSummary[];
}

export interface Alert {
  id: string;
  anon_id: string;
  user_ref: string;
  unit?: string | null;
  score: number | null;
  level: string;
  status: "open" | "followed_up";
  source: string;
  top_factors: Factor[];
  created_at: string;
  followup_note?: string | null;
  followed_up_at?: string | null;
}

export interface PersonnelDetail {
  anon_id: string;
  unit?: string | null;
  wearable_connected: boolean;
  history: AssessmentSummary[];
  top_factors: Factor[];
  alerts: { id: string; status: string; score: number | null; created_at: string; followup_note?: string | null }[];
}
