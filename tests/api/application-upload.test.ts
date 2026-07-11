import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import {
  MAX_APPLICATION_UPLOAD_BYTES,
  isPreviewableApplicationMimeType,
  validateApplicationUploadFile
} from "../../apps/api/src/common/application-upload.ts";

function uploadFile(overrides: Partial<{ originalname: string; mimetype: string; size: number }> = {}) {
  return {
    originalname: "passport.pdf",
    mimetype: "application/pdf",
    size: 1024,
    ...overrides
  };
}

describe("application upload validation", () => {
  test("accepts PDF and supported image uploads", () => {
    assert.doesNotThrow(() => validateApplicationUploadFile(uploadFile()));
    assert.doesNotThrow(() => validateApplicationUploadFile(uploadFile({ originalname: "photo.JPG", mimetype: "image/jpeg" })));
    assert.doesNotThrow(() => validateApplicationUploadFile(uploadFile({ originalname: "transcript.png", mimetype: "image/png" })));
    assert.doesNotThrow(() => validateApplicationUploadFile(uploadFile({ originalname: "portfolio.webp", mimetype: "image/webp" })));
  });

  test("rejects unsupported mime types", () => {
    assert.throws(
      () => validateApplicationUploadFile(uploadFile({ originalname: "essay.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })),
      BadRequestException
    );
  });

  test("rejects mime and extension mismatches", () => {
    assert.throws(() => validateApplicationUploadFile(uploadFile({ originalname: "passport.exe", mimetype: "application/pdf" })), BadRequestException);
    assert.throws(() => validateApplicationUploadFile(uploadFile({ originalname: "photo.pdf", mimetype: "image/jpeg" })), BadRequestException);
  });

  test("rejects files over 20MB", () => {
    assert.throws(() => validateApplicationUploadFile(uploadFile({ size: MAX_APPLICATION_UPLOAD_BYTES + 1 })), BadRequestException);
  });

  test("reports previewable PDF and image mime types", () => {
    assert.equal(isPreviewableApplicationMimeType("application/pdf"), true);
    assert.equal(isPreviewableApplicationMimeType("image/png"), true);
    assert.equal(isPreviewableApplicationMimeType("application/zip"), false);
  });
});
