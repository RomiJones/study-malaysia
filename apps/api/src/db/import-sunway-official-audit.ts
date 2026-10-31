import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, type DeepPartial, type EntityManager } from "typeorm";
import {
  QS_WORLD_RANKING_NAME,
  QS_WORLD_RANKING_YEAR,
  type DegreeLevel,
  type FeeAuditStatus,
  type LanguageRequirement,
  type LocalizedStringArray,
  type LocalizedText,
  type OfficialSourceLink,
  type OfficialSourceStatus,
  type ProgramCategoryCode,
  type PublicDisplayStatus,
  type TuitionCurrency
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX = "sunway-official-2026-row-";
export const DEFAULT_SUNWAY_OFFICIAL_AUDIT_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/sunway/2026-06-20/sunway-20260620/08_candidate_dataset.json"
);
export const DEFAULT_SUNWAY_REVIEW_IMPORT_REPORT_PATH = resolve(
  repositoryRoot,
  "data/imports/sunway/2026-06-20/sunway-20260620/18_review_import_report.json"
);
export const DEFAULT_SUNWAY_PUBLISH_REPORT_PATH = resolve(
  repositoryRoot,
  "data/imports/sunway/2026-06-20/sunway-20260620/20_publish_report.json"
);

const verifiedAt = "2026-06-21";
const officialDomains = ["sunwayuniversity.edu.my", "studyonline.sunwayuniversity.edu.my"];
const visibleProgramStatuses: PublicDisplayStatus[] = ["ready", "current-cycle-not-open", "not-available-for-international"];
const sunwayQsWorld2027 = {
  name: QS_WORLD_RANKING_NAME,
  year: QS_WORLD_RANKING_YEAR,
  status: "ranked",
  context: "malaysia-institution",
  rankDisplay: "=354",
  rankSort: 354,
  officialSortRank: 356,
  overallScore: "41.5",
  sourceUrl: "https://www.topuniversities.com/world-university-rankings?countries=my",
  profileUrl: "https://www.topuniversities.com/universities/sunway-university",
  qsTitle: "Sunway University",
  qsCountry: "Malaysia",
  qsCity: "Kuala Lumpur",
  publishedAt: "2026-06-18",
  retrievedAt: "2026-06-19T00:00:00+08:00"
} as const;

const sunwayFacultyZhMap: Record<string, { zhCN: string; zhTW: string }> = {
  "Faculty of Arts and Social Sciences": { zhCN: "艺术与社会科学学院", zhTW: "藝術與社會科學學院" },
  "Faculty of Engineering and Technology": { zhCN: "工程与技术学院", zhTW: "工程與技術學院" },
  "Faculty of Medical and Life Sciences": { zhCN: "医学与生命科学学院", zhTW: "醫學與生命科學學院" },
  "Jeffrey Sachs Center On Sustainable Development": { zhCN: "杰弗里·萨克斯可持续发展中心", zhTW: "傑弗里·薩克斯可持續發展中心" },
  "School of American Education - Transfer Globally": { zhCN: "美国教育学院", zhTW: "美國教育學院" },
  "School of Education": { zhCN: "教育学院", zhTW: "教育學院" },
  "School of Hospitality and Tourism Management": { zhCN: "酒店与旅游管理学院", zhTW: "酒店與旅遊管理學院" },
  "School of Mathematical Sciences": { zhCN: "数学科学学院", zhTW: "數學科學學院" },
  "Sunway Business School": { zhCN: "双威商学院", zhTW: "雙威商學院" }
};

const sunwayProgramNameZhMap: Record<string, string> = {
  "BA (Hons) in Communication": "传播学文学荣誉学士",
  "Bachelor (Honours) in Finance": "金融荣誉学士",
  "Bachelor in Digital Communication (Advertising) with Honors": "数字传播（广告）荣誉学士",
  "Bachelor in Digital Media Design with Honors": "数字媒体设计荣誉学士",
  "Bachelor of Applied Behaviour Analysis": "应用行为分析学士",
  "Bachelor of Arts (Honors) Global Management": "全球管理文学荣誉学士",
  "Bachelor of Arts (Honours) Contemporary Music (Audio Technology)": "当代音乐（音频技术）文学荣誉学士",
  "Bachelor of Arts (Honours) Design Communication": "设计传播文学荣誉学士",
  "Bachelor of Arts (Honours) Digital Film Production": "数字电影制作文学荣誉学士",
  "Bachelor of Arts (Honours) Entrepreneurship": "创业学文学荣誉学士",
  "Bachelor of Arts (Honours) Music Performance": "音乐表演文学荣誉学士",
  "Bachelor of Arts (Honours) in Advertising and Branding": "广告与品牌传播文学荣誉学士",
  "Bachelor of Arts (Honours) in Architecture": "建筑学文学荣誉学士",
  "Bachelor of Arts (Honours) in Digital Media Communication": "数字媒体传播文学荣誉学士",
  "Bachelor of Arts (Honours) in Interior Architecture": "室内建筑文学荣誉学士",
  "Bachelor of Arts (Honours) in Theatre Production": "戏剧制作文学荣誉学士",
  "Bachelor of Arts in Psychology (Honors)": "心理学文学荣誉学士",
  "Bachelor of Business Analytics (Honours)": "商业分析荣誉学士",
  "Bachelor of Chemical Engineering with Honours": "化学工程荣誉学士",
  "Bachelor of Civil Engineering with Honours": "土木工程荣誉学士",
  "Bachelor of Electronic and Electrical Engineering with Honours": "电子与电气工程荣誉学士",
  "Bachelor of Information Systems (Honours) (Data Analytics)": "信息系统（数据分析）荣誉学士",
  "Bachelor of Mechanical Engineering with Honours": "机械工程荣誉学士",
  "Bachelor of Mechatronic Engineering (Robotics) with Honours": "机电工程（机器人）荣誉学士",
  "Bachelor of Nursing (Honours)": "护理学荣誉学士",
  "Bachelor of Science (Hons) in Accounting and Finance": "会计与金融理学荣誉学士",
  "Bachelor of Science (Hons) in Actuarial Studies": "精算学理学荣誉学士",
  "Bachelor of Science (Honors) Computer Science (Artificial Intelligence)": "计算机科学（人工智能）理学荣誉学士",
  "Bachelor of Science (Honours) Biomedicine": "生物医学理学荣誉学士",
  "Bachelor of Science (Honours) Financial Analysis": "金融分析理学荣誉学士",
  "Bachelor of Science (Honours) Financial Economics": "金融经济学理学荣誉学士",
  "Bachelor of Science (Honours) Global Supply Chain Management": "全球供应链管理理学荣誉学士",
  "Bachelor of Science (Honours) Marketing": "市场营销理学荣誉学士",
  "Bachelor of Science (Honours) in Artificial Intelligence": "人工智能理学荣誉学士",
  "Bachelor of Science (Honours) in Business Management": "商业管理理学荣誉学士",
  "Bachelor of Science (Honours) in Business Studies": "商业研究理学荣誉学士",
  "Bachelor of Science (Honours) in Computer Science": "计算机科学理学荣誉学士",
  "Bachelor of Science (Honours) in Conventions and Events Management": "会展与活动管理理学荣誉学士",
  "Bachelor of Science (Honours) in Culinary Management": "烹饪管理理学荣誉学士",
  "Bachelor of Science (Honours) in Food Innovation": "食品创新理学荣誉学士",
  "Bachelor of Science (Honours) in Information Technology": "信息技术理学荣誉学士",
  "Bachelor of Science (Honours) in International Business": "国际商务理学荣誉学士",
  "Bachelor of Science (Honours) in International Hospitality Management": "国际酒店管理理学荣誉学士",
  "Bachelor of Science (Honours) in Psychology": "心理学理学荣誉学士",
  "Bachelor of Science (Honours) in Statistical Data Modelling": "统计数据建模理学荣誉学士",
  "Bachelor of Software Engineering (Hons)": "软件工程荣誉学士",
  "BSc (Hons) Information Technology (Computer Networking and Security)": "信息技术（计算机网络与安全）理学荣誉学士",
  "BSc (Hons) Medical Biotechnology": "医学生物技术理学荣誉学士",
  "Doctor of Business Administration": "工商管理博士",
  "Doctor of Computing": "计算学博士",
  "Doctor of Education": "教育博士",
  "Doctor of Engineering": "工程博士",
  "Doctor of Medicine (MD)": "医学博士（MD）",
  "Doctor of Philosophy (Business)": "商学哲学博士",
  "Doctor of Philosophy (Computing)": "计算学哲学博士",
  "Doctor of Philosophy in Biology": "生物学哲学博士",
  "Doctor of Philosophy in Creative Arts and Media": "创意艺术与媒体哲学博士",
  "Doctor of Philosophy in Education": "教育学哲学博士",
  "Doctor of Philosophy in Hospitality and Tourism": "酒店与旅游管理哲学博士",
  "Doctor of Philosophy in Mathematical Sciences": "数学科学哲学博士",
  "Doctor of Philosophy in Medical Science": "医学科学哲学博士",
  "Doctor of Philosophy in Nursing": "护理学哲学博士",
  "Doctor of Philosophy in Psychology": "心理学哲学博士",
  "Doctor of Philosophy in Sustainability Science and Engineering": "可持续科学与工程哲学博士",
  "Doctor of Philosophy in Sustainable Development": "可持续发展哲学博士",
  "Master in Advanced Computing": "高级计算硕士",
  "Master in Artificial Intelligence": "人工智能硕士",
  "Master in Data Science": "数据科学硕士",
  "Master in Digital Engineering": "数字工程硕士",
  "Master in International Hospitality Management": "国际酒店管理硕士",
  "Master in Medical Science": "医学科学硕士",
  "Master in Nursing": "护理学硕士",
  "Master in Sustainable Development Management": "可持续发展管理硕士",
  "Master of Applied Behaviour Analysis": "应用行为分析硕士",
  "Master of Arts in Communication": "传播学文学硕士",
  "Master of Arts in Creative Arts and Media": "创意艺术与媒体文学硕士",
  "Master of Arts in Visual Communication and Media Studies": "视觉传播与媒体研究文学硕士",
  "Master of Business Administration": "工商管理硕士",
  "Master of Business Analytics": "商业分析硕士",
  "Master of Counselling": "咨询硕士",
  "Master of Education": "教育硕士",
  "Master of Finance": "金融硕士",
  "Master of Human Resource Management": "人力资源管理硕士",
  "Master of Management": "管理学硕士",
  "Master of Marketing": "市场营销硕士",
  "Master of Philosophy (Business Administration)": "工商管理哲学硕士",
  "Master of Science in Actuarial Analytics": "精算分析理学硕士",
  "Master of Science in Applied Mathematics": "应用数学理学硕士",
  "Master of Science in Computer Science": "计算机科学理学硕士",
  "Master of Science in Life Sciences": "生命科学理学硕士",
  "Master of Science in Mathematical Sciences": "数学科学理学硕士",
  "Master of Science in Psychology": "心理学理学硕士",
  "Masters of Counselling (Clinical Mental Health)": "咨询硕士（临床心理健康）"
};

