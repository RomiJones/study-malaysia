import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, Like, Not, type DeepPartial, type EntityManager } from "typeorm";
import type {
  DegreeLevel,
  FeeAuditStatus,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  ProgramCategoryCode,
  PublicDisplayStatus,
  TuitionCurrency
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const UNM_OFFICIAL_AUDIT_SLUG_PREFIX = "unm-official-2026-row-";
export const DEFAULT_UNM_OFFICIAL_AUDIT_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/unm/2026-06-19/official-audit/08_candidate_dataset.json"
);

const verifiedAt = "2026-06-19";
const cnyPerMyr = 1.55;
const applicationChecklistUrl = "https://www.nottingham.edu.my/Study/How-to-apply/checklist-for-applications.aspx";
const howToApplyUrl = "https://www.nottingham.edu.my/Study/How-to-apply/how-to-apply.aspx";

type UNMLevel = DegreeLevel;
type UNMFeeStatus = "verified-official-total" | "calculated-from-official-rate";

interface UNMSource {
  id: string;
  url: string;
  sourceType: string;
  role: string;
  fields: string[];
  retrievedAt: string;
  academicSession: string;
  status: string;
  localPath?: string;
  sha256?: string;
}

interface UNMApplicationDocuments {
  state: "official-value";
  sourceUrl: string;
  sourceId: string;
  documents: string[];
  officialText: string;
  note?: string;
}

interface UNMTuitionCalculation {
  method: string;
  officialAnnualRateAmount: number;
  officialAnnualRateCurrency: "MYR";
  officialMinimumFullTimeDurationYears: number;
  formula: string;
  sourceBasis: string;
  sourceFeeText: string;
  sourceDurationText: string;
  note: string;
}

interface UNMCandidateProgramme {
  code: string;
  universityCode: "UNM";
  nameEnOfficial: string;
  name: LocalizedText;
  level: UNMLevel;
  facultyEn: string;
  campus: string;
  studyMode: "coursework" | "research" | string;
  studyType: "coursework" | "research" | string;
  studyArrangement: string;
  applicantScope: "international";
  academicSession: string;
  durationOfficial: string;
  officialIntake: string;
  tuitionAmount: number | null;
  tuitionCurrency: "MYR";
  tuitionBasis: string;
  tuitionDisplay: string;
  officialTuitionAmount: number | null;
  officialTuitionBasis: string;
  officialAnnualTuitionAmount: number | null;
  officialMinimumFullTimeDurationYears: number | null;
  tuitionCalculation: UNMTuitionCalculation | null;
  tuitionAcademicSession: string;
  feeStatus: UNMFeeStatus;
  officialFeeSourceUrl: string;
  officialAcademicRequirement: string;
  officialLanguageRequirement: string;
  applicationDocuments: UNMApplicationDocuments;
  overview: { officialText: string };
  courseSetting: { state: string; officialText: string };
  careerDirections: { state: string; officialText: string };
  researchOrAwardVariants: string[];
  officialSourceUrl: string;
  officialVerifiedAt: string;
  officialSourceStatus: string;
  publicDisplayStatus: "ready";
  reviewReason: string;
  sourceIds: string[];
  evidence: Array<{ sourceId: string; sourceUrl: string; fields: string[]; retrievedAt: string; sourceText?: string }>;
  fieldEvidence: Array<{ sourceId: string; sourceUrl: string; fields: string[]; retrievedAt: string; sourceText?: string }>;
}

export interface UNMCandidateDataset {
  schemaVersion: number;
  universityCode: "UNM";
  officialDomains: string[];
  collectionScope: "full";
  levels: UNMLevel[];
  applicantScope: "international";
  academicSession: string;
  retrievedAt: string;
  declaredProgrammeCount: number;
  university: {
    code: "UNM";
    nameEnOfficial: string;
    legalEntity: string;
    licenseCode: string;
    officialWebsite: string;
    officialAddress: string;
    officialPhone: string;
    foundedMalaysiaCampus: string;
    officialProfileFacts: string[];
    officialSources: string[];
  };
  sources: UNMSource[];
  programmes: UNMCandidateProgramme[];
}

export interface UNMImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<UNMLevel, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialTotalRows: number;
  calculatedFromOfficialRateRows: number;
  officialDurationRows: number;
  applicationDocumentRows: number;
  localizedNameRows: number;
  localizedFacultyRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UNMImportVerification extends UNMImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  legacyPublicRows: number;
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

const zeroLevelCounts = (): Record<UNMLevel, number> => ({
  bachelor: 0,
  diploma: 0,
  master: 0,
  "postgraduate-certificate": 0,
  "postgraduate-diploma": 0,
  phd: 0
});

const facultyZh: Record<string, { zhCN: string; zhTW: string }> = {
  "Nottingham University Business School (NUBS)": { zhCN: "诺丁汉大学商学院", zhTW: "諾丁漢大學商學院" },
  "Nottingham University of Business School (NUBS)": { zhCN: "诺丁汉大学商学院", zhTW: "諾丁漢大學商學院" },
  "School of Economics": { zhCN: "经济学院", zhTW: "經濟學院" },
  "School of Education": { zhCN: "教育学院", zhTW: "教育學院" },
  "School of Humanities": { zhCN: "人文学院", zhTW: "人文學院" },
  "School of Politics and International Relations": { zhCN: "政治与国际关系学院", zhTW: "政治與國際關係學院" },
  "Department of Chemical and Environment Engineering": { zhCN: "化学与环境工程系", zhTW: "化學與環境工程系" },
  "Department of Chemical and Environmental Engineering": { zhCN: "化学与环境工程系", zhTW: "化學與環境工程系" },
  "Department of Civil Engineering": { zhCN: "土木工程系", zhTW: "土木工程系" },
  "Department of Electrical and Electronic Engineering": { zhCN: "电气与电子工程系", zhTW: "電氣與電子工程系" },
  "Department of Mechanical, Materials and Manufacturing Engineering": { zhCN: "机械、材料与制造工程系", zhTW: "機械、材料與製造工程系" },
  "School of Biosciences": { zhCN: "生物科学学院", zhTW: "生物科學學院" },
  "School of Environmental and Geographical Sciences": { zhCN: "环境与地理科学学院", zhTW: "環境與地理科學學院" },
  "School of Computer Science": { zhCN: "计算机科学学院", zhTW: "電腦科學學院" },
  "School of Mathematical Sciences": { zhCN: "数学科学学院", zhTW: "數學科學學院" },
  "Division of Biomedical Sciences": { zhCN: "生物医学科学部", zhTW: "生物醫學科學部" },
  "School of Pharmacy": { zhCN: "药学院", zhTW: "藥學院" },
  "Institute of Work, Organisation and Wellbeing": { zhCN: "工作、组织与福祉研究所", zhTW: "工作、組織與福祉研究所" },
  "School of Psychology": { zhCN: "心理学学院", zhTW: "心理學學院" },
  "Faculty of Science and Engineering - Engineering Discipline": { zhCN: "科学与工程学院工程学科", zhTW: "科學與工程學院工程學科" }
};

