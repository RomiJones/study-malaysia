import type { PlannerProfileEntity } from "../db/entities.js";

export type ApplicationProfileStatus = "complete" | "insufficient" | "missing-language" | "missing-budget" | "missing-contact";

export interface ApplicationProfileSnapshot {
  snapshotAt: string;
  profileVersion?: number;
  level?: string;
  targetCategory?: string;
  budgetCny?: number | null;
  gpa?: number | null;
  ielts?: number | null;
  experience?: string;
  acceptNoLanguage?: boolean;
  contactInfo: Record<string, unknown>;
  academicBackground: Record<string, unknown>;
  languageProfile: Record<string, unknown>;
  studyPreferences: Record<string, unknown>;
  serviceNeeds: Record<string, unknown>;
}

export interface ApplicationProfileSummary {
  completion: number;
  status: ApplicationProfileStatus;
  statusLabel: string;
  missingFields: string[];
  missingLabels: string[];
}

interface SnapshotOptions {
  snapshotAt?: string;
  fallbackContact?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
}

const PROFILE_CHECKS: Array<{ key: string; label: string; check: (snapshot: ApplicationProfileSnapshot | null) => boolean }> = [
  { key: "level", label: "目标学历", check: (snapshot) => hasText(snapshot?.level) },
  { key: "targetCategory", label: "目标专业方向", check: (snapshot) => hasText(snapshot?.targetCategory) },
  { key: "budget", label: "预算范围", check: (snapshot) => Number(snapshot?.budgetCny || 0) > 0 },
  { key: "academicScore", label: "GPA/均分", check: hasAcademicScore },
  { key: "language", label: "语言成绩或考试计划", check: hasLanguagePlan },
  { key: "currentEducation", label: "当前学历", check: (snapshot) => hasText(snapshot?.academicBackground?.currentEducation) },
  { key: "schoolName", label: "毕业/就读院校", check: (snapshot) => hasText(snapshot?.academicBackground?.schoolName) },
  { key: "majorName", label: "所学专业", check: (snapshot) => hasText(snapshot?.academicBackground?.majorName) },
  { key: "intake", label: "计划入学时间", check: (snapshot) => hasText(snapshot?.studyPreferences?.intake) },
  { key: "preferredCities", label: "城市偏好", check: (snapshot) => hasArrayValue(snapshot?.studyPreferences?.preferredCities) },
  { key: "serviceNeeds", label: "服务需求", check: (snapshot) => hasArrayValue(snapshot?.serviceNeeds?.needs) || hasText(snapshot?.serviceNeeds?.notes) },
  { key: "contact", label: "联系方式", check: hasContact }
];
const CRITICAL_PROFILE_FIELDS = new Set(["level", "targetCategory", "budget", "academicScore", "language", "currentEducation", "schoolName", "majorName", "contact"]);

export function buildApplicationProfileSnapshot(profile: PlannerProfileEntity | null | undefined, options: SnapshotOptions = {}): ApplicationProfileSnapshot | null {
  if (!profile) return null;
  const contactInfo = normalizeRecord(profile.contactInfo);
  if (!hasText(contactInfo.fullName) && hasText(options.fallbackContact?.fullName)) contactInfo.fullName = options.fallbackContact?.fullName;
  if (!hasText(contactInfo.phone) && hasText(options.fallbackContact?.phone)) contactInfo.phone = options.fallbackContact?.phone;
  if (!hasText(contactInfo.email) && hasText(options.fallbackContact?.email)) contactInfo.email = options.fallbackContact?.email;

  return {
    snapshotAt: options.snapshotAt || new Date().toISOString(),
    profileVersion: profile.profileVersion,
    level: profile.level,
    targetCategory: profile.targetCategory,
    budgetCny: toNumberOrNull(profile.budgetCny),
    gpa: toNumberOrNull(profile.gpa),
    ielts: toNumberOrNull(profile.ielts),
    experience: profile.experience,
    acceptNoLanguage: profile.acceptNoLanguage,
    contactInfo,
    academicBackground: normalizeRecord(profile.academicBackground),
    languageProfile: normalizeRecord(profile.languageProfile),
    studyPreferences: normalizeRecord(profile.studyPreferences),
    serviceNeeds: normalizeRecord(profile.serviceNeeds)
  };
}

