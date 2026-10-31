import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildApplicationProfileSnapshot,
  summarizeApplicationProfile
} from "../../apps/api/src/common/application-profile.ts";
import type { PlannerProfileEntity } from "../../apps/api/src/db/entities.ts";

function profile(overrides: Partial<PlannerProfileEntity> = {}): PlannerProfileEntity {
  return {
    id: 1,
    userId: 10,
    level: "master",
    targetCategory: "it",
    budgetCny: 90000,
    gpa: 3.2,
    ielts: 6,
    experience: "1-2 years",
    acceptNoLanguage: true,
    contactInfo: {},
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
    profileVersion: 3,
    completenessStatus: "complete",
    metadata: null,
    user: null as never,
    recommendationRuns: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as PlannerProfileEntity;
}

describe("application profile snapshot", () => {
  test("builds a stable snapshot and merges submit contact fallback", () => {
    const snapshot = buildApplicationProfileSnapshot(profile(), {
      snapshotAt: "2026-07-01T10:00:00.000Z",
      fallbackContact: {
        fullName: "Student A",
        email: "student@example.com",
        phone: "60123456789"
      }
    });

    assert.equal(snapshot?.snapshotAt, "2026-07-01T10:00:00.000Z");
    assert.equal(snapshot?.profileVersion, 3);
    assert.equal(snapshot?.contactInfo.fullName, "Student A");
    assert.equal(snapshot?.contactInfo.phone, "60123456789");
    assert.equal(snapshot?.academicBackground.schoolName, "Test University");
  });

  test("marks missing contact before other profile statuses", () => {
    const snapshot = buildApplicationProfileSnapshot(profile({ contactInfo: {} }));
    const summary = summarizeApplicationProfile(snapshot);

    assert.equal(summary.status, "missing-contact");
    assert.equal(summary.statusLabel, "缺联系方式");
    assert.ok(summary.missingLabels.includes("联系方式"));
  });

  test("marks missing language when score or test plan is absent", () => {
    const snapshot = buildApplicationProfileSnapshot(profile({
      contactInfo: { phone: "60123456789" },
      languageProfile: {}
    }));
    const summary = summarizeApplicationProfile(snapshot);

    assert.equal(summary.status, "missing-language");
    assert.ok(summary.missingLabels.includes("语言成绩或考试计划"));
  });

  test("keeps academic gaps as insufficient even when most profile fields exist", () => {
    const snapshot = buildApplicationProfileSnapshot(profile({
      contactInfo: { phone: "60123456789" },
      academicBackground: {
        currentEducation: "本科毕业",
        averageScore: "82/100"
      }
    }));
    const summary = summarizeApplicationProfile(snapshot);

    assert.equal(summary.status, "insufficient");
    assert.ok(summary.missingLabels.includes("毕业/就读院校"));
    assert.ok(summary.missingLabels.includes("所学专业"));
  });

  test("marks complete profile when critical application fields are present", () => {
    const snapshot = buildApplicationProfileSnapshot(profile({ contactInfo: { phone: "60123456789" } }));
    const summary = summarizeApplicationProfile(snapshot);

    assert.equal(summary.status, "complete");
    assert.equal(summary.statusLabel, "档案完整");
    assert.equal(summary.completion, 100);
  });
});