const subjectZh: Record<string, { zhCN: string; zhTW: string }> = {
  "Business Economics and Finance": { zhCN: "商业经济与金融", zhTW: "商業經濟與金融" },
  "Finance, Accounting and Management": { zhCN: "金融、会计与管理", zhTW: "金融、會計與管理" },
  "Finance, Management and Business Analytics": { zhCN: "金融、管理与商业分析", zhTW: "金融、管理與商業分析" },
  "International Business Management": { zhCN: "国际商务管理", zhTW: "國際商務管理" },
  Economics: { zhCN: "经济学", zhTW: "經濟學" },
  "Economics and International Economics": { zhCN: "经济学与国际经济学", zhTW: "經濟學與國際經濟學" },
  "Education (TESOL)": { zhCN: "教育（TESOL）", zhTW: "教育（TESOL）" },
  TESOL: { zhCN: "英语教学", zhTW: "英語教學" },
  "English Language and Literature": { zhCN: "英语语言与文学", zhTW: "英語語言與文學" },
  "English with Creative Writing": { zhCN: "英语与创意写作", zhTW: "英語與創意寫作" },
  "International Communications Studies": { zhCN: "国际传播研究", zhTW: "國際傳播研究" },
  "International Communication Studies with English Language and Literature": { zhCN: "国际传播研究与英语语言文学", zhTW: "國際傳播研究與英語語言文學" },
  "International Communication Studies with Film and Television Studies": { zhCN: "国际传播研究与影视研究", zhTW: "國際傳播研究與影視研究" },
  "International Communications Studies with Performing Arts": { zhCN: "国际传播研究与表演艺术", zhTW: "國際傳播研究與表演藝術" },
  "International Relations": { zhCN: "国际关系", zhTW: "國際關係" },
  "International Relations with French": { zhCN: "国际关系与法语", zhTW: "國際關係與法語" },
  "International Relations with Spanish": { zhCN: "国际关系与西班牙语", zhTW: "國際關係與西班牙語" },
  "Chemical Engineering": { zhCN: "化学工程", zhTW: "化學工程" },
  "Chemical with Environmental Engineering": { zhCN: "化学与环境工程", zhTW: "化學與環境工程" },
  "Civil Engineering": { zhCN: "土木工程", zhTW: "土木工程" },
  "Electrical and Electronic Engineering": { zhCN: "电气与电子工程", zhTW: "電氣與電子工程" },
  "Mechatronic Engineering": { zhCN: "机电一体化工程", zhTW: "機電一體化工程" },
  "Mechanical Engineering": { zhCN: "机械工程", zhTW: "機械工程" },
  Biotechnology: { zhCN: "生物技术", zhTW: "生物技術" },
  "Environmental Science": { zhCN: "环境科学", zhTW: "環境科學" },
  Nutrition: { zhCN: "营养学", zhTW: "營養學" },
  "Computer Science": { zhCN: "计算机科学", zhTW: "電腦科學" },
  "Computer Science with Artificial Intelligence": { zhCN: "计算机科学与人工智能", zhTW: "電腦科學與人工智慧" },
  "Mathematics and Data Science": { zhCN: "数学与数据科学", zhTW: "數學與資料科學" },
  "Biomedical Science": { zhCN: "生物医学科学", zhTW: "生物醫學科學" },
  "Pharmaceutical and Health Sciences": { zhCN: "药学与健康科学", zhTW: "藥學與健康科學" },
  Pharmacy: { zhCN: "药学", zhTW: "藥學" },
  "Applied Psychology and Management": { zhCN: "应用心理学与管理", zhTW: "應用心理學與管理" },
  Psychology: { zhCN: "心理学", zhTW: "心理學" },
  "Psychology and Cognitive Neuroscience": { zhCN: "心理学与认知神经科学", zhTW: "心理學與認知神經科學" },
  "Organisational Psychology": { zhCN: "组织心理学", zhTW: "組織心理學" },
  "Applied Psychology": { zhCN: "应用心理学", zhTW: "應用心理學" },
  "Business and Management": { zhCN: "商业与管理", zhTW: "商業與管理" },
  "Business (International Management)": { zhCN: "商业（国际管理）", zhTW: "商業（國際管理）" },
  "Special and Inclusive Education": { zhCN: "特殊与融合教育", zhTW: "特殊與融合教育" },
  "Teaching of English to Speakers of Other Languages (TESOL)": { zhCN: "对外英语教学（TESOL）", zhTW: "對外英語教學（TESOL）" },
  Education: { zhCN: "教育学", zhTW: "教育學" },
  English: { zhCN: "英语", zhTW: "英語" },
  "Media, Communications and Culture": { zhCN: "媒体、传播与文化", zhTW: "媒體、傳播與文化" },
  "Media, Languages and Cultures": { zhCN: "媒体、语言与文化", zhTW: "媒體、語言與文化" },
  "Politics, History and International Relations": { zhCN: "政治、历史与国际关系", zhTW: "政治、歷史與國際關係" },
  "Environmental Engineering": { zhCN: "环境工程", zhTW: "環境工程" },
  Engineering: { zhCN: "工程学", zhTW: "工程學" },
  Biosciences: { zhCN: "生物科学", zhTW: "生物科學" },
  "Geographical and Environmental Sciences": { zhCN: "地理与环境科学", zhTW: "地理與環境科學" },
  "Mathematical Sciences": { zhCN: "数学科学", zhTW: "數學科學" },
  "Developmental Disorders": { zhCN: "发展障碍", zhTW: "發展障礙" }
};

