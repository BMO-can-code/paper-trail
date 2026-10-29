export type Source = {
  id: string;
  url: string;
  title: string;
  chars: number;
  fetchedAt: string;
  mock?: boolean;
};

export type Claim = {
  id: string;
  text: string;
  sourceId: string;
  quote: string;
  context: string;
  verifiedAt: string;
};

export type TraceStep = {
  id: string;
  index: number;
  kind: "phase" | "model" | "tool" | "verdict" | "error";
  title: string;
  detail?: string;
  status: "running" | "ok" | "rejected" | "error";
  ms?: number;
  tokensIn?: number;
  tokensOut?: number;
  tokensEstimated?: boolean;
  tool?: string;
  args?: unknown;
  result?: string;
};

export type BriefMeta = {
  model: string;
  provider: string;
  baseUrl: string;
  iterations: number;
  toolCalls: number;
  tavilyCalls: number;
  modelMs: number;
  totalMs: number;
  tokensIn: number;
  tokensOut: number;
  tokensEstimated: boolean;
  mock: boolean;
  createdAt: string;
};

export type Brief = {
  id: string;
  question: string;
  title: string;
  summary: string;
  claims: Claim[];
  sources: Source[];
  trace: TraceStep[];
  meta: BriefMeta;
};

export type RunEvent =
  | { type: "start"; runId: string; mock: boolean; model: string }
  | { type: "phase"; label: string }
  | { type: "delta"; text: string }
  | { type: "step"; step: TraceStep }
  | { type: "step_update"; id: string; patch: Partial<TraceStep> }
  | { type: "brief"; brief: Brief; permalink?: string }
  | { type: "error"; message: string; hint?: string };
