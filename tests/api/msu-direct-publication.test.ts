import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMsuOfficialAuditRows,
  loadMsuReviewedAudit
} from "../../apps/api/src/db/import-msu-official-audit.ts";
import {
  buildMsuPostgraduateReviewRows,
  loadMsuPostgraduateCandidateDataset
} from "../../apps/api/src/db/import-msu-postgraduate-review.ts";
import {
  buildMsuDirectPublicationPatch,
  summarizeMsuDirectPublication,
  verifyMsuDirectPublicationRecordSet
} from "../../apps/api/src/db/publish-msu-review.ts";
import { ProgramsService } from "../../apps/api/src/programs/programs.service.ts";
import { UniversitiesService } from "../../apps/api/src/universities/universities.service.ts";

describe("MSU direct public publication", () => {
  const undergraduateRows = buildMsuOfficialAuditRows(loadMsuReviewedAudit());
  const postgraduateRows = buildMsuPostgraduateReviewRows(loadMsuPostgraduateCandidateDataset());
  const reviewRows = [...undergraduateRows, ...postgraduateRows].map((row, index) => ({
    ...row,
    id: index + 1,
    universityId: 43
  }));
  const publishedRows = reviewRows.map((row) => ({
    ...row,
    ...buildMsuDirectPublicationPatch(row)
  }));

  test("publishes all MSU review rows as public-ready without changing fee source truth", () => {
    const summary = summarizeMsuDirectPublication(publishedRows);

    assert.equal(summary.totalRows, 110);
    assert.deepEqual(summary.byLevel, { bachelor: 80, master: 20, phd: 10 });
    assert.equal(summary.readyRows, 110);
    assert.equal(summary.needsReviewRows, 0);
    assert.equal(summary.publishedRows, 110);
    assert.equal(summary.officialSourceVerifiedRows, 110);
    assert.equal(summary.officialFeeRows, 0);
    assert.equal(summary.nonOfficialCandidateFeeRows, 101);
    assert.equal(summary.missingFeeRows, 9);
    assert.equal(summary.sourceConflictFeeRows, 6);
    assert.equal(summary.pendingFeeCandidateRows, 95);
    assert.equal(summary.notPublishedFeeRows, 9);
    assert.equal(summary.forbiddenPublicTextRows, 0);
    assert.doesNotMatch(JSON.stringify(publishedRows), /待复核译名|待审核译名|待審核譯名|待複核譯名/);
    assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 110 });
    assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 110 });
    assert.deepEqual(summary.feeAuditStatusCounts, {
      "pending-review": 95,
      "source-conflict": 6,
      "not-published": 9
    });
  });

  test("sanitizes public-facing MSU fields while keeping non-official fee notes explicit", () => {
    const byName = new Map(publishedRows.map((row) => [row.nameEnOfficial, row]));

    const computerScience = byName.get("Bachelor in Computer Science (Hons)");
    assert.equal(computerScience?.isPublished, true);
    assert.equal(computerScience?.publicDisplayStatus, "ready");
    assert.equal(computerScience?.officialSourceStatus, "official-verified");
    assert.equal(computerScience?.tuitionDisplay, "RM 28,037 / year");
    assert.equal(computerScience?.officialFeeAuditStatus, "source-conflict");
    assert.match(String(computerScience?.officialTuitionNote), /not an official MSU tuition amount/i);
    assert.doesNotMatch(JSON.stringify(computerScience), /review-only|do not publish|hidden from public|needs-review/i);

    const fashion = byName.get("Master in Fashion Business");
    assert.equal(fashion?.tuitionAmount, null);
    assert.equal(fashion?.officialFeeAuditStatus, "not-published");
    assert.equal(fashion?.tuitionDisplay, "Official international tuition not published");
    assert.match(String(fashion?.officialTuitionNote), /no authorized EasyUni\/Your-Uni annual candidate was matched/i);
  });

  test("verifies the final MSU direct publication record set", () => {
    const university = {
      id: 43,
      code: "MSU",
      programCount: 110,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyMsuDirectPublicationRecordSet(university, publishedRows as any, publishedRows as any);
    assert.equal(verification.totalRows, 110);
    assert.equal(verification.universityProgramCount, 110);
    assert.equal(verification.activeSupersededRows, 0);
  });

  test("keeps the old MSU review link populated after direct publication", async () => {
    const university = {
      id: 43,
      code: "MSU",
      slug: "management-and-science-university",
      name: {
        en: "Management and Science University",
        ms: "Management and Science University",
        "zh-CN": "管理与科学大学",
        "zh-TW": "管理與科學大學"
      },
      shortName: "MSU",
      nameEnOfficial: "Management and Science University",
      logoUrl: "",
      imageUrl: "",
      color: "#114C8D",
      qsRank: 608,
      qsAsiaRank: null,
      location: { en: "Shah Alam", ms: "Shah Alam", "zh-CN": "莎阿南", "zh-TW": "莎阿南" },
      region: { en: "Selangor", ms: "Selangor", "zh-CN": "雪兰莪", "zh-TW": "雪蘭莪" },
      ownership: "private",
      institutionType: "comprehensive",
      foundedYear: 2001,
      students: 0,
      intlStudents: 0,
      csrCertified: false,
      description: {
        en: "Management and Science University",
        ms: "Management and Science University",
        "zh-CN": "管理与科学大学",
        "zh-TW": "管理與科學大學"
      },
      website: "https://www.msu.edu.my",
      admissionEmail: "",
      officialWebsite: "https://www.msu.edu.my",
      officialProfile: {
        catalogStatusSummary: {
          all: { total: 110, ready: 110, needsReview: 0, notAvailableForInternational: 0 },
          byLevel: {
            bachelor: { total: 80, ready: 80, needsReview: 0, notAvailableForInternational: 0 },
            master: { total: 20, ready: 20, needsReview: 0, notAvailableForInternational: 0 },
            phd: { total: 10, ready: 10, needsReview: 0, notAvailableForInternational: 0 }
          }
        }
      },
      officialSources: [],
      officialSourceStatus: "official-verified",
      facilities: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
      highlights: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
      tuitionMinCny: 0,
      tuitionMaxCny: 0,
      livingCostCny: 0,
      minIelts: 0,
      acceptNoLanguage: false,
      programCount: 110,
      isPublished: true,
      publicDisplayStatus: "ready",
      programs: publishedRows
    } as any;

    const universitiesService = new UniversitiesService(
      { findOne: async ({ where }: any) => where?.code === "MSU" ? university : null } as any,
      { find: async () => publishedRows } as any,
      { find: async () => [] } as any,
      { getJson: async () => null, setJson: async () => undefined } as any
    );
    const preview = await universitiesService.getReviewPreview("management-and-science-university", "msu-official-audit-2026") as any;
    assert.equal(preview.programs.length, 110);
    assert.equal(preview.reviewPreview.programmeCount, 110);
    assert.equal(preview.catalogStatusSummary.all.ready, 110);
    assert.equal(preview.catalogStatusSummary.all.needsReview, 0);

    const programsService = new ProgramsService(
      {
        findOne: async ({ where }: any) => {
          const row = publishedRows.find((item) => where?.id === item.id || where?.slug === item.slug);
          return row ? { ...row, university } : null;
        }
      } as any,
      { findOneBy: async () => university } as any,
      { getJson: async () => null, setJson: async () => undefined } as any
    );
    const programPreview = await programsService.getReviewPreviewByIdentifier(
      "msu-review-20260630-postgraduate-phd-024-doctor-of-philosophy-in-engineering",
      "msu-official-audit-2026"
    ) as any;
    assert.equal(programPreview.publicDisplayStatus, "ready");
    assert.equal(programPreview.university.code, "MSU");
  });
});
