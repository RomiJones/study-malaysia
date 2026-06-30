import type { FeeAuditStatus, TuitionCurrency } from "@studymy/shared";

export const CNY_PER_MYR = 1.55;

export const FILTERABLE_FEE_AUDIT_STATUSES = [
  "matched-official",
  "fee-sheet-verified",
  "calculated-from-official-rate"
] as const satisfies readonly FeeAuditStatus[];

export const DISPLAY_ONLY_FEE_AUDIT_STATUSES = [
  "official-approximate",
  "official-rate-verified",
  "official-non-scalar",
  "not-published"
] as const satisfies readonly FeeAuditStatus[];

export const REVIEW_REQUIRED_FEE_AUDIT_STATUSES = [
  "pending-review",
  "conflict",
  "source-conflict"
] as const satisfies readonly FeeAuditStatus[];

export type FeeConfidence = "verified" | "display-only" | "unavailable";

export interface ProgramFeeInput {
  officialTuitionMYR?: number | string | null;
  officialFeeAuditStatus?: string | null;
  tuitionDisplay?: string | null;
  listTuitionText?: string | null;
  annualTuitionCny?: number | string | null;
  tuitionAmount?: number | string | null;
  tuitionCurrency?: TuitionCurrency | string | null;
  durationYears?: number | string | null;
}

export interface FeeResolutionResult {
  filterableTuitionCny: number | null;
  displayText: string;
  hasVerifiedFee: boolean;
  confidence: FeeConfidence;
}

export function resolveProgramFee(program: ProgramFeeInput): FeeResolutionResult {
  const status = normalizeFeeAuditStatus(program.officialFeeAuditStatus);
  const displayText = explicitDisplay(program) ?? fallbackDisplay(program);
  const filterableTuitionCny = isFilterableFeeAuditStatus(status) ? trustedAnnualTuitionCny(program) : null;

  if (filterableTuitionCny != null) {
    return {
      filterableTuitionCny,
      displayText,
      hasVerifiedFee: true,
      confidence: "verified"
    };
  }

  return {
    filterableTuitionCny: null,
    displayText,
    hasVerifiedFee: false,
    confidence: status ? "display-only" : "unavailable"
  };
}

export function getFilterableTuitionCny(program: ProgramFeeInput): number | null {
  return resolveProgramFee(program).filterableTuitionCny;
}

export function isFilterableFeeAuditStatus(status: string | null | undefined): status is typeof FILTERABLE_FEE_AUDIT_STATUSES[number] {
  return FILTERABLE_FEE_AUDIT_STATUSES.includes(status as typeof FILTERABLE_FEE_AUDIT_STATUSES[number]);
}

export function formatMYR(amount: number): string {
  return `RM ${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatCnyAnnual(amount: number): string {
  return `CNY ${Math.round(amount).toLocaleString("en-US")} / year`;
}

function trustedAnnualTuitionCny(program: ProgramFeeInput): number | null {
  const annualTuitionCny = positiveNumber(program.annualTuitionCny);
  if (annualTuitionCny != null) return Math.round(annualTuitionCny);

  const tuitionAmount = positiveNumber(program.tuitionAmount);
  const tuitionCurrency = program.tuitionCurrency || null;
  const durationYears = positiveNumber(program.durationYears) ?? 1;
  if (tuitionAmount != null && tuitionCurrency === "CNY") {
    return Math.round(tuitionAmount / Math.max(durationYears, 0.5));
  }
  if (tuitionAmount != null && tuitionCurrency === "MYR") {
    return Math.round((tuitionAmount * CNY_PER_MYR) / Math.max(durationYears, 0.5));
  }

  const officialTuitionMYR = positiveNumber(program.officialTuitionMYR);
  if (officialTuitionMYR != null) {
    return Math.round((officialTuitionMYR * CNY_PER_MYR) / Math.max(durationYears, 0.5));
  }

  return null;
}

function explicitDisplay(program: ProgramFeeInput): string | null {
  return filledString(program.tuitionDisplay) ?? filledString(program.listTuitionText);
}

function fallbackDisplay(program: ProgramFeeInput): string {
  const officialTuitionMYR = positiveNumber(program.officialTuitionMYR);
  if (officialTuitionMYR != null) return formatMYR(officialTuitionMYR);

  const tuitionAmount = positiveNumber(program.tuitionAmount);
  if (tuitionAmount != null && program.tuitionCurrency && program.tuitionCurrency !== "UNKNOWN") {
    return `${program.tuitionCurrency} ${Math.round(tuitionAmount).toLocaleString("en-US")}`;
  }

  const annualTuitionCny = positiveNumber(program.annualTuitionCny);
  if (annualTuitionCny != null) return formatCnyAnnual(annualTuitionCny);

  if (program.officialFeeAuditStatus === "not-published") return "Official fee not published";
  return "Contact university for fee information";
}

function normalizeFeeAuditStatus(status: string | null | undefined): FeeAuditStatus | null {
  if (!status) return null;
  const allowed = [
    ...FILTERABLE_FEE_AUDIT_STATUSES,
    ...DISPLAY_ONLY_FEE_AUDIT_STATUSES,
    ...REVIEW_REQUIRED_FEE_AUDIT_STATUSES
  ] as readonly string[];
  return allowed.includes(status) ? status as FeeAuditStatus : null;
}

function positiveNumber(value: number | string | null | undefined): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function filledString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