const documentZh: Record<string, { zhCN: string; zhTW: string; ms: string }> = {
  "Scanned copies of certificates, transcripts and any other supporting documents": {
    zhCN: "证书、成绩单及其他支持材料的扫描件",
    zhTW: "證書、成績單及其他支持材料的掃描件",
    ms: "Salinan imbasan sijil, transkrip dan dokumen sokongan lain"
  },
  "Official English translation together with the originals if original documents are not in English": {
    zhCN: "非英文原件需同时提交官方英文翻译和原件",
    zhTW: "非英文原件需同時提交官方英文翻譯和原件",
    ms: "Terjemahan rasmi bahasa Inggeris bersama dokumen asal jika dokumen asal bukan dalam bahasa Inggeris"
  },
  "Proof of English language competency, if any": {
    zhCN: "英语能力证明（如有）",
    zhTW: "英語能力證明（如有）",
    ms: "Bukti kecekapan bahasa Inggeris, jika ada"
  },
  "Identification page of passport for international applicants": {
    zhCN: "国际申请人的护照信息页",
    zhTW: "國際申請人的護照資料頁",
    ms: "Halaman pengenalan pasport untuk pemohon antarabangsa"
  },
  "Relevant academic transcripts such as SPM, IGCSE, O Levels, High School Diploma, AS Level, A Level, STPM, UEC, IB Diploma, Foundation or Diploma": {
    zhCN: "相关学历成绩单，如 SPM、IGCSE、O Levels、高中毕业文凭、AS/A Level、STPM、UEC、IB、预科或文凭",
    zhTW: "相關學歷成績單，如 SPM、IGCSE、O Levels、高中畢業文憑、AS/A Level、STPM、UEC、IB、預科或文憑",
    ms: "Transkrip akademik berkaitan seperti SPM, IGCSE, O Levels, High School Diploma, AS/A Level, STPM, UEC, IB, Foundation atau Diploma"
  },
  "Forecast results if official results are not yet available": {
    zhCN: "正式成绩尚未公布时提交预估成绩",
    zhTW: "正式成績尚未公布時提交預估成績",
    ms: "Keputusan ramalan jika keputusan rasmi belum tersedia"
  },
  "Certificate or letter of completion if examinations have been completed": {
    zhCN: "考试已完成时提交完成证明或完成信",
    zhTW: "考試已完成時提交完成證明或完成信",
    ms: "Sijil atau surat tamat jika peperiksaan telah selesai"
  },
  "Gap Year Explanation Form if there is a gap of more than one year between the highest qualification and the application": {
    zhCN: "最高学历与申请之间间隔超过一年时提交间隔年说明表",
    zhTW: "最高學歷與申請之間間隔超過一年時提交間隔年說明表",
    ms: "Borang penjelasan tahun jurang jika terdapat jurang lebih setahun antara kelayakan tertinggi dan permohonan"
  },
  "Undergraduate academic transcripts such as bachelor's degree transcripts": {
    zhCN: "本科阶段成绩单，如学士学位成绩单",
    zhTW: "本科階段成績單，如學士學位成績單",
    ms: "Transkrip akademik peringkat sarjana muda"
  },
  "Graduation certificate or letter of completion": {
    zhCN: "毕业证书或完成信",
    zhTW: "畢業證書或完成信",
    ms: "Sijil tamat pengajian atau surat tamat"
  },
  "Other relevant higher qualifications such as master's degree documents where applicable": {
    zhCN: "其他相关高等学历材料，如适用的硕士学位材料",
    zhTW: "其他相關高等學歷材料，如適用的碩士學位材料",
    ms: "Kelayakan tinggi lain yang berkaitan seperti dokumen ijazah sarjana jika berkenaan"
  },
  "Academic transcript with marks to date and a list of pending modules if the degree has not yet been completed": {
    zhCN: "学位尚未完成时提交截至目前成绩单及待完成模块清单",
    zhTW: "學位尚未完成時提交截至目前成績單及待完成模組清單",
    ms: "Transkrip dengan markah semasa dan senarai modul tertunggak jika ijazah belum selesai"
  },
  "Curriculum vitae or resume for applicants with work experience": {
    zhCN: "有工作经验申请人的简历",
    zhTW: "有工作經驗申請人的履歷",
    ms: "Curriculum vitae atau resume untuk pemohon berpengalaman kerja"
  },
  "Two satisfactory references or recommendation letters for MBA and postgraduate research": {
    zhCN: "MBA 与研究型研究生申请需两封合格推荐信",
    zhTW: "MBA 與研究型研究生申請需兩封合格推薦信",
    ms: "Dua rujukan atau surat cadangan yang memuaskan untuk MBA dan penyelidikan pascasiswazah"
  },
  "Research proposal of 1,000 to 3,000 words for postgraduate research applicants": {
    zhCN: "研究型研究生申请需 1,000 至 3,000 字研究计划",
    zhTW: "研究型研究生申請需 1,000 至 3,000 字研究計畫",
    ms: "Cadangan penyelidikan 1,000 hingga 3,000 patah perkataan untuk pemohon penyelidikan pascasiswazah"
  }
};

export function validateUnmOfficialAuditDataset(dataset: UNMCandidateDataset): string[] {
  const errors: string[] = [];
  if (dataset.universityCode !== "UNM") errors.push("Dataset universityCode must be UNM.");
  if (dataset.university?.code !== "UNM") errors.push("University code must be UNM.");
  if (dataset.collectionScope !== "full") errors.push("UNM import expects full collection scope.");
  if (dataset.applicantScope !== "international") errors.push("UNM import expects international applicant scope.");
  if (!dataset.officialDomains?.includes("nottingham.edu.my")) errors.push("Official domain nottingham.edu.my is required.");
  if (dataset.declaredProgrammeCount !== 81) errors.push(`Declared programme count must be 81; got ${dataset.declaredProgrammeCount}.`);
  if (dataset.programmes.length !== 81) errors.push(`Candidate programme count must be 81; got ${dataset.programmes.length}.`);
  if (!dataset.sources.some((source) => source.id === "application-checklist")) errors.push("Application checklist source is required.");

  const levelCounts = countBy(dataset.programmes, (row) => row.level);
  if (levelCounts.bachelor !== 36) errors.push(`Expected 36 bachelor rows; got ${levelCounts.bachelor || 0}.`);
  if (levelCounts.master !== 28) errors.push(`Expected 28 master rows; got ${levelCounts.master || 0}.`);
  if (levelCounts.phd !== 15) errors.push(`Expected 15 phd rows; got ${levelCounts.phd || 0}.`);
  if (levelCounts["postgraduate-certificate"] !== 1) errors.push(`Expected 1 postgraduate-certificate row; got ${levelCounts["postgraduate-certificate"] || 0}.`);
  if (levelCounts["postgraduate-diploma"] !== 1) errors.push(`Expected 1 postgraduate-diploma row; got ${levelCounts["postgraduate-diploma"] || 0}.`);

  dataset.programmes.forEach((row, index) => {
    const ordinal = index + 1;
    if (row.universityCode !== "UNM") errors.push(`Row ${ordinal} universityCode is not UNM.`);
    if (row.applicantScope !== "international") errors.push(`Row ${ordinal} applicant scope is not international.`);
    if (row.publicDisplayStatus !== "ready") errors.push(`Row ${ordinal} must be ready.`);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!row.facultyEn) errors.push(`Row ${ordinal} has no faculty.`);
    if (!row.officialSourceUrl?.includes("nottingham.edu.my")) errors.push(`Row ${ordinal} has no official UNM source URL.`);
    if (!row.officialFeeSourceUrl?.includes("nottingham.edu.my")) errors.push(`Row ${ordinal} has no official UNM fee source URL.`);
    if (row.applicationDocuments?.state !== "official-value" || !row.applicationDocuments.documents?.length) {
      errors.push(`Row ${ordinal} has no official application document checklist.`);
    }
    if (!["verified-official-total", "calculated-from-official-rate"].includes(row.feeStatus)) {
      errors.push(`Row ${ordinal} has unsupported fee status ${row.feeStatus}.`);
    }
    if (row.feeStatus === "calculated-from-official-rate" && !row.tuitionCalculation?.formula) {
      errors.push(`Row ${ordinal} is rate-derived without a formula.`);
    }
    if (row.tuitionAmount == null || row.tuitionAmount <= 0) errors.push(`Row ${ordinal} has no publishable total tuition amount.`);
  });

  return errors;
}

