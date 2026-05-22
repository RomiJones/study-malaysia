import fs from "node:fs";

const htmlPath = "D:/mydev/StudyMY_UM_v58_na_display_tidy.html";
const html = fs.readFileSync(htmlPath, "utf8");

function extractLiteral(name) {
  const needle = `const ${name} =`;
  const start = html.indexOf(needle);
  if (start < 0) {
    throw new Error(`Missing literal: ${name}`);
  }

  let cursor = html.indexOf("=", start) + 1;
  while (/\s/.test(html[cursor])) cursor += 1;

  const open = html[cursor];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) {
    throw new Error(`Unexpected literal opener for ${name}: ${open}`);
  }

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let i = cursor; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(cursor, i + 1);
      }
    }
  }

  throw new Error(`Unclosed literal: ${name}`);
}

function evaluateLiteral(name) {
  return Function(`return (${extractLiteral(name)});`)();
}

const universitiesBase = evaluateLiteral("universitiesBase");
const universitiesSupplement = evaluateLiteral("universitiesSupplement");
const officialUniversityPatches = evaluateLiteral("officialUniversityPatches");

function mergeUniquePrograms(programLists = []) {
  const map = new Map();
  programLists.flat().forEach((program) => {
    if (!program) return;
    const key = [program.name, program.level, program.category, program.nameEn].filter(Boolean).join("||");
    if (!map.has(key)) {
      map.set(key, JSON.parse(JSON.stringify(program)));
      return;
    }
    const existing = map.get(key);
    const merged = { ...existing, ...program };

    for (const field of ["intake", "applicationDocs", "curriculum", "careers"]) {
      merged[field] = Array.from(new Set([...(existing[field] || []), ...(program[field] || [])]));
    }

    if (existing.specializations || program.specializations) {
      merged.specializations = Array.from(
        new Set([...(existing.specializations || []), ...(program.specializations || [])])
      );
    }
    merged.language = { ...(existing.language || {}), ...(program.language || {}) };
    merged.requirements = { ...(existing.requirements || {}), ...(program.requirements || {}) };
    map.set(key, merged);
  });
  return Array.from(map.values());
}

function dedupeUniversities(list = []) {
  const map = new Map();

  function normalizeUniName(name = "") {
    return String(name || "")
      .replace(/\u9a6c\u6765\u897f\u4e9a\u7406\u5de5\u5927\u5b66/g, "\u9a6c\u6765\u897f\u4e9a\u5de5\u827a\u5927\u5b66")
      .trim()
      .toLowerCase();
  }

  function normalizeUniWebsite(url = "") {
    return String(url || "")
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/$/, "")
      .trim()
      .toLowerCase();
  }

  list.forEach((uni) => {
    if (!uni) return;

    const key = [
      String(uni.shortName || "").trim().toLowerCase(),
      normalizeUniWebsite(uni.website),
      normalizeUniName(uni.name),
      String(uni.nameEn || "").trim().toLowerCase()
    ].join("||");

    if (!map.has(key)) {
      map.set(key, JSON.parse(JSON.stringify(uni)));
      return;
    }

    const existing = map.get(key);
    const merged = { ...existing, ...uni };
    merged.id = existing.id;
    merged.name = existing.name || uni.name;
    merged.nameEn = existing.nameEn || uni.nameEn;
    merged.shortName = existing.shortName || uni.shortName;
    merged.website = existing.website && existing.website !== "#" ? existing.website : uni.website || existing.website;
    merged.programs = mergeUniquePrograms([existing.programs || [], uni.programs || []]);
    merged.facilities = Array.from(new Set([...(existing.facilities || []), ...(uni.facilities || [])]));
    merged.highlights = Array.from(new Set([...(existing.highlights || []), ...(uni.highlights || [])]));
    merged.tuitionRange = {
      min: Math.min(existing.tuitionRange?.min || Infinity, uni.tuitionRange?.min || Infinity),
      max: Math.max(existing.tuitionRange?.max || 0, uni.tuitionRange?.max || 0)
    };
    if (!Number.isFinite(merged.tuitionRange.min)) {
      merged.tuitionRange.min = existing.tuitionRange?.min || uni.tuitionRange?.min || 0;
    }
    merged.minIELTS = Math.min(existing.minIELTS || Infinity, uni.minIELTS || Infinity);
    if (!Number.isFinite(merged.minIELTS)) {
      merged.minIELTS = existing.minIELTS || uni.minIELTS || 0;
    }
    merged.acceptNoLanguage = existing.acceptNoLanguage || uni.acceptNoLanguage;
    map.set(key, merged);
  });

  return Array.from(map.values());
}

const universities = dedupeUniversities([...universitiesBase, ...universitiesSupplement]);
universities.forEach((uni) => {
  const patch = officialUniversityPatches[uni.name];
  if (!patch) return;
  Object.keys(patch).forEach((key) => {
    if (key === "facilities") {
      uni.facilities = [...new Set([...(uni.facilities || []), ...(patch.facilities || [])])];
    } else if (key === "highlights") {
      uni.highlights = [...new Set([...(uni.highlights || []), ...(patch.highlights || [])])];
    } else {
      uni[key] = patch[key];
    }
  });
});

const programs = universities.flatMap((uni) =>
  (uni.programs || []).map((program) => ({
    ...program,
    universityName: uni.name,
    universityShortName: uni.shortName
  }))
);
const readyPrograms = programs.filter((program) => program.publicDisplayStatus === "ready");

function countBy(list, key) {
  return list.reduce((acc, item) => {
    const raw = typeof key === "function" ? key(item) : item[key];
    const value = raw || "__missing__";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function hasValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

const coverageFields = [
  "officialTuitionMYR",
  "officialFeeSourceUrl",
  "officialDuration",
  "officialIntake",
  "officialLanguageRequirement",
  "officialAcademicRequirement",
  "chinaStudentRequirement",
  "officialSourceUrl",
  "officialVerifiedAt",
  "officialSourceStatus",
  "publicDisplayStatus",
  "officialFeeAuditStatus",
  "officialAccreditationNote"
];

const fieldCoverage = Object.fromEntries(
  coverageFields.map((field) => [field, programs.filter((program) => hasValue(program[field])).length])
);

const result = {
  fileBytes: fs.statSync(htmlPath).size,
  htmlChars: html.length,
  htmlLines: html.split(/\r?\n/).length,
  title: html.match(/<title>(.*?)<\/title>/i)?.[1] || null,
  baseUniversities: universitiesBase.length,
  supplementUniversities: universitiesSupplement.length,
  mergedUniversities: universities.length,
  mergedPrograms: programs.length,
  statusCounts: countBy(programs, "publicDisplayStatus"),
  readyPrograms: readyPrograms.length,
  readyByLevel: countBy(readyPrograms, "level"),
  readyCategoryCount: new Set(readyPrograms.map((program) => program.category).filter(Boolean)).size,
  readyCategories: [...new Set(readyPrograms.map((program) => program.category).filter(Boolean))].sort(),
  fieldCoverage
};

console.log(JSON.stringify(result, null, 2));
