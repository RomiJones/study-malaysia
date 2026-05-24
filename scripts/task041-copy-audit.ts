import { SUPPORTED_LOCALES, type SupportedLocale } from "@studymy/shared";
import { messages } from "../apps/web/src/i18n/messages.ts";
import {
  cleanDisplayText,
  formatCategoryLabel,
  formatProgramDuration,
  formatProgramLanguage,
  officialPageFallback
} from "../apps/web/src/utils/format.ts";

type CheckResult = {
  name: string;
  status: "passed";
  detail?: unknown;
};

type MessagePath = `${string}.${string}`;

type GlossaryEntry = {
  path: MessagePath;
  expected: Record<SupportedLocale, string>;
};

const checks: CheckResult[] = [];

function runCheck(name: string, fn: () => unknown) {
  const detail = fn();
  checks.push({ name, status: "passed", detail });
}

function checkGlossaryMessageSamples() {
  const failures: string[] = [];

  for (const entry of glossaryEntries) {
    for (const locale of SUPPORTED_LOCALES) {
      const actual = messageAt(locale, entry.path);
      const expected = entry.expected[locale];
      if (actual !== expected) {
        failures.push(`${locale} ${entry.path}: expected "${expected}", received "${actual}"`);
      }
    }
  }

  assert(failures.length === 0, `TASK-041 glossary message samples failed:\n${failures.join("\n")}`);

  return {
    sampleCount: glossaryEntries.length,
    locales: SUPPORTED_LOCALES
  };
}

function checkCopyTerminologyBoundaries() {
  const failures: string[] = [];
  const zhCNText = collectStringLeaves(messages["zh-CN"]).map((item) => item.value).join("\n");
  const zhTWText = collectStringLeaves(messages["zh-TW"]).map((item) => item.value).join("\n");
  const enText = collectStringLeaves(messages.en).map((item) => item.value).join("\n");
  const msText = collectStringLeaves(messages.ms).map((item) => item.value).join("\n");

  for (const term of zhCNForbiddenTerms) {
    if (zhCNText.includes(term)) failures.push(`zh-CN still contains disallowed copy term: ${term}`);
  }

  for (const term of zhTWForbiddenTerms) {
    if (zhTWText.includes(term)) failures.push(`zh-TW still contains disallowed copy term: ${term}`);
  }

  for (const term of englishForbiddenTerms) {
    if (enText.includes(term)) failures.push(`en still contains outdated copy term: ${term}`);
  }

  for (const term of malayForbiddenTerms) {
    if (msText.includes(term)) failures.push(`ms still contains outdated copy term: ${term}`);
  }

  assert(!containsCjk(enText), "English UI messages must not contain Chinese text");
  assert(!containsCjk(msText), "Malay UI messages must not contain Chinese text");
  assert(failures.length === 0, `TASK-041 terminology boundary check failed:\n${failures.join("\n")}`);

  return {
    zhCNForbiddenHitCount: 0,
    zhTWForbiddenHitCount: 0,
    englishForbiddenHitCount: 0,
    malayForbiddenHitCount: 0
  };
}

function checkMalayIsNotEnglishFallback() {
  const enLeaves = Object.fromEntries(collectStringLeaves(messages.en).map((item) => [item.path, item.value]));
  const msLeaves = Object.fromEntries(collectStringLeaves(messages.ms).map((item) => [item.path, item.value]));
  const equalPaths = Object.entries(msLeaves)
    .filter(([path, value]) => enLeaves[path] === value && !allowedEqualMalayEnglishPaths.has(path))
    .map(([path]) => path);

  assert(equalPaths.length === 0, `Malay messages still fall back to English:\n${equalPaths.join("\n")}`);

  return {
    malayEnglishFallbackCount: 0
  };
}

function checkDynamicCopySamples() {
  const failures: string[] = [];

  const fallbackExpectations: Record<SupportedLocale, string> = {
    en: "Refer to the official university page",
    ms: "Rujuk halaman rasmi universiti",
    "zh-CN": "以院校官方页面为准",
    "zh-TW": "以院校官方頁面為準"
  };

  for (const locale of SUPPORTED_LOCALES) {
    const actual = officialPageFallback(locale);
    if (actual !== fallbackExpectations[locale]) {
      failures.push(`${locale} official page fallback: expected "${fallbackExpectations[locale]}", received "${actual}"`);
    }
  }

  const categoryExpectations: Array<[unknown, SupportedLocale, string]> = [
    ["理科", "en", "Science"],
    ["商科", "ms", "Perniagaan"],
    ["建筑与建成环境", "zh-TW", "建築與建成環境"],
    ["unknown raw category", "ms", "Program lain"]
  ];

  for (const [value, locale, expected] of categoryExpectations) {
    const actual = formatCategoryLabel(value, locale);
    if (actual !== expected) {
      failures.push(`${locale} category ${String(value)}: expected "${expected}", received "${actual}"`);
    }
  }

  const traditionalSample = cleanDisplayText("软件工程硕士（软件技术）", "", "zh-TW");
  if (traditionalSample !== "軟體工程碩士（軟體技術）") {
    failures.push(`zh-TW dynamic text conversion failed: ${traditionalSample}`);
  }

  const complexAcademicProgram = {
    publicDisplayStatus: "ready",
    durationOfficial: "Full-Time Duration: 6 Semesters, (Clinical) — official page title is Doctor of Public Health (Mixed-Mode)",
    durationYears: null,
    officialLanguageRequirement: "Language requirements are subject to official review.",
    languageRequirement: { ielts: null }
  } as any;

  for (const locale of ["zh-CN", "zh-TW", "ms"] as const) {
    const duration = formatProgramDuration(complexAcademicProgram, locale);
    const language = formatProgramLanguage(complexAcademicProgram, undefined, locale);
    const fallback = officialPageFallback(locale);
    if (duration !== fallback) failures.push(`${locale} complex duration should use localized fallback, received: ${duration}`);
    if (language !== fallback) failures.push(`${locale} unknown English language note should use localized fallback, received: ${language}`);
  }

  assert(failures.length === 0, `TASK-041 dynamic copy samples failed:\n${failures.join("\n")}`);

  return {
    categorySamples: categoryExpectations.length,
    dynamicFallbackSamples: 3
  };
}