type SunwayLevel = Extract<DegreeLevel, "bachelor" | "master" | "phd">;

interface SunwayLocalizedText extends Partial<LocalizedText> {
  status?: string;
  reviewReason?: string;
}

interface SunwayLocalizedArray extends Partial<LocalizedStringArray> {
  status?: string;
  reviewReason?: string;
}

interface SunwayFee {
  label?: string;
  raw?: string;
  note?: string;
  malaysian?: { currency?: string; amountText?: string; scope?: string } | null;
  internationalUsdIndicative?: { currency?: string; amountText?: string; scope?: string; isIndicative?: boolean } | null;
  onlineProgrammeRm?: { currency?: string; amountText?: string; scope?: string; isInternationalScopeExplicit?: boolean } | null;
  enrolmentFeeRm?: { currency?: string; amountText?: string; scope?: string } | null;
  basis?: string;
  paymentNote?: string;
  publicDisplayText?: string;
  status?: "needs-review" | "official-unpublished" | "official-rate-only" | "official-value" | string;
  reviewReason?: string;
}

interface SunwayFieldEvidence {
  field?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourceText?: string;
  sha256?: string;
  confidence?: number;
}

interface SunwayApplicationDocuments {
  status?: "general-rule" | "official-value" | string;
  officialText?: string;
  sourceId?: string;
  sourceUrl?: string;
  sha256?: string;
  provenance?: string;
}

interface SunwayCourseSetting {
  status?: string;
  groups?: Array<{ group?: string; items?: string[] }>;
  officialText?: string;
}

interface SunwayCareerDirections {
  status?: string;
  items?: string[];
  officialText?: string;
}

interface SunwayCandidateProgramme {
  code: string;
  universityCode: "SUNWAY";
  nameEnOfficial: string;
  name?: SunwayLocalizedText;
  level: SunwayLevel;
  facultyEn: string;
  faculty?: SunwayLocalizedText;
  categoryEn?: string;
  campus?: string;
  studyMode?: string;
  studyType?: string;
  studyArrangement?: string[] | string;
  applicantScope?: "international" | string;
  internationalEligibility?: { status?: string; evidence?: string };
  academicSession?: string;
  durationOfficial?: string;
  intake?: { officialText?: string; months?: string[] };
  fee?: SunwayFee;
  officialAcademicRequirement?: string;
  officialLanguageRequirement?: string;
  language?: { officialText?: string; tests?: Record<string, string> | null; status?: string };
  applicationDocuments?: SunwayApplicationDocuments;
  description?: SunwayLocalizedText;
  courseSetting?: SunwayCourseSetting;
  careerDirections?: SunwayCareerDirections;
  recognition?: { status?: string; officialText?: string };
  officialSourceUrl?: string;
  sourceUrls?: string[];
  officialVerifiedAt?: string;
  officialSourceStatus?: string;
  publicDisplayStatus?: string;
  reviewReason?: string;
  fieldEvidence?: SunwayFieldEvidence[];
}

export interface SunwayImportOptions {
  publish?: boolean;
}

export interface SunwayCandidateDataset {
  schemaVersion: number;
  universityCode: "SUNWAY";
  officialDomains: string[];
  collectionScope: "full";
  levels: SunwayLevel[];
  applicantScope: "international";
  academicSession: string;
  retrievedAt: string;
  university: {
    code: "SUNWAY";
    nameEnOfficial: string;
    name?: SunwayLocalizedText;
    officialWebsite: string;
    officialAddress?: string;
    internationalPageUrl?: string;
    applicationPortalUrl?: string;
    officialVerifiedAt?: string;
    officialSourceStatus?: string;
    publicDisplayStatus?: string;
    auditNote?: string;
  };
  programmes: SunwayCandidateProgramme[];
}

export interface SunwayImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<SunwayLevel, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  pendingFeeRows: number;
  notPublishedFeeRows: number;
  officialDurationRows: number;
  officialIntakeRows: number;
  officialLanguageRows: number;
  officialIeltsRows: number;
  noOfficialIeltsRows: number;
  minIelts: number;
  academicRequirementRows: number;
  applicationDocumentRows: number;
  courseSettingRows: number;
  careerRows: number;
  sourceLinkedRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface SunwayVisibilitySnapshot {
  exists: boolean;
  id: number | null;
  slug: string | null;
  code: string | null;
  isPublished: boolean;
  publicDisplayStatus: PublicDisplayStatus | null;
  publicProgrammeCount: number;
  publicDetailRouteAccessible: boolean;
}

export interface SunwayImportVerification extends SunwayImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  importedPublicRows: number;
  importedPublicLeakageRows: number;
  importedNeedsReviewRows: number;
  legacyPublicRows: number;
  legacyActiveRows: number;
  publicProgrammeCount: number;
  publicDetailRouteAccessible: boolean;
}

const t = (en: string, ms = en, zhCN = en, zhTW = zhCN): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const arr = (en: string[], ms = en, zhCN = en, zhTW = zhCN): LocalizedStringArray => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const emptyLevelCounts = (): Record<SunwayLevel, number> => ({ bachelor: 0, master: 0, phd: 0 });

export function validateSunwayOfficialAuditDataset(dataset: SunwayCandidateDataset): string[] {
  const errors: string[] = [];
  if (dataset.universityCode !== "SUNWAY") errors.push("Dataset universityCode must be SUNWAY.");
  if (!Array.isArray(dataset.programmes)) errors.push("Dataset programmes must be an array.");
  if (dataset.programmes?.length !== 97) errors.push(`Expected 97 Sunway candidate programmes, found ${dataset.programmes?.length || 0}.`);
  for (const domain of officialDomains) {
    if (!dataset.officialDomains?.includes(domain)) errors.push(`Missing official domain ${domain}.`);
  }

  const seenCodes = new Set<string>();
  dataset.programmes?.forEach((row, index) => {
    const ordinal = index + 1;
    if (!row.code) errors.push(`Row ${ordinal} has no code.`);
    if (seenCodes.has(row.code)) errors.push(`Duplicate Sunway code ${row.code}.`);
    seenCodes.add(row.code);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!sunwayProgramNameZhMap[row.nameEnOfficial]) errors.push(`Row ${ordinal} has no Sunway Chinese programme name mapping.`);
    if (!["bachelor", "master", "phd"].includes(row.level)) errors.push(`Row ${ordinal} has unsupported level ${row.level}.`);
    if (!["ready", "needs-review"].includes(row.publicDisplayStatus || "")) errors.push(`Row ${ordinal} must be ready or needs-review before review import.`);
    if (!row.officialSourceUrl || !isOfficialSunwayUrl(row.officialSourceUrl)) errors.push(`Row ${ordinal} has invalid officialSourceUrl ${row.officialSourceUrl || ""}.`);
    if (!normalizeText(row.durationOfficial)) errors.push(`Row ${ordinal} has no official duration.`);
    if (!normalizeText(row.officialAcademicRequirement)) errors.push(`Row ${ordinal} has no official academic requirement.`);
    if (!normalizeText(row.officialLanguageRequirement || row.language?.officialText)) errors.push(`Row ${ordinal} has no official language requirement.`);
    if (!row.applicationDocuments?.sourceUrl || !isOfficialSunwayUrl(row.applicationDocuments.sourceUrl)) errors.push(`Row ${ordinal} has no official application document source.`);
    if (!["official-rate-only", "official-value", "official-unpublished", "needs-review"].includes(row.fee?.status || "")) {
      errors.push(`Row ${ordinal} has unsupported fee status ${row.fee?.status || ""}.`);
    }
  });

  const levelCounts = countBy(dataset.programmes || [], (row) => row.level);
  if (levelCounts.bachelor !== 48) errors.push(`Expected 48 bachelor rows, found ${levelCounts.bachelor || 0}.`);
  if (levelCounts.master !== 33) errors.push(`Expected 33 master rows, found ${levelCounts.master || 0}.`);
  if (levelCounts.phd !== 16) errors.push(`Expected 16 phd rows, found ${levelCounts.phd || 0}.`);
  return errors;
}