export function summarizeApplicationProfile(snapshot: ApplicationProfileSnapshot | null | undefined): ApplicationProfileSummary {
  const missing = PROFILE_CHECKS.filter((item) => !item.check(snapshot || null));
  const completion = snapshot ? Math.round(((PROFILE_CHECKS.length - missing.length) / PROFILE_CHECKS.length) * 100) : 0;
  const missingFields = missing.map((item) => item.key);
  const missingLabels = missing.map((item) => item.label);
  const status = resolveProfileStatus(completion, missingFields);
  return {
    completion,
    status,
    statusLabel: profileStatusLabel(status),
    missingFields,
    missingLabels
  };
}

export function getApplicationProfileSnapshot(metadata: Record<string, unknown> | null | undefined): ApplicationProfileSnapshot | null {
  const source = readRecord(metadata?.applicationProfileSnapshot) || readRecord(metadata?.applicationProfile) || readRecord(metadata?.studentProfile);
  if (!source) return null;
  return {
    snapshotAt: String(source.snapshotAt || metadata?.studentSubmittedAt || ""),
    profileVersion: toNumberOrUndefined(source.profileVersion),
    level: toStringOrUndefined(source.level),
    targetCategory: toStringOrUndefined(source.targetCategory),
    budgetCny: toNumberOrNull(source.budgetCny),
    gpa: toNumberOrNull(source.gpa),
    ielts: toNumberOrNull(source.ielts),
    experience: toStringOrUndefined(source.experience),
    acceptNoLanguage: typeof source.acceptNoLanguage === "boolean" ? source.acceptNoLanguage : undefined,
    contactInfo: normalizeRecord(source.contactInfo),
    academicBackground: normalizeRecord(source.academicBackground),
    languageProfile: normalizeRecord(source.languageProfile),
    studyPreferences: normalizeRecord(source.studyPreferences),
    serviceNeeds: normalizeRecord(source.serviceNeeds)
  };
}

export function getApplicationProfileSummary(metadata: Record<string, unknown> | null | undefined): ApplicationProfileSummary {
  const storedSummary = readRecord(metadata?.applicationProfileSummary);
  const snapshot = getApplicationProfileSnapshot(metadata);
  const summary = summarizeApplicationProfile(snapshot);
  if (!storedSummary) return summary;
  return {
    ...summary,
    completion: Number.isFinite(Number(storedSummary.completion)) ? Number(storedSummary.completion) : summary.completion,
    status: isProfileStatus(storedSummary.status) ? storedSummary.status : summary.status,
    statusLabel: hasText(storedSummary.statusLabel) ? String(storedSummary.statusLabel) : summary.statusLabel,
    missingFields: Array.isArray(storedSummary.missingFields) ? storedSummary.missingFields.map(String) : summary.missingFields,
    missingLabels: Array.isArray(storedSummary.missingLabels) ? storedSummary.missingLabels.map(String) : summary.missingLabels
  };
}

function resolveProfileStatus(completion: number, missingFields: string[]): ApplicationProfileStatus {
  if (missingFields.includes("contact")) return "missing-contact";
  if (missingFields.includes("language")) return "missing-language";
  if (missingFields.includes("budget")) return "missing-budget";
  if (completion >= 80 && !missingFields.some((field) => CRITICAL_PROFILE_FIELDS.has(field))) return "complete";
  return "insufficient";
}

function profileStatusLabel(status: ApplicationProfileStatus) {
  const labels: Record<ApplicationProfileStatus, string> = {
    complete: "档案完整",
    insufficient: "信息不足",
    "missing-language": "缺语言",
    "missing-budget": "缺预算",
    "missing-contact": "缺联系方式"
  };
  return labels[status];
}

function hasAcademicScore(snapshot: ApplicationProfileSnapshot | null) {
  return Number(snapshot?.gpa || 0) > 0 || hasText(snapshot?.academicBackground?.averageScore);
}

function hasLanguagePlan(snapshot: ApplicationProfileSnapshot | null) {
  const language = snapshot?.languageProfile || {};
  return hasText(language.overallScore) || hasText(language.testDate) || hasText(language.plannedTestDate);
}

function hasContact(snapshot: ApplicationProfileSnapshot | null) {
  const contact = snapshot?.contactInfo || {};
  return hasText(contact.phone) || hasText(contact.wechat) || hasText(contact.whatsapp);
}

function hasArrayValue(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function hasText(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null && String(value).trim().length > 0;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toNumberOrNull(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function toNumberOrUndefined(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function toStringOrUndefined(value: unknown) {
  return value === undefined || value === null ? undefined : String(value);
}

function isProfileStatus(value: unknown): value is ApplicationProfileStatus {
  return value === "complete" || value === "insufficient" || value === "missing-language" || value === "missing-budget" || value === "missing-contact";
}
