import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildIntelligentApplicationMaterials,
  createManualApplicationMaterial,
  aggregateApplicationMaterialStatus,
  linkApplicationMaterialFromLibrary,
  reopenApplicationMaterial,
  summarizeApplicationMaterials,
  waiveApplicationMaterial
} from "../../apps/api/src/common/application-materials.ts";
import { buildStudentApplicationTodos } from "../../apps/api/src/common/application-workflow.ts";
import type { ApplicationProfileSnapshot } from "../../apps/api/src/common/application-profile.ts";

function snapshot(overrides: Partial<ApplicationProfileSnapshot> = {}): ApplicationProfileSnapshot {
  return {
    snapshotAt: "2026-07-01T10:00:00.000Z",
    level: "master",
    targetCategory: "it",
    budgetCny: 90000,
    gpa: 3.2,
    ielts: 6,
    experience: "1-2 years",
    acceptNoLanguage: true,
    contactInfo: { phone: "60123456789" },
    academicBackground: {
      currentEducation: "本科毕业",
      schoolName: "Test University",
      majorName: "Computer Science",
      averageScore: "82/100"
    },
    languageProfile: {
      overallScore: "IELTS 6.0",
      testDate: "2026-03"
    },
    studyPreferences: {
      intake: "2026-09",
      preferredCities: ["Kuala Lumpur"]
    },
    serviceNeeds: {
      needs: ["application"]
    },
    ...overrides
  };
}

describe("intelligent application material checklist", () => {
  test("generates master degree materials with source and requirement metadata", () => {
    const materials = buildIntelligentApplicationMaterials({
      applicationDocs: { "zh-CN": ["护照首页"] },
      profileSnapshot: snapshot()
    });

    assert.ok(materials.some((item) => item.key === "passport-full-scan" && item.title === "整本护照扫描件"));
    assert.ok(materials.some((item) => item.key === "bachelor-notarized-docs"));
    assert.ok(materials.some((item) => item.key === "college-upgrade-notarized-docs" && item.requirementLevel === "conditional"));
    assert.ok(materials.some((item) => item.key === "overseas-credential-verification" && item.requirementLevel === "conditional"));
    assert.ok(materials.some((item) => item.key === "id-photo-white-background"));
    assert.equal(materials.find((item) => item.key === "passport-full-scan")?.sourceLabel, "院校要求");
    assert.equal(materials.find((item) => item.key === "bachelor-notarized-docs")?.groupLabel, "学历与成绩公证");
    assert.equal(materials.find((item) => item.key === "passport-full-scan")?.uploadTips?.some((tip) => tip.includes("18 个月")), true);
  });

  test("generates bachelor and phd specific materials", () => {
    const bachelor = buildIntelligentApplicationMaterials({ profileSnapshot: snapshot({ level: "bachelor" }) });
    const phd = buildIntelligentApplicationMaterials({ profileSnapshot: snapshot({ level: "phd" }) });

    assert.ok(bachelor.some((item) => item.key === "high-school-notarized-docs"));
    assert.ok(bachelor.some((item) => item.key === "passport-full-scan"));
    assert.ok(bachelor.some((item) => item.key === "id-photo-white-background"));
    assert.ok(phd.some((item) => item.key === "bachelor-master-notarized-docs"));
    assert.ok(phd.some((item) => item.key === "research-proposal"));
    assert.ok(phd.some((item) => item.key === "recommendation-letter" && item.note?.includes("两封")));
    assert.ok(phd.some((item) => item.key === "cv-work-proof"));
  });

  test("adds conditional language score proof or language plan", () => {
    const scored = buildIntelligentApplicationMaterials({ profileSnapshot: snapshot() });
    const materials = buildIntelligentApplicationMaterials({
      profileSnapshot: snapshot({
        ielts: 5.5,
        languageProfile: { overallScore: "IELTS 5.5" }
      })
    });

    const scoreProof = scored.find((item) => item.key === "language-score-proof");
    const languageProof = materials.find((item) => item.key === "language-score-proof");
    const languagePlan = buildIntelligentApplicationMaterials({ profileSnapshot: snapshot({ ielts: undefined, languageProfile: {} }) }).find((item) => item.key === "language-follow-up-plan");
    assert.equal(scoreProof?.sourceLabel, "语言条件");
    assert.equal(languageProof?.requirementLevel, "conditional");
    assert.equal(languagePlan?.title, "英文成绩或考试计划说明");
  });

  test("adds scholarship and visa preparation items from service needs", () => {
    const materials = buildIntelligentApplicationMaterials({
      profileSnapshot: snapshot({
        studyPreferences: { scholarshipNeeded: true, preferredCities: ["Penang"] },
        serviceNeeds: { needs: ["application", "visa"] }
      })
    });

    assert.ok(materials.some((item) => item.key === "scholarship-supporting-docs" && item.sourceLabel === "奖学金需求"));
    assert.ok(materials.some((item) => item.key === "visa-preparation-docs" && item.sourceLabel === "签证服务需求"));
  });

  test("links a material library file as a new pending application material version", () => {
    const [currentMaterial] = buildIntelligentApplicationMaterials({ profileSnapshot: snapshot() });
    const linked = linkApplicationMaterialFromLibrary(
      currentMaterial,
      {
        id: 8,
        title: "护照首页",
        materialType: "passport",
        fileName: "passport.pdf",
        mimeType: "application/pdf",
        size: 1200,
        storagePath: "library/10/passport/passport.pdf",
        currentVersionId: "v2",
        version: 2,
        uploadedAt: "2026-07-01T09:00:00.000Z"
      },
      "2026-07-01T10:00:00.000Z"
    );

    assert.equal(linked.linkedFromLibrary, true);
    assert.equal(linked.libraryMaterialId, 8);
    assert.equal(linked.libraryVersionId, "v2");
    assert.equal(linked.libraryVersion, 2);
    assert.equal(linked.reviewStatus, "pending-review");
    assert.equal(linked.versions?.[0]?.linkedFromLibrary, true);
    assert.equal(linked.versions?.[0]?.storagePath, "library/10/passport/passport.pdf");
  });

  test("creates, waives and reopens manually adjusted materials", () => {
    const manual = createManualApplicationMaterial({
      title: "补充作品集",
      note: "请上传 PDF 作品集",
      requirementLevel: "conditional",
      source: "staff",
      reason: "艺术方向个案需要补充作品集。"
    });
    const waived = waiveApplicationMaterial(manual, { id: 3, displayName: "Advisor" }, "学生申请方向无需提交作品集。", "2026-07-01T10:00:00.000Z");
    const summary = summarizeApplicationMaterials([waived]);
    const todos = buildStudentApplicationTodos({ applicationStatus: "submitted", expectedDecisionDate: null, assignedAdminId: 3 }, [waived]);

    assert.equal(manual.sourceLabel, "后台调整");
    assert.equal(manual.requirementLevelLabel, "条件触发");
    assert.equal(waived.isWaived, true);
    assert.equal(summary.total, 0);
    assert.equal(summary.waived, 1);
    assert.equal(aggregateApplicationMaterialStatus([waived]), "done");
    assert.equal(todos.some((item) => item.materialKey === waived.key), false);

    const reopened = reopenApplicationMaterial(waived);
    assert.equal(reopened.isWaived, false);
    assert.equal(reopened.reviewStatus, "not-uploaded");
    assert.equal(summarizeApplicationMaterials([reopened]).total, 1);
  });
});