export function buildUnmOfficialProgramRows(dataset: UNMCandidateDataset): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate, index) => {
    const ordinal = index + 1;
    const durationYears = parseDurationYears(candidate);
    const amount = Number(candidate.tuitionAmount || 0);
    const annualRate = Number(candidate.officialAnnualTuitionAmount || (durationYears > 0 ? amount / durationYears : amount));
    const fee = feePresentation(candidate);
    const faculty = localizedFaculty(candidate.facultyEn);
    const sourceLinks = buildSourceLinks(candidate);
    const level = candidate.level;

    return {
      slug: `${UNM_OFFICIAL_AUDIT_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: unmShortCode(level, ordinal),
      name: localizedProgramName(candidate.nameEnOfficial),
      nameEnOfficial: candidate.nameEnOfficial,
      level,
      category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate),
      campus: candidate.campus || "Semenyih, Selangor, Malaysia",
      durationYears,
      durationOfficial: normalizeText(candidate.durationOfficial || "Official duration published on programme detail page."),
      annualTuitionCny: Math.round(annualRate * cnyPerMyr),
      tuitionAmount: amount,
      tuitionCurrency: "MYR" as TuitionCurrency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: amount,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: candidate.officialFeeSourceUrl,
      secondaryOfficialFeeSourceUrl: candidate.officialSourceUrl === candidate.officialFeeSourceUrl ? "" : candidate.officialSourceUrl,
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: parseIntakeMonths(candidate.officialIntake),
      officialIntake: normalizeText(candidate.officialIntake, 255),
      officialIntakeNote: "Captured from the current UNM official programme detail page.",
      languageRequirement: parseLanguageRequirement(candidate.officialLanguageRequirement),
      officialLanguageRequirement: normalizeLongText(candidate.officialLanguageRequirement),
      requirement: {
        gpa: 0,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          "UNM states that candidates are considered on an individual basis and publishes programme-specific academic requirements on the linked official detail page.",
          "UNM menyatakan bahawa calon dinilai secara individu dan menerbitkan syarat akademik khusus program pada halaman rasmi yang dipautkan.",
          "UNM 说明申请会按个人情况评估，并在官方项目详情页公布对应学术要求。",
          "UNM 說明申請會按個人情況評估，並在官方項目詳情頁公布對應學術要求。"
        )
      },
      officialAcademicRequirement: normalizeLongText(candidate.officialAcademicRequirement),
      chinaStudentRequirement: "Chinese applicants are assessed through UNM's international applicant process; final equivalency is determined by UNM.",
      specialRequirementsNote: [
        candidate.studyArrangement ? `Official study arrangement: ${candidate.studyArrangement}.` : "",
        candidate.tuitionCalculation ? `Tuition formula: ${candidate.tuitionCalculation.formula}.` : "",
        candidate.tuitionCalculation?.note || ""
      ].filter(Boolean).join(" "),
      applicationDocs: localizedDocuments(candidate.applicationDocuments.documents),
      curriculum: localizedEvidenceList(candidate.courseSetting?.officialText, "课程设置以 UNM 官方英文页面为准；来源链接已在本页列出。", "課程設置以 UNM 官方英文頁面為準；來源連結已在本頁列出。"),
      careers: localizedEvidenceList(candidate.careerDirections?.officialText, "就业方向以 UNM 官方英文页面为准；来源链接已在本页列出。", "就業方向以 UNM 官方英文頁面為準；來源連結已在本頁列出。"),
      specializations: arr((candidate.researchOrAwardVariants || []).filter(Boolean)),
      description: localizedDescription(candidate),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official accreditation source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: candidate.officialSourceUrl,
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks,
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: "official-verified" as OfficialSourceStatus,
      publicDisplayStatus: "ready" as PublicDisplayStatus,
      publicDisplayNote: "Published from the audited 2026 UNM official programme catalogue; StudyMY localisations are non-official.",
      reviewReason: null,
      auditNote: [
        `Original UNM candidate code: ${candidate.code}.`,
        `Fee status: ${candidate.feeStatus}; basis: ${candidate.tuitionBasis}; official source basis: ${candidate.officialTuitionBasis}.`,
        candidate.tuitionCalculation ? `Formula evidence: ${candidate.tuitionCalculation.formula}.` : "UNM publishes this fee as a per-programme total.",
        `Application documents source: ${candidate.applicationDocuments.sourceUrl}.`,
        `Field evidence: ${JSON.stringify(candidate.fieldEvidence || [])}.`
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: true
    };
  });
}

export function buildUnmUniversityRow(dataset: UNMCandidateDataset, summary: UNMImportSummary): DeepPartial<UniversityEntity> {
  const officialSources = dataset.sources.slice(0, 24).map<OfficialSourceLink>((source) => ({
    title: source.id,
    url: source.url,
    sourceType: sourceTypeFor(source),
    verifiedAt,
    status: "official-verified",
    note: `${source.role}; fields ${source.fields.join(", ")}; source status ${source.status}; sha256 ${source.sha256 || "not-recorded"}`
  }));

  return {
    slug: "university-of-nottingham-malaysia",
    code: "UNM",
    name: t("University of Nottingham Malaysia", "University of Nottingham Malaysia", "诺丁汉大学马来西亚校区", "諾丁漢大學馬來西亞校區"),
    shortName: "UNM",
    logoUrl: "",
    imageUrl: "",
    color: "#0055A0",
    qsRank: 97,
    qsAsiaRank: null,
    location: t("Semenyih, Selangor", "Semenyih, Selangor", "雪兰莪士毛月", "雪蘭莪士毛月"),
    region: t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 2000,
    students: 0,
    intlStudents: 0,
    csrCertified: false,
    description: t(
      "University of Nottingham Malaysia is the Malaysia campus of the University of Nottingham. StudyMY publishes the full audited 2026 UNM official programme catalogue for international applicants.",
      "University of Nottingham Malaysia ialah kampus Malaysia bagi University of Nottingham. StudyMY memaparkan katalog program rasmi UNM 2026 yang telah diaudit untuk pemohon antarabangsa.",
      "诺丁汉大学马来西亚校区是英国诺丁汉大学的马来西亚校区。StudyMY 本次发布面向国际申请人的 2026 年 UNM 官方公布专业全集。",
      "諾丁漢大學馬來西亞校區是英國諾丁漢大學的馬來西亞校區。StudyMY 本次發布面向國際申請人的 2026 年 UNM 官方公布專業全集。"
    ),
    website: dataset.university.officialWebsite,
    admissionEmail: "",
    nameEnOfficial: dataset.university.nameEnOfficial,
    officialWebsite: dataset.university.officialWebsite,
    studyPortalUrl: "https://www.nottingham.edu.my/Study/index.aspx",
    internationalPageUrl: "https://www.nottingham.edu.my/Study/International-students/index.aspx",
    applicationPortalUrl: howToApplyUrl,
    officialAddress: dataset.university.officialAddress,
    applicationPeriods: ["UNM programme pages publish intake months by programme; application timing should be confirmed on the official application route."],
    applicationFees: ["Application fee and route are published on the UNM official how-to-apply page."],
    applicationDocuments: localizedDocuments([
      "Scanned copies of certificates, transcripts and any other supporting documents",
      "Official English translation together with the originals if original documents are not in English",
      "Proof of English language competency, if any",
      "Identification page of passport for international applicants"
    ]),
    chinaStudentRequirements: arr([
      "Chinese applicants follow UNM international admission, English, visa and supporting document rules; final equivalency is assessed by UNM."
    ], [
      "Pemohon China mengikuti syarat kemasukan antarabangsa, bahasa Inggeris, visa dan dokumen sokongan UNM; kesetaraan akhir dinilai oleh UNM."
    ], [
      "中国申请人需遵循 UNM 国际招生、英语、签证和支持材料要求；最终学历等效由 UNM 审核。"
    ], [
      "中國申請人需遵循 UNM 國際招生、英語、簽證和支持材料要求；最終學歷等效由 UNM 審核。"
    ]),
    officialProfile: {
      collectionScope: "UNM full official bachelor, master, doctoral, PGCert and PGDip catalogue import",
      applicantScope: dataset.applicantScope,
      academicSession: dataset.academicSession,
      retrievedAt: dataset.retrievedAt,
      officialDomains: dataset.officialDomains,
      legalEntity: dataset.university.legalEntity,
      licenseCode: dataset.university.licenseCode,
      officialPhone: dataset.university.officialPhone,
      levels: ["bachelor", "master", "postgraduate-certificate", "postgraduate-diploma", "phd"],
      studyModes: ["Coursework", "Research"],
      sourceUniversityCode: dataset.universityCode,
      authorization: "controlled-public-import",
      tuitionAudit: {
        officialTotalRows: summary.officialTotalRows,
        calculatedFromOfficialRateRows: summary.calculatedFromOfficialRateRows,
        notes: [
          "UNM PGT/PGCert/PGDip per-programme totals are displayed as official totals.",
          "UNM bachelor and PGR totals are calculated only from official annual rate and official minimum full-time duration; formulas and exclusions are preserved on programme detail pages."
        ]
      },
      catalogStatusSummary: {
        all: {
          total: summary.importRows,
          ready: summary.readyRows,
          currentCycleNotOpen: 0,
          needsReview: 0,
          notAvailableForInternational: 0
        },
        byLevel: {
          bachelor: levelSummary(summary.byLevel.bachelor),
          master: levelSummary(summary.byLevel.master),
          "postgraduate-certificate": levelSummary(summary.byLevel["postgraduate-certificate"]),
          "postgraduate-diploma": levelSummary(summary.byLevel["postgraduate-diploma"]),
          phd: levelSummary(summary.byLevel.phd)
        }
      }
    },
    officialSources,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified",
    officialAuditSummary:
      `UNM controlled public import: ${summary.importRows} official published programmes are ready and public-visible from audited UNM sources; counts are bachelor ${summary.byLevel.bachelor}, master ${summary.byLevel.master}, PGCert ${summary.byLevel["postgraduate-certificate"]}, PGDip ${summary.byLevel["postgraduate-diploma"]}, PhD ${summary.byLevel.phd}. Fees include ${summary.officialTotalRows} official total rows and ${summary.calculatedFromOfficialRateRows} formula-backed totals from official annual rates.`,
    publicDisplayStatus: "ready",
    livingCostOfficialNote: null,
    tuitionMinCny: 0,
    tuitionMaxCny: 0,
    livingCostCny: 24000,
    minIelts: 6.5,
    acceptNoLanguage: false,
    facilities: arr([
      "Semenyih campus",
      "Official UNM programme pages and application checklist are linked in StudyMY programme details"
    ], [
      "Kampus Semenyih",
      "Halaman program rasmi UNM dan senarai semak permohonan dipautkan dalam butiran program StudyMY"
    ], [
      "士毛月校区",
      "StudyMY 专业详情页已链接 UNM 官方项目页和申请材料 checklist"
    ], [
      "士毛月校區",
      "StudyMY 專業詳情頁已連結 UNM 官方項目頁和申請材料 checklist"
    ]),
    highlights: arr([
      "Full audited official UNM programme catalogue",
      "PGCert and PGDip are displayed separately and not merged into master rows",
      "Formula-backed total tuition preserves official annual rate evidence"
    ], [
      "Katalog program rasmi UNM yang diaudit penuh",
      "PGCert dan PGDip dipaparkan secara berasingan dan tidak digabungkan dengan sarjana",
      "Jumlah yuran berasaskan formula mengekalkan bukti kadar tahunan rasmi"
    ], [
      "完整审核 UNM 官方公布专业全集",
      "PGCert 和 PGDip 独立展示，不合并进硕士",
      "公式化总学费保留官方年费率证据"
    ], [
      "完整審核 UNM 官方公布專業全集",
      "PGCert 和 PGDip 獨立展示，不合併進碩士",
      "公式化總學費保留官方年費率證據"
    ]),
    programCount: summary.importRows,
    isPublished: true
  };
}

export function summarizeUnmOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UNMImportSummary {
  const byLevel = zeroLevelCounts();
  for (const row of rows) byLevel[row.level as UNMLevel] += 1;
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel,
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialTotalRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    calculatedFromOfficialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate").length,
    officialDurationRows: rows.filter((row) => Number(row.durationYears || 0) > 0 && String(row.durationOfficial || "").length > 0).length,
    applicationDocumentRows: rows.filter((row) => (row.applicationDocs?.en || []).length >= 4).length,
    localizedNameRows: rows.filter((row) => hasBusinessLocalization(row.name)).length,
    localizedFacultyRows: rows.filter((row) => hasBusinessLocalization(row.faculty)).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

function verifyUnmImportedRecordSet(university: UniversityEntity, rows: ProgramEntity[], allUniversityRows: ProgramEntity[]): UNMImportVerification {
  const summary = summarizeUnmOfficialAuditImport(rows);
  const legacyPublicRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(UNM_OFFICIAL_AUDIT_SLUG_PREFIX) && row.isPublished && row.publicDisplayStatus !== "archived"
  ).length;
  if (
    rows.length !== 81 ||
    summary.byLevel.bachelor !== 36 ||
    summary.byLevel.master !== 28 ||
    summary.byLevel.phd !== 15 ||
    summary.byLevel["postgraduate-certificate"] !== 1 ||
    summary.byLevel["postgraduate-diploma"] !== 1 ||
    summary.readyRows !== 81 ||
    summary.needsReviewRows !== 0 ||
    summary.publishedRows !== 81 ||
    summary.officialTotalRows !== 13 ||
    summary.calculatedFromOfficialRateRows !== 68 ||
    summary.applicationDocumentRows !== 81 ||
    summary.localizedNameRows !== 81 ||
    summary.localizedFacultyRows !== 81 ||
    legacyPublicRows !== 0 ||
    !university.isPublished ||
    university.publicDisplayStatus !== "ready" ||
    university.programCount !== 81
  ) {
    throw new Error(`UNM import verification failed: ${JSON.stringify({ summary, legacyPublicRows, universityStatus: university.publicDisplayStatus, universityPublished: university.isPublished, universityProgramCount: university.programCount })}`);
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    legacyPublicRows
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number): Promise<UNMImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UNM university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${UNM_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyUnmImportedRecordSet(university, rows, allUniversityRows);
}

function feePresentation(candidate: UNMCandidateProgramme): {
  display: string;
  auditStatus: FeeAuditStatus;
  note: string;
} {
  const amount = Number(candidate.tuitionAmount || 0);
  const display = `MYR ${amount.toLocaleString("en-US")} total tuition`;
  if (candidate.feeStatus === "verified-official-total") {
    return {
      display,
      auditStatus: "matched-official",
      note: `UNM publishes this international fee as a per-programme total for the 2026 intake. Official source text: ${candidate.officialTuitionAmount ? `RM ${candidate.officialTuitionAmount.toLocaleString("en-US")}` : candidate.tuitionDisplay}. Separate visa, extension, registration, living or other charges are not included unless the official fee source explicitly includes them.`
    };
  }
  const calculation = candidate.tuitionCalculation;
  return {
    display,
    auditStatus: "calculated-from-official-rate",
    note: `StudyMY calculated the standard full-duration total only from UNM official annual rate and official minimum full-time duration: ${calculation?.formula || candidate.tuitionDisplay}. Official annual rate text: ${calculation?.sourceFeeText || candidate.officialTuitionAmount || ""}. Official duration text: ${calculation?.sourceDurationText || candidate.durationOfficial}. Extension, part-time, visa, registration, living and other separate charges are excluded.`
  };
}

function localizedProgramName(name: string): LocalizedText {
  const clean = normalizeAwardSubject(name);
  const subject = (value: string) => subjectZh[value] || { zhCN: value, zhTW: value };
  if (name === "Postgraduate Certificate in Education") return t(name, name, "教育研究生证书", "教育研究生證書");
  if (name === "Postgraduate Diploma in Education") return t(name, name, "教育研究生文凭", "教育研究生文憑");
  if (name === "Executive Master of Business Administration") return t(name, name, "高级工商管理硕士", "高級工商管理碩士");
  if (name === "Bachelor of Pharmacy (Hons)") return t(name, name, "药学荣誉学士", "藥學榮譽學士");
  if (name === "Master of Pharmacy (Hons)") return t(name, name, "药学荣誉硕士", "藥學榮譽碩士");

  const bsc = name.match(/^BSc \(Hons\)(?: in)?\s+(.+)$/);
  if (bsc) {
    const mapped = subject(clean || bsc[1]);
    return t(name, name, `${mapped.zhCN}理学荣誉学士`, `${mapped.zhTW}理學榮譽學士`);
  }
  const ba = name.match(/^BA \(Hons\)(?: in)?\s+(.+)$/);
  if (ba) {
    const mapped = subject(clean || ba[1]);
    return t(name, name, `${mapped.zhCN}文学荣誉学士`, `${mapped.zhTW}文學榮譽學士`);
  }
  const bed = name.match(/^BEd \(Hons\)(?: in)?\s+(.+)$/);
  if (bed) {
    const mapped = subject(clean || bed[1]);
    return t(name, name, `${mapped.zhCN}教育荣誉学士`, `${mapped.zhTW}教育榮譽學士`);
  }
  const meng = name.match(/^MEng \(Hons\)(?: in)?\s+(.+)$/);
  if (meng) {
    const mapped = subject(clean || meng[1]);
    return t(name, name, `${mapped.zhCN}工程荣誉硕士`, `${mapped.zhTW}工程榮譽碩士`);
  }
  const msc = name.match(/^MSc in\s+(.+)$/);
  if (msc) {
    const mapped = subject(msc[1]);
    return t(name, name, `${mapped.zhCN}理学硕士`, `${mapped.zhTW}理學碩士`);
  }
  const ma = name.match(/^MA in\s+(.+)$/);
  if (ma) {
    const mapped = subject(ma[1]);
    return t(name, name, `${mapped.zhCN}文学硕士`, `${mapped.zhTW}文學碩士`);
  }
  const mphil = name.match(/^(.+)\s+MPhil$/);
  if (mphil) {
    const mapped = subject(mphil[1]);
    return t(name, name, `${mapped.zhCN}哲学硕士`, `${mapped.zhTW}哲學碩士`);
  }
  const mres = name.match(/^(.+)\s+MRes$/);
  if (mres) {
    const mapped = subject(mres[1]);
    return t(name, name, `${mapped.zhCN}研究硕士`, `${mapped.zhTW}研究碩士`);
  }
  const phd = name.match(/^(.+)\s+PhD$/);
  if (phd) {
    const mapped = subject(phd[1]);
    return t(name, name, `${mapped.zhCN}博士`, `${mapped.zhTW}博士`);
  }
  return t(name);
}

function normalizeAwardSubject(name: string) {
  return name
    .replace(/^BSc \(Hons\)(?: in)?\s+/, "")
    .replace(/^BA \(Hons\)(?: in)?\s+/, "")
    .replace(/^BEd \(Hons\)(?: in)?\s+/, "")
    .replace(/^MEng \(Hons\)(?: in)?\s+/, "")
    .trim();
}

function localizedFaculty(facultyEn: string): LocalizedText {
  const mapped = facultyZh[facultyEn] || { zhCN: facultyEn, zhTW: facultyEn };
  return t(facultyEn, facultyEn, mapped.zhCN, mapped.zhTW);
}

function localizedDescription(candidate: UNMCandidateProgramme): LocalizedText {
  const levelLabel = levelChinese(candidate.level);
  return t(
    `${candidate.nameEnOfficial} is published in the audited UNM 2026 official programme catalogue for international applicants. Official entry requirements, language rules, tuition evidence and application document links are preserved on this StudyMY detail page.`,
    `${candidate.nameEnOfficial} diterbitkan dalam katalog program rasmi UNM 2026 yang telah diaudit untuk pemohon antarabangsa. Syarat kemasukan, bahasa, bukti yuran dan pautan dokumen permohonan rasmi dikekalkan pada halaman butiran StudyMY ini.`,
    `这是 UNM 2026 官方公布的${levelLabel}项目，面向国际申请人。StudyMY 已在详情页保留官方入学要求、语言要求、费用证据和申请材料来源链接。`,
    `這是 UNM 2026 官方公布的${levelChinese(candidate.level, true)}項目，面向國際申請人。StudyMY 已在詳情頁保留官方入學要求、語言要求、費用證據和申請材料來源連結。`
  );
}

function localizedDocuments(documents: string[]): LocalizedStringArray {
  return arr(
    documents,
    documents.map((doc) => documentZh[doc]?.ms || doc),
    documents.map((doc) => documentZh[doc]?.zhCN || doc),
    documents.map((doc) => documentZh[doc]?.zhTW || documentZh[doc]?.zhCN || doc)
  );
}

function localizedEvidenceList(text: string | undefined, zhCNFallback: string, zhTWFallback: string): LocalizedStringArray {
  const normalized = normalizeLongText(text);
  if (!normalized) return arr([]);
  return arr([normalized], [normalized], [zhCNFallback], [zhTWFallback]);
}

function buildSourceLinks(candidate: UNMCandidateProgramme): OfficialSourceLink[] {
  const urls = new Set([
    candidate.officialSourceUrl,
    candidate.officialFeeSourceUrl,
    candidate.applicationDocuments.sourceUrl || applicationChecklistUrl,
    howToApplyUrl,
    ...candidate.fieldEvidence.map((evidence) => evidence.sourceUrl)
  ].filter(Boolean));
  return Array.from(urls).map((url) => ({
    title: sourceTitle(url, candidate),
    url,
    sourceType: url === candidate.officialFeeSourceUrl ? "fee" : url === candidate.officialSourceUrl ? "study-portal" : url === applicationChecklistUrl ? "admission" : "other",
    verifiedAt,
    status: "official-verified",
    note: url === applicationChecklistUrl
      ? "Official UNM application document checklist."
      : url === candidate.officialFeeSourceUrl
        ? "Official UNM tuition fee source."
        : "Captured in the UNM official audit batch."
  }));
}

function sourceTitle(url: string, candidate: UNMCandidateProgramme) {
  if (url === candidate.officialSourceUrl) return "UNM official programme page";
  if (url === candidate.officialFeeSourceUrl) return "UNM official tuition fee source";
  if (url === applicationChecklistUrl) return "UNM official application checklist";
  if (url === howToApplyUrl) return "UNM official how-to-apply page";
  return "UNM official source";
}

function sourceTypeFor(source: UNMSource): OfficialSourceLink["sourceType"] {
  const fields = source.fields.join(" ").toLowerCase();
  if (/fee|tuition/.test(fields)) return "fee";
  if (/application|document/.test(fields)) return "admission";
  if (/requirement|language/.test(fields)) return "entry-requirement";
  if (/programme|portal|undergraduate|postgraduate/.test(fields)) return "study-portal";
  if (/website|profile|address|history/.test(fields)) return "profile";
  return "other";
}

function parseLanguageRequirement(value: string) {
  const text = String(value || "");
  return {
    ielts: numberAfter(text, /IELTS[^0-9]*(\d+(?:\.\d+)?)/i) || 0,
    toefl: numberAfter(text, /TOEFL[^0-9]*(\d+)/i),
    pte: numberAfter(text, /PTE[^0-9]*(\d+)/i),
    muet: numberAfter(text, /MUET[^0-9]*(\d+)/i)
  };
}

function numberAfter(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|accounting|management|finance|economics|mba/.test(value)) return "business";
  if (/computer|data|artificial intelligence|software/.test(value)) return "it";
  if (/engineering|mechatronic|mechanical|electrical|civil|chemical/.test(value)) return "engineering";
  if (/pharmacy|pharmaceutical|biomedical|psychology|nutrition|health/.test(value)) return "medicine";
  if (/biology|bioscience|science|mathematics|environment|geographical|biotechnology/.test(value)) return "science";
  if (/law/.test(value)) return "law";
  return "arts";
}

function parseDurationYears(candidate: UNMCandidateProgramme) {
  if (candidate.officialMinimumFullTimeDurationYears) return Number(candidate.officialMinimumFullTimeDurationYears);
  const text = String(candidate.durationOfficial || "");
  const months = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (months) return Number((Number(months[1]) / 12).toFixed(1));
  const award = candidate.level === "phd" ? "PhD" : candidate.researchOrAwardVariants?.[0];
  if (award) {
    const scoped = text.match(new RegExp(`${escapeRegExp(award)}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*(?:-|to)?`, "i"));
    if (scoped) return Number(scoped[1]);
  }
  const years = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(?:\d+(?:\.\d+)?)?\s*years?/i);
  return years ? Number(years[1]) : 1;
}

function parseIntakeMonths(value: string) {
  const text = String(value || "");
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  return months.filter((month) => new RegExp(`\\b${month}\\b`, "i").test(text));
}

function studyModeDisplay(candidate: UNMCandidateProgramme) {
  const type = candidate.studyType === "research" ? "Research" : "Coursework";
  const hasPartTime = /part-time/i.test(candidate.studyArrangement);
  const hasFullTime = /full-time/i.test(candidate.studyArrangement);
  if (hasFullTime && hasPartTime) return `${type} / Full-time / Part-time`;
  if (hasFullTime) return `${type} / Full-time`;
  return type;
}

function unmShortCode(level: UNMLevel, ordinal: number) {
  const prefix = level === "bachelor"
    ? "UG"
    : level === "master"
      ? "MA"
      : level === "phd"
        ? "PHD"
        : level === "postgraduate-certificate"
          ? "PGC"
          : "PGD";
  return `UNM-${prefix}-${String(ordinal).padStart(3, "0")}`;
}

function levelChinese(level: UNMLevel, traditional = false) {
  const map: Record<UNMLevel, string> = {
    bachelor: "本科",
    diploma: traditional ? "文憑" : "文凭",
    master: "硕士",
    phd: "博士",
    "postgraduate-certificate": traditional ? "研究生證書" : "研究生证书",
    "postgraduate-diploma": traditional ? "研究生文憑" : "研究生文凭"
  };
  if (traditional && level === "master") return "碩士";
  return map[level];
}

function levelSummary(total: number) {
  return { total, ready: total, currentCycleNotOpen: 0, needsReview: 0, notAvailableForInternational: 0 };
}

function hasBusinessLocalization(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const localized = value as Partial<LocalizedText>;
  const zhCN = String(localized["zh-CN"] || "");
  const zhTW = String(localized["zh-TW"] || "");
  return Boolean(zhCN && zhTW && !/Bachelor|Master of|Master in|Postgraduate Certificate|Postgraduate Diploma|School of|Department of|Faculty of/i.test(`${zhCN} ${zhTW}`));
}

function countBy<T>(items: T[], selector: (item: T) => string | number | null | undefined) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = String(selector(item) || "");
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function slugify(value: string, limit = 90) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (slug.slice(0, limit).replace(/-+$/g, "") || "programme");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLongText(value: unknown) {
  return normalizeText(value, 4000);
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
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

async function ensureLevelColumnCapacity(dataSource: DataSource) {
  await ensureVarcharColumn(dataSource, "programs", "level", 40, "NOT NULL");
  await ensureVarcharColumn(dataSource, "planner_profiles", "level", 40, "NOT NULL DEFAULT 'master'");
}

async function ensureVarcharColumn(dataSource: DataSource, tableName: string, columnName: string, minLength: number, suffix: string) {
  const rows = await dataSource.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]) as Array<{ Type?: string }>;
  const type = String(rows[0]?.Type || "");
  const match = type.match(/^varchar\((\d+)\)/i);
  if (!match || Number(match[1]) >= minLength) return false;
  await dataSource.query(`ALTER TABLE \`${tableName}\` MODIFY \`${columnName}\` varchar(${minLength}) ${suffix}`);
  return true;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const candidatePath = readArgValue("--candidate") || DEFAULT_UNM_OFFICIAL_AUDIT_CANDIDATE_PATH;
  const verifyOnly = process.argv.includes("--verify-only");
  const confirmImport = process.argv.includes("--confirm-import");
  const backupPath =
    readArgValue("--backup-output") || `tmp/backups/unm-official-audit-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

  if (!existsSync(candidatePath)) throw new Error(`UNM candidate dataset not found: ${candidatePath}`);
  const dataset = loadJson<UNMCandidateDataset>(candidatePath);
  const errors = validateUnmOfficialAuditDataset(dataset);
  if (errors.length) throw new Error(`UNM official audit candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildUnmOfficialProgramRows(dataset);
  const summary = summarizeUnmOfficialAuditImport(rows);
  if (
    summary.importRows !== 81 ||
    summary.readyRows !== 81 ||
    summary.publishedRows !== 81 ||
    summary.officialTotalRows !== 13 ||
    summary.calculatedFromOfficialRateRows !== 68 ||
    summary.applicationDocumentRows !== 81 ||
    summary.localizedNameRows !== 81 ||
    summary.localizedFacultyRows !== 81
  ) {
    throw new Error(`UNM row build summary is not publish-ready: ${JSON.stringify(summary)}`);
  }

  if (!confirmImport && !verifyOnly) {
    console.log(JSON.stringify({
      mode: "dry-run",
      candidatePath,
      writePolicy: {
        authorization: "controlled-public-import",
        upsertPrefix: UNM_OFFICIAL_AUDIT_SLUG_PREFIX,
        importRows: 81,
        university: { isPublished: true, publicDisplayStatus: "ready" },
        programmes: { isPublished: true, publicDisplayStatus: "ready" },
        archiveLegacyRows: "Archive existing UNM rows outside the UNM official-audit slug prefix so public API/UI exposes exactly the current 81-row official baseline.",
        backupRequired: true,
        nextStep: "Review this dry-run, then rerun with --confirm-import to create a scoped backup and write transactionally."
      },
      summary
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    if (!verifyOnly) await ensureLevelColumnCapacity(dataSource);
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "UNM" } })) ||
      (await universityRepo.findOne({ where: { slug: "university-of-nottingham-malaysia" } }));

    if (verifyOnly) {
      if (!university) throw new Error("UNM university row not found.");
      console.log(JSON.stringify({
        mode: "verified",
        universityId: university.id,
        summary,
        verification: await verifyImportedRows(dataSource, university.id)
      }, null, 2));
      return;
    }

    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );

    let verification: UNMImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await txUniversityRepo.findOne({ where: { code: "UNM" } });
      const universitySeed = buildUnmUniversityRow(dataset, summary);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousOfficialAuditRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UNM_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
      });
      for (const previous of previousOfficialAuditRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }
      await txProgramRepo.update(
        {
          universityId: university.id,
          slug: Not(Like(`${UNM_OFFICIAL_AUDIT_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by the UNM official public import to prevent stale UNM programme rows from mixing with the current 81-row official baseline.",
          reviewReason: "Superseded by the 2026-06-19 UNM full official programme catalogue import."
        }
      );

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      university.programCount = summary.importRows;
      await txUniversityRepo.save(university);
      verification = await verifyImportedRows(manager, university.id);
    });

    const catalogCacheCleared = await clearCatalogCache();
    console.log(JSON.stringify({
      mode: "imported",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
      summary,
      verification
    }, null, 2));
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