export function buildSunwayOfficialAuditRows(
  dataset: SunwayCandidateDataset,
  options: SunwayImportOptions = {}
): Array<DeepPartial<ProgramEntity>> {
  const publish = Boolean(options.publish);
  return dataset.programmes.map((candidate, index) => {
    const ordinal = index + 1;
    const fee = feePresentation(candidate);
    const sourceLinks = buildSourceLinks(candidate, fee, options);
    const curriculum = courseSettingItems(candidate, options);
    const careers = careerItems(candidate, options);
    const officialLanguageRequirement = normalizeLongText(candidate.officialLanguageRequirement || candidate.language?.officialText || "");
    const sourceStatus: OfficialSourceStatus = publish ? "official-verified" : "needs-review";
    const publicDisplayStatus: PublicDisplayStatus = publish ? "ready" : "needs-review";

    return {
      slug: `${SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: normalizeText(candidate.code, 50),
      name: programNameText(candidate),
      nameEnOfficial: candidate.nameEnOfficial,
      level: candidate.level,
      category: inferCategory(candidate),
      faculty: facultyText(candidate),
      facultyZh: facultyText(candidate)["zh-CN"],
      studyMode: studyModeDisplay(candidate),
      campus: normalizeText(candidate.campus || "Sunway City, Kuala Lumpur / Bandar Sunway, Selangor", 120),
      durationYears: parseDurationYears(candidate.durationOfficial || ""),
      durationOfficial: normalizeText(candidate.durationOfficial || "Official duration captured in Sunway audit batch.", 500),
      annualTuitionCny: 0,
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: fee.officialMyr,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: parseIntakeMonths(candidate.intake?.officialText || (candidate.intake?.months || []).join(", ")),
      officialIntake: normalizeText(candidate.intake?.officialText || "", 255),
      officialIntakeNote: candidate.intake?.officialText
        ? publish
          ? "Captured from the current Sunway official programme page."
          : "Captured from the current Sunway official programme page; remains review-only before public display."
        : publish
          ? "Sunway official programme page did not publish a specific intake value in this audit batch."
          : "Sunway official programme page did not publish a specific intake value in this audit batch.",
      languageRequirement: parseLanguageRequirement(candidate),
      officialLanguageRequirement,
      requirement: {
        gpa: extractCgpaRequirement(candidate.officialAcademicRequirement || ""),
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          normalizeText(candidate.officialAcademicRequirement || "Official academic requirement captured in Sunway audit batch.", 900),
          normalizeText(candidate.officialAcademicRequirement || "Official academic requirement captured in Sunway audit batch.", 900),
          publish
            ? "双威大学官方学术要求已按官方专业页面采集；最终录取资格以学校评估为准。"
            : "双威大学官方学术要求已采集；公开展示前仍需完成中文本地化与人工校对。",
          publish
            ? "雙威大學官方學術要求已按官方專業頁面採集；最終錄取資格以學校評估為準。"
            : "雙威大學官方學術要求已採集；公開展示前仍需完成中文本地化與人工校對。"
        )
      },
      officialAcademicRequirement: normalizeLongText(candidate.officialAcademicRequirement || ""),
      chinaStudentRequirement: publish
        ? "双威大学通过官方专业页面和申请页面公布国际申请要求；中国学生学历等值认定由学校招生流程评估。"
        : "China-specific route is not separately confirmed in the Sunway official audit batch; keep as needs-review before public display.",
      specialRequirementsNote: specialRequirementsNote(candidate, options),
      applicationDocs: applicationDocuments(candidate, options),
      curriculum,
      careers,
      specializations: arr([]),
      description: descriptionText(candidate, options),
      officialAccreditationNote: normalizeText(
        candidate.recognition?.officialText ||
          (publish
            ? "No programme-level accreditation claim is published without a dedicated official source."
            : "No programme-level accreditation claim is published from this review-only row without separate review."),
        1000
      ),
      officialSourceUrl: candidate.officialSourceUrl || "",
      officialEntryRequirementSourceUrl: candidate.officialSourceUrl || "",
      officialAccreditationSourceUrl: candidate.officialSourceUrl || "",
      sourceUrls: sourceLinks,
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: publish
        ? "已依据双威大学官方来源核验并上线；双威未公布的费用字段按“官方未公布”展示，不推断金额。"
        : "Review-only database import. Hidden from public catalogue until Ian explicitly approves publication.",
      reviewReason: publish ? null : reviewReasonText(candidate, fee),
      auditNote: publish
        ? null
        : [
            `Original Sunway candidate code: ${candidate.code}.`,
            `Study type: ${candidate.studyType || "not captured"}; study arrangement: ${formatArrangement(candidate.studyArrangement) || "not captured"}.`,
            `International eligibility state: ${candidate.internationalEligibility?.status || "needs-review"}.`,
            `Fee candidate status: ${candidate.fee?.status || "needs-review"}; fee evidence: ${normalizeText(candidate.fee?.raw || candidate.fee?.reviewReason || "", 1200)}.`,
            `Application document source: ${candidate.applicationDocuments?.sourceUrl || "not captured"}.`,
            `Field evidence count: ${(candidate.fieldEvidence || []).length}.`
          ].join(" "),
      listTuitionText: fee.display,
      isPublished: publish
    };
  });
}

export function buildSunwayUniversityRow(
  dataset: SunwayCandidateDataset,
  summary: SunwayImportSummary,
  options: SunwayImportOptions = {}
): DeepPartial<UniversityEntity> {
  const publish = Boolean(options.publish);
  const sourceStatus: OfficialSourceStatus = publish ? "official-verified" : "needs-review";
  const publicDisplayStatus: PublicDisplayStatus = publish ? "ready" : "needs-review";
  const readyRows = publish ? summary.readyRows : 0;
  const reviewRows = publish ? 0 : summary.needsReviewRows;
  const sources: OfficialSourceLink[] = [
    {
      title: "Sunway University official website",
      url: dataset.university.officialWebsite,
      sourceType: "official-website",
      verifiedAt,
      status: sourceStatus,
      note: publish ? "Institution authority verified for public display." : "Institution authority captured in the Sunway review-only import."
    },
    {
      title: "Sunway international admissions",
      url: dataset.university.internationalPageUrl || `${dataset.university.officialWebsite}/international`,
      sourceType: "admission",
      verifiedAt,
      status: sourceStatus,
      note: publish ? "International applicant route verified for public display." : "International applicant route captured for review."
    },
    {
      title: "Sunway apply page",
      url: dataset.university.applicationPortalUrl || `${dataset.university.officialWebsite}/apply`,
      sourceType: "admission",
      verifiedAt,
      status: sourceStatus,
      note: publish ? "Application route verified for public display." : "Application route captured for review."
    }
  ];

  return {
    slug: "sunway-university",
    code: "SUNWAY",
    name: localizedText(dataset.university.name, dataset.university.nameEnOfficial),
    shortName: "Sunway",
    logoUrl: "",
    imageUrl: "",
    color: "#D71920",
    qsRank: sunwayQsWorld2027.rankSort,
    qsAsiaRank: null,
    location: t("Bandar Sunway, Selangor", "Bandar Sunway, Selangor", "雪兰莪双威城", "雪蘭莪雙威城"),
    region: t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 0,
    students: 0,
    intlStudents: 0,
    csrCertified: false,
    description: publish
      ? t(
          "Sunway University is published with a StudyMY official-source bachelor, master and doctoral catalogue for international applicants.",
          "Sunway University diterbitkan dengan katalog sarjana muda, sarjana dan doktor falsafah berasaskan sumber rasmi StudyMY untuk pemohon antarabangsa.",
          "双威大学已上线 StudyMY 官方来源本硕博专业目录，面向国际申请人展示。",
          "雙威大學已上線 StudyMY 官方來源本碩博專業目錄，面向國際申請人展示。"
        )
      : t(
          "Sunway University is imported as a StudyMY official review candidate. Public display is disabled until the Sunway review rows pass the ready gate.",
          "Sunway University diimport sebagai calon semakan rasmi StudyMY. Paparan awam dilumpuhkan sehingga rekod semakan Sunway melepasi gerbang ready.",
          "双威大学已作为 StudyMY 官方审核候选入库；审核通过前不会进入公开学生端目录。",
          "雙威大學已作為 StudyMY 官方審核候選入庫；審核通過前不會進入公開學生端目錄。"
        ),
    website: dataset.university.officialWebsite,
    admissionEmail: "",
    nameEnOfficial: dataset.university.nameEnOfficial,
    officialWebsite: dataset.university.officialWebsite,
    studyPortalUrl: `${dataset.university.officialWebsite}/courses`,
    internationalPageUrl: dataset.university.internationalPageUrl || `${dataset.university.officialWebsite}/international`,
    applicationPortalUrl: dataset.university.applicationPortalUrl || `${dataset.university.officialWebsite}/apply`,
    officialAddress: dataset.university.officialAddress || "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: publish
      ? arr(
          ["Sunway official application form and international application route are linked for applicant reference."],
          ["Borang permohonan rasmi Sunway dan laluan permohonan antarabangsa dipautkan untuk rujukan pemohon."],
          ["已关联双威大学官方申请表和国际申请路径，供申请人参考。"],
          ["已關聯雙威大學官方申請表和國際申請路徑，供申請人參考。"]
        )
      : arr(
          ["Sunway official application form PDF checklist captured for review."],
          ["Senarai semak borang permohonan rasmi Sunway telah ditangkap untuk semakan."],
          ["已采集双威大学官方申请表 PDF 材料清单，待审查后公开展示。"],
          ["已採集雙威大學官方申請表 PDF 材料清單，待審查後公開展示。"]
        ),
    chinaStudentRequirements: arr([]),
    officialProfile: {
      collectionScope: "Sunway University official bachelor, master and doctoral review import",
      applicantScope: dataset.applicantScope,
      academicSession: dataset.academicSession,
      retrievedAt: dataset.retrievedAt,
      officialDomains: dataset.officialDomains,
      sourceUniversityCode: dataset.universityCode,
      authorization: publish ? "publish" : "review-import",
      rankings: {
        qsWorld: sunwayQsWorld2027
      },
      workflowAcceptance: {
        officialScopedRows: 104,
        canonicalProgrammes: summary.importRows,
        publicReadyRows: readyRows,
        reviewRows,
        publicLeakageExpected: 0
      },
      catalogStatusSummary: {
        all: { total: summary.importRows, ready: readyRows, needsReview: reviewRows, notAvailableForInternational: 0 },
        byLevel: {
          bachelor: {
            total: summary.byLevel.bachelor,
            ready: publish ? summary.byLevel.bachelor : 0,
            needsReview: publish ? 0 : summary.byLevel.bachelor,
            notAvailableForInternational: 0
          },
          master: {
            total: summary.byLevel.master,
            ready: publish ? summary.byLevel.master : 0,
            needsReview: publish ? 0 : summary.byLevel.master,
            notAvailableForInternational: 0
          },
          phd: {
            total: summary.byLevel.phd,
            ready: publish ? summary.byLevel.phd : 0,
            needsReview: publish ? 0 : summary.byLevel.phd,
            notAvailableForInternational: 0
          }
        }
      },
      reviewExceptions: publish
        ? [
            "Official-unpublished fields, including programme pages without a usable international fee block, display controlled unpublished labels rather than inferred values.",
            "Sunway official USD tuition amounts are copied exactly where Sunway displays USD; RM-equivalent payment notes remain detail-page context."
          ]
        : [
            "Review-only import keeps all Sunway candidate rows non-public until Ian explicitly approves publication.",
            "Official-unpublished fields, including programme pages without a usable international fee block, must display controlled unpublished labels rather than inferred values."
          ]
    },
    officialSources: sources,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: sourceStatus,
    officialAuditSummary:
      publish
        ? `Sunway official publication: ${summary.importRows} bachelor/master/phd programmes are public ready; counts are bachelor ${summary.byLevel.bachelor}, master ${summary.byLevel.master}, PhD ${summary.byLevel.phd}.`
        : `Sunway review-only import: ${summary.importRows} bachelor/master/phd candidates are imported as needs-review and isPublished=false; counts are bachelor ${summary.byLevel.bachelor}, master ${summary.byLevel.master}, PhD ${summary.byLevel.phd}.`,
    publicDisplayStatus,
    livingCostOfficialNote: null,
    tuitionMinCny: 0,
    tuitionMaxCny: 0,
    livingCostCny: 0,
    minIelts: summary.minIelts,
    acceptNoLanguage: false,
    facilities: arr([]),
    highlights: publish
      ? arr(
          ["Official bachelor/master/doctoral catalogue", "International applicant display"],
          ["Official bachelor/master/doctoral catalogue", "International applicant display"],
          ["官方来源本硕博专业目录", "面向国际申请人展示"],
          ["官方來源本碩博專業目錄", "面向國際申請人展示"]
        )
      : arr(["Official review import only"], ["Official review import only"], ["仅限后台审核"], ["僅限後台審核"]),
    programCount: summary.importRows,
    isPublished: publish
  };
}

export function summarizeSunwayOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): SunwayImportSummary {
  const byLevel = emptyLevelCounts();
  for (const row of rows) byLevel[row.level as SunwayLevel] += 1;
  const ieltsScores = rows
    .map((row) => Number(row.languageRequirement?.ielts || 0))
    .filter((score) => Number.isFinite(score) && score > 0);
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel,
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    pendingFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "pending-review").length,
    notPublishedFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "not-published").length,
    officialDurationRows: rows.filter((row) => Number(row.durationYears || 0) > 0 && Boolean(row.durationOfficial)).length,
    officialIntakeRows: rows.filter((row) => Boolean(row.officialIntake)).length,
    officialLanguageRows: rows.filter((row) => Boolean(row.officialLanguageRequirement)).length,
    officialIeltsRows: ieltsScores.length,
    noOfficialIeltsRows: rows.length - ieltsScores.length,
    minIelts: ieltsScores.length ? Math.min(...ieltsScores) : 0,
    academicRequirementRows: rows.filter((row) => Boolean(row.officialAcademicRequirement)).length,
    applicationDocumentRows: rows.filter((row) => (row.applicationDocs?.en || []).length > 0).length,
    courseSettingRows: rows.filter((row) => (row.curriculum?.en || []).length > 0).length,
    careerRows: rows.filter((row) => (row.careers?.en || []).length > 0).length,
    sourceLinkedRows: rows.filter((row) => Boolean(row.officialSourceUrl) && (row.sourceUrls || []).length > 0).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function verifySunwayImportedRecordSet(
  university: UniversityEntity,
  rows: ProgramEntity[],
  allUniversityRows: ProgramEntity[],
  options: SunwayImportOptions = {}
): SunwayImportVerification {
  const publish = Boolean(options.publish);
  const summary = summarizeSunwayOfficialAuditImport(rows);
  const importedPublicRows = rows.filter((row) => row.isPublished && visibleProgramStatuses.includes(row.publicDisplayStatus)).length;
  const importedPublicLeakageRows = publish ? 0 : rows.filter((row) => row.isPublished || visibleProgramStatuses.includes(row.publicDisplayStatus)).length;
  const importedNeedsReviewRows = rows.filter((row) => !row.isPublished && row.publicDisplayStatus === "needs-review").length;
  const legacyPublicRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX) && row.isPublished && visibleProgramStatuses.includes(row.publicDisplayStatus)
  ).length;
  const legacyActiveRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  ).length;
  const publicProgrammeCount = allUniversityRows.filter((row) => row.isPublished && visibleProgramStatuses.includes(row.publicDisplayStatus)).length;
  const publicDetailRouteAccessible = university.isPublished && university.publicDisplayStatus === "ready";

  const baseFailure =
    rows.length !== 97 ||
    summary.byLevel.bachelor !== 48 ||
    summary.byLevel.master !== 33 ||
    summary.byLevel.phd !== 16 ||
    summary.uniqueSlugs !== 97 ||
    summary.pendingFeeRows !== 0 ||
    summary.notPublishedFeeRows !== 4 ||
    summary.officialIeltsRows !== 97 ||
    summary.noOfficialIeltsRows !== 0 ||
    summary.minIelts !== 5.5 ||
    summary.sourceLinkedRows !== 97;
  const modeFailure = publish
    ? summary.readyRows !== 97 ||
      summary.needsReviewRows !== 0 ||
      summary.publishedRows !== 97 ||
      importedPublicRows !== 97 ||
      importedNeedsReviewRows !== 0 ||
      legacyPublicRows !== 0 ||
      legacyActiveRows !== 0 ||
      publicProgrammeCount !== 97 ||
      !publicDetailRouteAccessible ||
      university.programCount !== 97
    : summary.readyRows !== 0 ||
      summary.needsReviewRows !== 97 ||
      summary.publishedRows !== 0 ||
      importedPublicLeakageRows !== 0 ||
      importedNeedsReviewRows !== 97;

  if (baseFailure || modeFailure) {
    throw new Error(
      `Sunway import verification failed: ${JSON.stringify({
        mode: publish ? "publish" : "review-import",
        summary,
        importedPublicRows,
        importedPublicLeakageRows,
        importedNeedsReviewRows,
        legacyPublicRows,
        legacyActiveRows,
        publicProgrammeCount,
        universityStatus: university.publicDisplayStatus,
        universityPublished: university.isPublished
      })}`
    );
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    importedPublicRows,
    importedPublicLeakageRows,
    importedNeedsReviewRows,
    legacyPublicRows,
    legacyActiveRows,
    publicProgrammeCount,
    publicDetailRouteAccessible
  };
}

async function verifyImportedRows(
  manager: EntityManager | DataSource,
  universityId: number,
  options: SunwayImportOptions = {}
): Promise<SunwayImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("Sunway university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifySunwayImportedRecordSet(university, rows, allUniversityRows, options);
}

async function captureVisibility(manager: EntityManager | DataSource, university: UniversityEntity | null): Promise<SunwayVisibilitySnapshot> {
  if (!university) {
    return {
      exists: false,
      id: null,
      slug: null,
      code: null,
      isPublished: false,
      publicDisplayStatus: null,
      publicProgrammeCount: 0,
      publicDetailRouteAccessible: false
    };
  }
  const publicProgrammeCount = await manager.getRepository(ProgramEntity).count({
    where: { universityId: university.id, isPublished: true, publicDisplayStatus: In(visibleProgramStatuses) }
  });
  return {
    exists: true,
    id: university.id,
    slug: university.slug,
    code: university.code,
    isPublished: university.isPublished,
    publicDisplayStatus: university.publicDisplayStatus,
    publicProgrammeCount,
    publicDetailRouteAccessible: university.isPublished && university.publicDisplayStatus === "ready"
  };
}

function feePresentation(candidate: SunwayCandidateProgramme): {
  currency: TuitionCurrency;
  amount: number | null;
  officialMyr: number | null;
  display: string;
  sourceUrl: string;
  auditStatus: FeeAuditStatus;
  note: string;
} {
  const fee = candidate.fee || {};
  const sourceUrl = candidate.officialSourceUrl || "";
  const international = fee.internationalUsdIndicative?.amountText;
  const online = fee.onlineProgrammeRm?.amountText;
  const local = fee.malaysian?.amountText;
  const basis = normalizeText(fee.label || fee.basis || "Official programme fee", 120);
  if (international) {
    return {
      currency: "USD",
      amount: parseMoneyAmount(international),
      officialMyr: null,
      display: `${international} (${basis}; international students)`,
      sourceUrl,
      auditStatus: "official-rate-verified",
      note: normalizeLongText(
        [
          fee.raw,
          fee.paymentNote ||
            "Official Sunway note: international students pay the RM equivalent; the displayed USD is indicative/estimation and subject to the prevalent exchange rate.",
          "StudyMY copies the official USD amount exactly under Ian's approved Sunway fee-display policy; payment-method details belong on the programme detail page."
        ].filter(Boolean).join(" ")
      )
    };
  }

  if (online) {
    const onlineBasis = fee.basis === "online-master-programme-fee" ? "online programme fee" : basis;
    return {
      currency: "MYR",
      amount: parseMoneyAmount(online),
      officialMyr: parseMoneyAmount(online),
      display: `${online} (${onlineBasis})`,
      sourceUrl,
      auditStatus: "matched-official",
      note: normalizeLongText(
        [
          fee.raw,
          fee.paymentNote ||
            "Sunway Online publishes this as the master's programme fee; separately charged enrolment, prerequisite, APEL.A or accreditation fees remain detail-page notes."
        ].filter(Boolean).join(" ")
      )
    };
  }

  if (local) {
    const localAmount = parseMoneyAmount(local);
    return {
      currency: "MYR",
      amount: localAmount,
      officialMyr: localAmount,
      display: `${local} (${basis}; Malaysian students; international RM-equivalent note published)`,
      sourceUrl,
      auditStatus: "matched-official",
      note: normalizeLongText(
        [
          fee.raw,
          fee.paymentNote ||
            "Sunway publishes this RM amount for Malaysian students on the programme page and states that international students must pay their fees in RM equivalent; no separate USD amount is listed on the same page.",
          "StudyMY displays the official RM amount and keeps the international-student scope limitation in the detail-page note; it does not infer a separate USD amount."
        ].filter(Boolean).join(" ")
      )
    };
  }

  const display = "Official fee not published";
  return {
    currency: "UNKNOWN",
    amount: null,
    officialMyr: null,
    display,
    sourceUrl,
    auditStatus: fee.status === "official-unpublished" ? "not-published" : "pending-review",
    note: normalizeLongText(
      [
        fee.reviewReason,
        fee.raw,
        "Do not infer a public international tuition amount where Sunway did not publish one on the official programme detail page."
      ].filter(Boolean).join(" ")
    )
  };
}

function buildSourceLinks(
  candidate: SunwayCandidateProgramme,
  fee: ReturnType<typeof feePresentation>,
  options: SunwayImportOptions = {}
): OfficialSourceLink[] {
  const publish = Boolean(options.publish);
  const urls = new Set(
    [
      candidate.officialSourceUrl,
      fee.sourceUrl,
      candidate.applicationDocuments?.sourceUrl,
      ...(candidate.sourceUrls || [])
    ].filter((url): url is string => Boolean(url))
  );
  return Array.from(urls).map((url) => ({
    title: url === candidate.officialSourceUrl ? "Official programme page" : url === fee.sourceUrl ? "Official fee source" : "Official source",
    url,
    sourceType: sourceTypeForUrl(url),
    verifiedAt,
    status: publish ? "official-verified" : "needs-review",
    note: publish ? "Verified in the Sunway official publication batch." : "Captured in Sunway official audit batch; remains review-only."
  }));
}

function sourceTypeForUrl(url: string): OfficialSourceLink["sourceType"] {
  if (/fee|tuition/i.test(url)) return "fee";
  if (/apply|application|form/i.test(url)) return "admission";
  if (/international|entry|requirement/i.test(url)) return "entry-requirement";
  if (url === "https://sunwayuniversity.edu.my") return "official-website";
  return "profile";
}

function localizedText(value: SunwayLocalizedText | undefined, fallback: string, level?: SunwayLevel): LocalizedText {
  const en = normalizeText(value?.en || fallback, 255);
  const ms = normalizeText(value?.ms || en, 255);
  const zhCN = cleanProgramNamePrefix(value?.["zh-CN"] || en);
  const zhTW = cleanProgramNamePrefix(value?.["zh-TW"] || zhCN);
  return { en, ms, "zh-CN": zhCN, "zh-TW": zhTW };
}

function programNameText(candidate: SunwayCandidateProgramme): LocalizedText {
  const en = normalizeText(candidate.name?.en || candidate.nameEnOfficial, 255);
  const ms = normalizeText(candidate.name?.ms || en, 255);
  const zhCN = normalizeText(sunwayProgramNameZhMap[candidate.nameEnOfficial] || cleanProgramNamePrefix(candidate.name?.["zh-CN"] || en), 255);
  const zhTW = normalizeText(candidate.name?.["zh-TW"] && !isEnglishOnlyText(candidate.name["zh-TW"])
    ? cleanProgramNamePrefix(candidate.name["zh-TW"])
    : toSunwayTraditionalProgramName(zhCN), 255);
  return { en, ms, "zh-CN": zhCN, "zh-TW": zhTW };
}

function facultyText(candidate: SunwayCandidateProgramme): LocalizedText {
  const en = normalizeText(candidate.faculty?.en || candidate.facultyEn || "Sunway University", 255);
  const ms = normalizeText(candidate.faculty?.ms || en, 255);
  const chinese = resolveFacultyChinese(candidate);
  return { en, ms, "zh-CN": chinese.zhCN, "zh-TW": chinese.zhTW };
}

function resolveFacultyChinese(candidate: SunwayCandidateProgramme) {
  const facultyEn = normalizeText(candidate.facultyEn || candidate.faculty?.en || "", 255);
  if (facultyEn === "Master's Degrees (Online)") return resolveOnlineMasterFacultyChinese(candidate);
  return sunwayFacultyZhMap[facultyEn] || {
    zhCN: cleanSunwayFacultyChinese(candidate.faculty?.["zh-CN"] || facultyEn || "双威大学"),
    zhTW: cleanSunwayFacultyChinese(candidate.faculty?.["zh-TW"] || candidate.faculty?.["zh-CN"] || facultyEn || "雙威大學")
  };
}

function resolveOnlineMasterFacultyChinese(candidate: SunwayCandidateProgramme) {
  const name = candidate.nameEnOfficial.toLowerCase();
  if (/education/.test(name)) return sunwayFacultyZhMap["School of Education"];
  if (/data science/.test(name)) return sunwayFacultyZhMap["School of Mathematical Sciences"];
  return sunwayFacultyZhMap["Sunway Business School"];
}

function cleanProgramNamePrefix(value: unknown) {
  return normalizeText(value, 255).replace(/^(?:本科|硕士|碩士|博士|研究生)\s*(?:课程|課程)[：:]\s*/u, "");
}

function isEnglishOnlyText(value: unknown) {
  const text = cleanProgramNamePrefix(value);
  return Boolean(text) && !/\p{Script=Han}/u.test(text);
}

function toSunwayTraditionalProgramName(value: string) {
  const phraseMap: Array<[string, string]> = [
    ["信息技术", "資訊技術"],
    ["信息系统", "資訊系統"],
    ["计算机", "計算機"],
    ["软件", "軟體"],
    ["旅游", "旅遊"],
    ["酒店", "酒店"]
  ];
  const charMap: Record<string, string> = {
    与: "與",
    业: "業",
    临: "臨",
    为: "為",
    会: "會",
    传: "傳",
    体: "體",
    优: "優",
    内: "內",
    创: "創",
    动: "動",
    务: "務",
    医: "醫",
    双: "雙",
    发: "發",
    国: "國",
    场: "場",
    学: "學",
    应: "應",
    当: "當",
    戏: "戲",
    护: "護",
    据: "據",
    数: "數",
    术: "術",
    机: "機",
    乐: "樂",
    电: "電",
    画: "畫",
    硕: "碩",
    级: "級",
    络: "絡",
    统: "統",
    续: "續",
    网: "網",
    艺: "藝",
    荣: "榮",
    营: "營",
    视: "視",
    觉: "覺",
    计: "計",
    设: "設",
    询: "詢",
    资: "資",
    软: "軟",
    辆: "輛",
    链: "鏈",
    际: "際",
    频: "頻",
    饪: "飪",
    验: "驗",
    誉: "譽",
    经: "經",
    济: "濟",
    广: "廣",
    筑: "築",
    游: "遊",
    销: "銷"
  };
  let text = value;
  for (const [from, to] of phraseMap) text = text.replaceAll(from, to);
  return [...text].map((char) => charMap[char] || char).join("");
}

function cleanSunwayFacultyChinese(value: unknown) {
  return normalizeText(value, 255)
    .replace(/^双威大学\s*/u, "")
    .replace(/^雙威大學\s*/u, "")
    .replace(/^Sunway University\s*/i, "");
}

function descriptionText(candidate: SunwayCandidateProgramme, options: SunwayImportOptions = {}): LocalizedText {
  const publish = Boolean(options.publish);
  const levelLabel = levelDisplay(candidate.level);
  const en = normalizeText(
    candidate.description?.en ||
      (publish
        ? `${candidate.nameEnOfficial} is a Sunway University ${candidate.level} programme for international applicants, published from audited official Sunway sources.`
        : `${candidate.nameEnOfficial} is a Sunway University official-source candidate for international-applicant review.`),
    900
  );
  return publish
    ? t(
        en,
        normalizeText(candidate.description?.ms || en, 900),
        `${candidate.nameEnOfficial} 是双威大学面向国际申请人的${levelLabel.zhCN}专业，依据双威大学官方来源核验后展示。`,
        `${candidate.nameEnOfficial} 是雙威大學面向國際申請人的${levelLabel.zhTW}專業，依據雙威大學官方來源核驗後展示。`
      )
    : t(
        en,
        normalizeText(candidate.description?.ms || en, 900),
        `这是双威大学 ${candidate.level} 层级的官方来源审查候选专业。当前仅供后台审查，不进入公开学生端展示。`,
        `這是雙威大學 ${candidate.level} 層級的官方來源審查候選專業。當前僅供後台審查，不進入公開學生端展示。`
      );
}

function applicationDocuments(candidate: SunwayCandidateProgramme, options: SunwayImportOptions = {}): LocalizedStringArray {
  const publish = Boolean(options.publish);
  const source = candidate.applicationDocuments;
  const sourceLabel = source?.sourceId ? ` (${source.sourceId})` : "";
  const sourceName = applicationDocumentPublicSource(source);
  return publish
    ? arr(
        [
          "Official Sunway application evidence is linked for applicant reference; final document assessment follows Sunway admissions.",
          sourceName.en
        ],
        [
          "Bukti permohonan rasmi Sunway dipautkan untuk rujukan pemohon; penilaian dokumen akhir mengikut kemasukan Sunway.",
          sourceName.ms
        ],
        [
          "已关联双威大学官方申请材料依据，供申请人参考；最终材料审核以双威大学招生评估为准。",
          sourceName.zhCN
        ],
        [
          "已關聯雙威大學官方申請材料依據，供申請人參考；最終材料審核以雙威大學招生評估為準。",
          sourceName.zhTW
        ]
      )
    : arr(
        [
          `Official Sunway application document evidence captured${sourceLabel}; review source PDF before public display.`,
          source?.provenance ? `Provenance: ${source.provenance}.` : "Provenance: official Sunway application source."
        ],
        [
          `Bukti dokumen permohonan rasmi Sunway telah ditangkap${sourceLabel}; semak PDF sumber sebelum paparan awam.`,
          source?.provenance ? `Provenans: ${source.provenance}.` : "Provenans: sumber permohonan rasmi Sunway."
        ],
        [
          `已采集双威大学官方申请材料依据${sourceLabel}；公开展示前需复核源 PDF。`,
          source?.provenance ? `来源属性：${source.provenance}。` : "来源属性：双威官方申请来源。"
        ],
        [
          `已採集雙威大學官方申請材料依據${sourceLabel}；公開展示前需覆核源 PDF。`,
          source?.provenance ? `來源屬性：${source.provenance}。` : "來源屬性：雙威官方申請來源。"
        ]
      );
}

function levelDisplay(level: SunwayLevel) {
  if (level === "bachelor") return { zhCN: "本科", zhTW: "本科" };
  if (level === "master") return { zhCN: "硕士", zhTW: "碩士" };
  return { zhCN: "博士", zhTW: "博士" };
}

function applicationDocumentPublicSource(source: SunwayApplicationDocuments | undefined) {
  const provenance = normalizeText(source?.provenance || source?.sourceId || "", 120).toLowerCase();
  if (/online|programme-details|program/.test(provenance)) {
    return {
      en: "Source: official Sunway programme page.",
      ms: "Sumber: halaman program rasmi Sunway.",
      zhCN: "来源：双威大学官方专业页面。",
      zhTW: "來源：雙威大學官方專業頁面。"
    };
  }
  if (/pdf|application-form|ug-application/.test(provenance)) {
    return {
      en: "Source: official Sunway application form.",
      ms: "Sumber: borang permohonan rasmi Sunway.",
      zhCN: "来源：双威大学官方申请表。",
      zhTW: "來源：雙威大學官方申請表。"
    };
  }
  return {
    en: "Source: official Sunway application source.",
    ms: "Sumber: sumber permohonan rasmi Sunway.",
    zhCN: "来源：双威大学官方申请来源。",
    zhTW: "來源：雙威大學官方申請來源。"
  };
}

function courseSettingItems(candidate: SunwayCandidateProgramme, options: SunwayImportOptions = {}): LocalizedStringArray {
  const publish = Boolean(options.publish);
  const groups = candidate.courseSetting?.groups || [];
  const en = groups
    .flatMap((group) => {
      const title = normalizeText(group.group || "Course setting", 80);
      const items = (group.items || []).map((item) => normalizeText(item, 160)).filter(Boolean);
      if (!items.length) return [];
      return [`${title}: ${items.join("; ")}`];
    })
    .slice(0, 30);
  if (!en.length && candidate.courseSetting?.officialText) en.push(normalizeText(candidate.courseSetting.officialText, 500));
  const zhCN = publish
    ? en.length
      ? en.map((item) => `官方课程设置：${item}`)
      : ["双威官方来源未公布独立课程设置细项。"]
    : en.length
      ? ["课程设置已采集官方英文依据；公开展示前需完成中文课程名校对。"]
      : ["双威官方来源未公布可公开展示的课程设置细项，或仍需审查。"];
  return arr(en, en, zhCN, zhCN.map((item) => item.replace("课程", "課程").replace("公开", "公開").replace("审查", "審查")));
}

function careerItems(candidate: SunwayCandidateProgramme, options: SunwayImportOptions = {}): LocalizedStringArray {
  const publish = Boolean(options.publish);
  const en = (candidate.careerDirections?.items || [])
    .map((item) => normalizeText(item, 160))
    .filter(Boolean)
    .slice(0, 30);
  if (!en.length && candidate.careerDirections?.officialText && candidate.careerDirections.status !== "official-unpublished") {
    en.push(normalizeText(candidate.careerDirections.officialText, 500));
  }
  const zhCN = publish
    ? en.length
      ? en.map((item) => `官方公布职业方向：${item}`)
      : ["双威官方来源未公布独立职业方向。"]
    : en.length
      ? ["职业方向已采集官方英文依据；公开展示前需完成中文本地化校对。"]
      : ["双威官方来源未公布职业方向，或仍需审查。"];
  return arr(en, en, zhCN, zhCN.map((item) => item.replace("职业", "職業").replace("公开", "公開").replace("审查", "審查")));
}

function specialRequirementsNote(candidate: SunwayCandidateProgramme, options: SunwayImportOptions = {}) {
  const publish = Boolean(options.publish);
  const languageEquivalencyNote =
    authorizedSunwayIeltsEquivalent(candidate, candidate.officialLanguageRequirement || candidate.language?.officialText || "") > 0
      ? " 护理学哲学博士官方语言路线为 MUET Band 4 / CEFR Mid B2；按 Ian 授权等效折算为 IELTS 6.0 用于列表展示，官方原文仍以详情语言要求为准。"
      : "";
  if (publish) {
    return `以双威大学官方专业页面、国际学生页面和申请页面为准；最终录取和材料审核由学校招生流程评估。${languageEquivalencyNote}`;
  }
  return normalizeLongText(
    [
      candidate.internationalEligibility?.evidence,
      languageEquivalencyNote,
      candidate.studyMode === "not-confirmed" ? "Study mode or arrangement remains not-confirmed in the Sunway field coverage matrix." : "",
      candidate.description?.reviewReason,
      candidate.applicationDocuments?.status ? `Application documents provenance: ${candidate.applicationDocuments.status}.` : ""
    ].filter(Boolean).join(" ")
  );
}

function reviewReasonText(candidate: SunwayCandidateProgramme, fee: ReturnType<typeof feePresentation>) {
  return normalizeLongText(
    [
      candidate.reviewReason,
      candidate.internationalEligibility?.status === "needs-review" ? "International applicant-route eligibility requires review before public display." : "",
      fee.note,
      candidate.description?.status === "needs-review" ? "Chinese/Malay student-facing localization requires review." : "",
      candidate.studyMode === "not-confirmed" ? "Study mode and arrangement require review." : ""
    ].filter(Boolean).join(" ")
  );
}

function studyModeDisplay(candidate: SunwayCandidateProgramme) {
  const type = normalizeStudyType(candidate.studyType || candidate.studyMode || "");
  const arrangement = formatArrangement(candidate.studyArrangement);
  if (!arrangement || arrangement.toLowerCase() === type.toLowerCase()) return normalizeText(type || "needs review", 80);
  return normalizeText(`${type || "needs review"} / ${arrangement}`, 80);
}

function normalizeStudyType(value: string) {
  const normalized = normalizeText(value, 80).toLowerCase();
  if (!normalized || normalized === "not-applicable") return "not applicable";
  if (normalized === "not-confirmed") return "not confirmed";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatArrangement(value: string[] | string | undefined) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map((item) => normalizeText(item, 80)).filter(Boolean).join(" / ");
}

function inferCategory(candidate: SunwayCandidateProgramme): ProgramCategoryCode {
  const value = `${candidate.nameEnOfficial} ${candidate.facultyEn || ""} ${candidate.categoryEn || ""}`.toLowerCase();
  if (/account|finance|business|management|marketing|entrepreneur|economics|analytics|mba|sustainable development/.test(value)) return "business";
  if (/computer|software|information technology|data|artificial intelligence|cyber|digital|analytics/.test(value)) return "it";
  if (/engineering|electronic|mechanical|civil|construction|robotic|mechatronic/.test(value)) return "engineering";
  if (/medicine|medical|health|nursing|psychology|pharmacy|biology|biomed|clinical|public health/.test(value)) return "medicine";
  if (/law/.test(value)) return "law";
  if (/science|mathematical|actuarial|chemistry|biology|statistics/.test(value)) return "science";
  return "arts";
}

function parseDurationYears(value: string) {
  const text = String(value || "");
  const yearsWithMonths = text.match(/(\d+(?:\.\d+)?)\s*years?\s*(\d+(?:\.\d+)?)?\s*months?/i);
  if (yearsWithMonths) return Number(yearsWithMonths[1]) + (yearsWithMonths[2] ? Number(yearsWithMonths[2]) / 12 : 0);
  const monthRange = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*months?/i);
  if (monthRange) return Number(monthRange[1]) / 12;
  const months = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (months) return Number(months[1]) / 12;
  const range = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?/i);
  if (range) return Number(range[1]);
  const years = text.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (years) return Number(years[1]);
  const semesters = text.match(/(\d+(?:\.\d+)?)\s*semesters?/i);
  if (semesters) return Number(semesters[1]) / 2;
  const number = text.match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : 1;
}

function parseIntakeMonths(value: string) {
  const text = String(value || "");
  const months: Array<[string, RegExp]> = [
    ["January", /\b(?:jan|january)\b/i],
    ["February", /\b(?:feb|february)\b/i],
    ["March", /\b(?:mar|march)\b/i],
    ["April", /\b(?:apr|april)\b/i],
    ["May", /\bmay\b/i],
    ["June", /\b(?:jun|june)\b/i],
    ["July", /\b(?:jul|july)\b/i],
    ["August", /\b(?:aug|august)\b/i],
    ["September", /\b(?:sep|sept|september)\b/i],
    ["October", /\b(?:oct|october)\b/i],
    ["November", /\b(?:nov|november)\b/i],
    ["December", /\b(?:dec|december)\b/i]
  ];
  return months.filter(([, pattern]) => pattern.test(text)).map(([month]) => month);
}

function parseLanguageRequirement(candidate: SunwayCandidateProgramme): LanguageRequirement {
  const tests = candidate.language?.tests || {};
  const officialText = normalizeLongText(candidate.officialLanguageRequirement || candidate.language?.officialText || "");
  const testsText = Object.entries(tests).map(([key, value]) => `${key} ${value}`).join(" ");
  const text = `${officialText} ${testsText}`;
  const directIelts = extractIeltsScore(officialText) || extractIeltsScore(testsText);
  return {
    ielts: directIelts || authorizedSunwayIeltsEquivalent(candidate, officialText) || 0,
    toefl: numberAfter(text, /TOEFL(?:\s*iBT)?\s*(\d+)/i),
    pte: numberAfter(text, /PTE(?:\s*Academic)?\s*(\d+)/i),
    muet: extractMuetScore(text)
  };
}

function authorizedSunwayIeltsEquivalent(candidate: SunwayCandidateProgramme, officialText: string) {
  const isNursingPhd = candidate.code === "SUNWAY-PHD-009" || candidate.nameEnOfficial === "Doctor of Philosophy in Nursing";
  if (!isNursingPhd) return 0;
  const text = normalizeLongText(officialText || "");
  const hasMuet4 = /\bMUET\b[\s\S]{0,80}\b4\b|\bBand\s*4[\s\S]{0,120}\b(?:MUET|Malaysian University English Test)\b/i.test(text);
  const hasMidB2 = /\b(?:CEFR|Common European Framework of Reference)\b[\s\S]{0,120}\bMid\s*B2\b|\bMid\s*B2\b[\s\S]{0,120}\b(?:CEFR|Common European Framework of Reference)\b/i.test(text);
  return hasMuet4 && hasMidB2 ? 6 : 0;
}

function extractIeltsScore(text: string) {
  const normalized = normalizeLongText(text || "").replace(/\|/g, " | ");
  const patterns = [
    /\bIELTS\s*\|\s*or\s+equivalent\s*(\d+(?:\.\d+)?)/i,
    /\bIELTS\s*(?:\|\s*)?(?:or\s+equivalent\s*)?(?:(?:[:|])\s*)+(?:Band\s*)?(\d+(?:\.\d+)?)/i,
    /\bIELTS\s+(?:or\s+equivalent\s*)?(?:Band\s*)?(\d+(?:\.\d+)?)/i,
    /\bIELTS\s*(?:Band|band)\s*(\d+(?:\.\d+)?)/i,
    /\bInternational English Language Testing System\s*\(IELTS\)\s*(?:(?:[:|])\s*)+(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:in|for)\s+(?:the\s+)?\b(?:IELTS|International English Language Testing System)\b/i,
    /\b(?:minimum|average)\s+score\s+of\s+(\d+(?:\.\d+)?)[^.;|]{0,140}\b(?:IELTS|International English Language Testing System)\b/i,
    /\bIELTS(?:\s+test)?\s+result\s*\(\s*(?:minimum|average)\s+score\s+of\s+(\d+(?:\.\d+)?)\s*\)/i,
    /\bIELTS\s*\(\s*(?:minimum|average)\s+score\s+of\s+(\d+(?:\.\d+)?)\s*\)/i,
    /\bscore\s+of\s+(\d+(?:\.\d+)?)[^.;|]{0,120}\bIELTS\b/i
  ];
  for (const pattern of patterns) {
    const value = numberAfter(normalized, pattern);
    if (value && value >= 4 && value <= 9) return value;
  }
  return null;
}

function extractMuetScore(text: string) {
  const normalized = normalizeLongText(text || "");
  const patterns = [
    /\bMUET\b\s*(?:Band)?\s*(\d+(?:\.\d+)?)/i,
    /\bBand\s*(\d+(?:\.\d+)?)[^.;|]{0,120}\b(?:MUET|Malaysian University English Test)\b/i
  ];
  for (const pattern of patterns) {
    const value = numberAfter(normalized, pattern);
    if (value && value >= 1 && value <= 5) return value;
  }
  return null;
}

function extractCgpaRequirement(value: string) {
  const text = normalizeLongText(value || "");
  if (!/\b(?:CGPA|GPA)\b/i.test(text)) return 0;
  const minimumMatch = text.match(/\b(?:minimum|min\.?)\s+(?:CGPA|GPA)(?:\s+of)?\s*(\d(?:\.\d+)?)/i);
  if (minimumMatch?.[1]) return boundedCgpaValue(minimumMatch[1]);
  const cgpaMatch = text.match(/\b(?:CGPA|GPA)(?:\s+of)?\s*(\d(?:\.\d+)?)/i);
  if (cgpaMatch?.[1]) return boundedCgpaValue(cgpaMatch[1]);
  return 0;
}

function boundedCgpaValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 4 ? parsed : 0;
}

function parseMoneyAmount(value: string | undefined) {
  const match = String(value || "").match(/([0-9][0-9,]*(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numberAfter(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1] ? Number(match[1]) : null;
}

function isOfficialSunwayUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return officialDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function normalizeLongText(value: unknown) {
  return normalizeText(String(value || ""), 4000);
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item) || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function loadJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Sunway candidate dataset not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveRepositoryPath(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  return isAbsolute(value) ? value : resolve(repositoryRoot, value);
}

function buildDataSource() {
  loadEnvFiles();
  return new DataSource({
    type: "mysql",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "123456",
    database: process.env.MYSQL_DATABASE || "study_malaysia",
    entities: [...ALL_ENTITIES],
    synchronize: false,
    charset: "utf8mb4_unicode_ci"
  });
}

async function clearCatalogCache() {
  if (!process.env.REDIS_URL) return false;
  const RedisCtor = IORedis as unknown as new (connection: string, options: Record<string, unknown>) => Redis;
  const client = new RedisCtor(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.on("error", () => undefined);
  try {
    await client.connect();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", "catalog:*", "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await client.del(...keys);
    } while (cursor !== "0");
    return true;
  } catch {
    return false;
  } finally {
    await client.quit().catch(() => undefined);
  }
}

async function main() {
  const candidatePath = resolveRepositoryPath(readArgValue("--candidate"), DEFAULT_SUNWAY_OFFICIAL_AUDIT_CANDIDATE_PATH);
  const verifyOnly = process.argv.includes("--verify-only");
  const verifyPublished = process.argv.includes("--verify-published");
  const confirmImport = process.argv.includes("--confirm-import");
  const confirmPublish = process.argv.includes("--confirm-publish");
  const publishDryRun = process.argv.includes("--publish-dry-run");
  if ([confirmImport, confirmPublish].filter(Boolean).length > 1) {
    throw new Error("Use only one write mode: --confirm-import or --confirm-publish.");
  }
  if ([verifyOnly, verifyPublished].filter(Boolean).length > 1) {
    throw new Error("Use only one verify mode: --verify-only or --verify-published.");
  }
  const publish = confirmPublish || verifyPublished || publishDryRun;
  const backupPath = resolveRepositoryPath(
    readArgValue("--backup-output"),
    resolve(
      repositoryRoot,
      `tmp/backups/sunway-official-${publish ? "publish" : "audit-review"}-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    )
  );
  const reportOutput = resolveRepositoryPath(
    readArgValue("--report-output"),
    publish ? DEFAULT_SUNWAY_PUBLISH_REPORT_PATH : DEFAULT_SUNWAY_REVIEW_IMPORT_REPORT_PATH
  );

  const dataset = loadJson<SunwayCandidateDataset>(candidatePath);
  const errors = validateSunwayOfficialAuditDataset(dataset);
  if (errors.length) throw new Error(`Sunway official audit candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildSunwayOfficialAuditRows(dataset, { publish });
  const summary = summarizeSunwayOfficialAuditImport(rows);
  const baseSummaryReady =
    summary.importRows === 97 && summary.pendingFeeRows === 0 && summary.notPublishedFeeRows === 4 && summary.sourceLinkedRows === 97;
  const modeSummaryReady = publish
    ? summary.readyRows === 97 && summary.needsReviewRows === 0 && summary.publishedRows === 97
    : summary.readyRows === 0 && summary.needsReviewRows === 97 && summary.publishedRows === 0;
  if (!baseSummaryReady || !modeSummaryReady) {
    throw new Error(`Sunway row build summary is not ${publish ? "publish" : "review-import"} ready: ${JSON.stringify(summary)}`);
  }

  if (!confirmImport && !verifyOnly && !confirmPublish && !verifyPublished) {
    const report = {
      mode: publish ? "publish-dry-run" : "dry-run",
      universityCode: "SUNWAY",
      candidatePath,
      reportOutput,
      writePolicy: publish
        ? {
            authorization: "publish",
            upsertPrefix: SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX,
            importRows: 97,
            university: "Update Sunway as public ready with 97 official bachelor/master/doctoral programmes.",
            programmes: { isPublished: true, publicDisplayStatus: "ready", officialSourceStatus: "official-verified" },
            archiveLegacyRows:
              "Archive all non-prefix active Sunway programme rows; verification fails if any active or public legacy rows remain.",
            backupRequired: true,
            publicProgrammeCountExpected: 97,
            rollback: "Restore the scoped JSON backup written before --confirm-publish, then rerun --verify-published after correction.",
            nextStep: "Review this dry-run, then rerun with --confirm-publish to create a scoped backup and publish transactionally."
          }
        : {
            authorization: "review-import",
            upsertPrefix: SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX,
            importRows: 97,
            university:
              "Create or update Sunway as a non-public needs-review university only if it is not already public ready; preserve any existing public Sunway row.",
            programmes: { isPublished: false, publicDisplayStatus: "needs-review" },
            archiveLegacyRows: "No. Review-only import does not archive existing non-prefix public Sunway rows.",
            backupRequired: true,
            publicLeakageExpected: 0,
            rollback: "Restore the scoped JSON backup written before --confirm-import, then rerun verify-only.",
            nextStep: "Review this dry-run, then rerun with --confirm-import to create a scoped backup and write transactionally."
          },
      summary
    };
    mkdirSync(dirname(reportOutput), { recursive: true });
    writeFileSync(reportOutput, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "SUNWAY" } })) ||
      (await universityRepo.findOne({ where: { slug: "sunway-university" } }));

    if (verifyOnly || verifyPublished) {
      if (!university) throw new Error("Sunway university row not found.");
      const report = {
        mode: publish ? "published-verified" : "verified",
        universityId: university.id,
        databaseUniversityCode: university.code,
        summary,
        verification: await verifyImportedRows(dataSource, university.id, { publish })
      };
      mkdirSync(dirname(reportOutput), { recursive: true });
      writeFileSync(reportOutput, JSON.stringify(report, null, 2), "utf8");
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "sunway-university" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug sunway-university belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const beforeVisibility = await captureVisibility(dataSource, university);
    const preservePublicUniversity = !publish && Boolean(university?.isPublished && university.publicDisplayStatus === "ready");
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), beforeVisibility, university, programs: currentPrograms }, null, 2),
      "utf8"
    );

    let verification: SunwayImportVerification | null = null;
    let afterVisibility: SunwayVisibilitySnapshot | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await txUniversityRepo.findOne({ where: { code: "SUNWAY" } });

      if (!university || !preservePublicUniversity || publish) {
        const universitySeed = buildSunwayUniversityRow(dataset, summary, { publish });
        university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));
      }

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousOfficialAuditRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
      });
      for (const previous of previousOfficialAuditRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      if (publish) {
        const allSunwayRows = await txProgramRepo.find({ where: { universityId: university.id } });
        const legacyActiveRows = allSunwayRows.filter(
          (row) => !row.slug.startsWith(SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
        );
        for (const legacy of legacyActiveRows) {
          legacy.isPublished = false;
          legacy.publicDisplayStatus = "archived";
          legacy.publicDisplayNote =
            "Archived by Sunway official publication cleanup because the 2026 official programme row set supersedes this legacy placeholder row.";
          legacy.reviewReason = "Legacy Sunway placeholder row archived after official 2026 Sunway publication verification.";
          await txProgramRepo.save(legacy);
        }
      }

      if (!preservePublicUniversity || publish) {
        university.programCount = summary.importRows;
        await txUniversityRepo.save(university);
      }
      verification = await verifyImportedRows(manager, university.id, { publish });
      afterVisibility = await captureVisibility(manager, university);
    });

    const catalogCacheCleared = await clearCatalogCache();
    const report = {
      mode: publish ? "published" : "review-imported",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
      beforeVisibility,
      afterVisibility,
      preservationPolicy: publish
        ? "Sunway public university row and 97 official programme rows were updated transactionally for public display."
        : preservePublicUniversity
          ? "Existing public Sunway university row was preserved; review rows were added as non-public candidates."
          : "Sunway university row is non-public needs-review for review-only import.",
      summary,
      verification
    };
    mkdirSync(dirname(reportOutput), { recursive: true });
    writeFileSync(reportOutput, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
