import "reflect-metadata";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DataSource } from "typeorm";
import type { OfficialSourceLink } from "@studymy/shared";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";
import { segiOfficialProgramPages, segi2026ProgramFees } from "./import-segi-2026-fee-sheet.js";
import { loadEnvFiles } from "../config/env.js";

const verifiedAt = "2026-06-17";
const programmeSearchUrl = "https://university.segi.edu.my/course-search/";

function sourceLinksFor(code: string): OfficialSourceLink[] | null {
  const page = segiOfficialProgramPages[code];
  if (!page) return null;
  return [
    {
      title: `SEGi official programme page - ${page.title}`,
      url: page.url,
      sourceType: "profile",
      verifiedAt,
      status: page.status || "official-verified",
      note: page.note || "Official SEGi programme detail page verified in the 2026-06-16 source-link audit."
    }
  ];
}

function appendAuditNote(existing: string | null, officialUrl: string) {
  const note = `Official programme source link calibrated to ${officialUrl} on 2026-06-17; local fee-sheet path removed from public source-link fields.`;
  if (!existing) return note;
  if (existing.includes("Official programme source link calibrated")) return existing;
  return `${existing}\n${note}`;
}

async function run() {
  loadEnvFiles();
  const dataSource = new DataSource({
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

  await dataSource.initialize();
  try {
    const backupDir = join(process.cwd(), "tmp/backups");
    mkdirSync(backupDir, { recursive: true });
    const backupPath = join(backupDir, `segi-before-source-link-sync-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

    const summary = await dataSource.transaction(async (manager) => {
      const universities = manager.getRepository(UniversityEntity);
      const programs = manager.getRepository(ProgramEntity);
      const university = await universities.findOne({ where: { code: "SEGI" } });
      if (!university) throw new Error("SEGi University row was not found.");

      const existingPrograms = await programs.find({ where: { universityId: university.id, publicDisplayStatus: "ready", isPublished: true } });
      writeFileSync(
        backupPath,
        JSON.stringify({ university, programs: existingPrograms }, null, 2),
        "utf8"
      );

      const expectedCodes = new Set(segi2026ProgramFees.map((program) => program.code));
      const missingMappings = [...expectedCodes].filter((code) => !segiOfficialProgramPages[code]);
      if (missingMappings.length) {
        throw new Error(`Missing official source mappings for SEGi codes: ${missingMappings.join(", ")}`);
      }

      let updated = 0;
      const missingRows: string[] = [];
      const needsReviewMappings: string[] = [];
      for (const code of expectedCodes) {
        const program = existingPrograms.find((item) => item.code === code);
        const page = segiOfficialProgramPages[code];
        if (!program) {
          missingRows.push(code);
          continue;
        }
        if (page.status === "needs-review") needsReviewMappings.push(code);

        program.officialSourceUrl = page.url;
        program.officialEntryRequirementSourceUrl = page.url;
        program.officialAccreditationSourceUrl = page.url;
        program.officialFeeSourceUrl = "";
        program.secondaryOfficialFeeSourceUrl = "";
        program.sourceUrls = sourceLinksFor(code);
        program.officialVerifiedAt = verifiedAt;
        program.officialSourceStatus = page.status || "official-verified";
        program.publicDisplayNote =
          "Programme source link is calibrated to the official SEGi detail page. Fee amount is retained from the provided 2026 fee sheet because the official detail page did not publish a public tuition link in the source-link audit.";
        program.auditNote = appendAuditNote(program.auditNote, page.url);
        await programs.save(program);
        updated += 1;
      }

      university.officialSources = [
        {
          title: "SEGi University official website",
          url: "https://university.segi.edu.my/",
          sourceType: "official-website",
          verifiedAt,
          status: "official-verified"
        },
        {
          title: "SEGi University programme search",
          url: programmeSearchUrl,
          sourceType: "study-portal",
          verifiedAt,
          status: "official-verified"
        }
      ];
      university.officialVerifiedAt = verifiedAt;
      university.officialSourceStatus = "official-verified";
      university.officialAuditSummary =
        "SEGi public programme source links were calibrated to official SEGi programme detail pages; local fee-sheet paths were removed from public source-link fields.";
      await universities.save(university);

      const postRows = await programs.find({ where: { universityId: university.id, publicDisplayStatus: "ready", isPublished: true } });
      const localPathRows = postRows.filter((program) => {
        const text = JSON.stringify({
          officialSourceUrl: program.officialSourceUrl,
          officialFeeSourceUrl: program.officialFeeSourceUrl,
          officialEntryRequirementSourceUrl: program.officialEntryRequirementSourceUrl,
          officialAccreditationSourceUrl: program.officialAccreditationSourceUrl,
          sourceUrls: program.sourceUrls
        });
        return text.includes("/Users/ian/") || text.includes("世纪大学学费单2026.pdf");
      });
      const officialProgramSourceRows = postRows.filter((program) => program.officialSourceUrl.startsWith("https://university.segi.edu.my/course/"));
      const audit = {
        institution: "SEGI",
        verifiedAt,
        updated,
        readyRows: postRows.length,
        officialProgramSourceRows: officialProgramSourceRows.length,
        publicLocalPathSourceRows: localPathRows.map((program) => program.code),
        needsReviewMappings,
        missingRows,
        backupPath,
        publicationDecision: localPathRows.length === 0 && missingRows.length === 0 ? "source-links-corrected" : "needs-review"
      };
      writeFileSync(
        join(process.cwd(), "../../data/imports/segi/2026-06-16/official-audit/post_import_display_audit.json"),
        JSON.stringify(audit, null, 2),
        "utf8"
      );
      return audit;
    });

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