function messageAt(locale: SupportedLocale, path: string): string {
  const value = path.split(".").reduce<unknown>((node, key) => {
    if (!node || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[key];
  }, messages[locale]);
  return typeof value === "string" ? value : "";
}

function collectStringLeaves(value: unknown, prefix = ""): Array<{ path: string; value: string }> {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({ path: `${prefix}.${index}`, value: String(item) }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => collectStringLeaves(item, prefix ? `${prefix}.${key}` : key));
  }
  return [{ path: prefix, value: String(value) }];
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const glossaryEntries: GlossaryEntry[] = [
  {
    path: "nav.home",
    expected: {
      en: "University Directory",
      ms: "Universiti",
      "zh-CN": "院校库",
      "zh-TW": "院校庫"
    }
  },
  {
    path: "nav.favorites",
    expected: {
      en: "Shortlist",
      ms: "Senarai Pendek",
      "zh-CN": "收藏",
      "zh-TW": "收藏"
    }
  },
  {
    path: "nav.member",
    expected: {
      en: "Student Center",
      ms: "Pusat Pelajar",
      "zh-CN": "会员中心",
      "zh-TW": "會員中心"
    }
  },
  {
    path: "common.university",
    expected: {
      en: "University",
      ms: "Universiti",
      "zh-CN": "院校",
      "zh-TW": "院校"
    }
  },
  {
    path: "common.program",
    expected: {
      en: "Programme",
      ms: "Program",
      "zh-CN": "专业",
      "zh-TW": "專業"
    }
  },
  {
    path: "home.category",
    expected: {
      en: "Programme category",
      ms: "Kategori program",
      "zh-CN": "专业方向",
      "zh-TW": "專業方向"
    }
  },
  {
    path: "home.level",
    expected: {
      en: "Degree level",
      ms: "Tahap ijazah",
      "zh-CN": "学位层级",
      "zh-TW": "學位層級"
    }
  },
  {
    path: "program.entryLanguageRequirements",
    expected: {
      en: "Entry and language requirements",
      ms: "Syarat kemasukan dan bahasa",
      "zh-CN": "入学与语言要求",
      "zh-TW": "入學與語言要求"
    }
  },
  {
    path: "university.programmeLevels",
    expected: {
      en: "Programme levels",
      ms: "Tahap program",
      "zh-CN": "专业层级",
      "zh-TW": "專業層級"
    }
  },
  {
    path: "university.programmeHeading",
    expected: {
      en: "{level} programmes",
      ms: "Program {level}",
      "zh-CN": "{level}专业",
      "zh-TW": "{level}專業"
    }
  },
  {
    path: "university.publicReady",
    expected: {
      en: "Ready for public display",
      ms: "Sedia untuk paparan awam",
      "zh-CN": "可公开展示",
      "zh-TW": "可公開展示"
    }
  },
  {
    path: "auth.failed",
    expected: {
      en: "Authentication failed. Please check your account details and try again.",
      ms: "Pengesahan gagal. Sila semak butiran akaun dan cuba lagi.",
      "zh-CN": "认证失败，请检查账号信息后重试。",
      "zh-TW": "認證失敗，請檢查帳號資訊後重試。"
    }
  }
];

const zhCNForbiddenTerms = [
  "客户",
  "学校",
  "课程层级",
  "{level}项目",
  "可商用展示",
  "免语言申请",
  "马来文",
  "学习入口",
  "雅思",
  "托福"
];

const zhTWForbiddenTerms = [
  "客户",
  "学校",
  "课程层级",
  "{level}项目",
  "可商用展示",
  "免语言申请",
  "马来文",
  "学习入口",
  "软件",
  "责任",
  "农业",
  "申请规划",
  "登录",
  "账号",
  "专业"
];

const englishForbiddenTerms = [
  "Favorites",
  "Favorite programme",
  "Member Center",
  "Login / Register"
];

const malayForbiddenTerms = [
  "Kegemaran",
  "Pusat Ahli",
  "Log Masuk",
  "Daftar ahli"
];

const allowedEqualMalayEnglishPaths = new Set([
  "common.phd",
  "common.visa",
  "common.gpa",
  "common.ielts",
  "degree.phd",
  "category.it",
  "authMethod.wechat",
  "authMethod.qq",
  "planner.tiers.reach",
  "planner.tiers.target",
  "planner.tiers.safe"
]);

runCheck("glossary message samples", checkGlossaryMessageSamples);
runCheck("copy terminology boundaries", checkCopyTerminologyBoundaries);
runCheck("Malay non-English fallback boundary", checkMalayIsNotEnglishFallback);
runCheck("dynamic copy samples", checkDynamicCopySamples);

console.log(JSON.stringify({
  taskId: "TASK-041",
  status: "passed",
  checks
}, null, 2));
