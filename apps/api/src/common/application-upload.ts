import { BadRequestException } from "@nestjs/common";
import path from "node:path";

export const MAX_APPLICATION_UPLOAD_BYTES = 20 * 1024 * 1024;

export const APPLICATION_UPLOAD_ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

export const APPLICATION_UPLOAD_MIME_EXTENSION_MAP: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};

export interface ApplicationUploadFileLike {
  originalname: string;
  mimetype: string;
  size: number;
}

export function validateApplicationUploadFile(file: ApplicationUploadFileLike) {
  if (file.size > MAX_APPLICATION_UPLOAD_BYTES) throw new BadRequestException("File is too large");

  const extension = path.extname(file.originalname).toLowerCase();
  const acceptedExtensions = APPLICATION_UPLOAD_MIME_EXTENSION_MAP[file.mimetype];
  if (!acceptedExtensions || !acceptedExtensions.includes(extension)) {
    throw new BadRequestException("Only PDF, JPG, PNG or WebP files are allowed");
  }
}

export function isPreviewableApplicationMimeType(mimeType?: string) {
  return Boolean(mimeType && APPLICATION_UPLOAD_MIME_EXTENSION_MAP[mimeType]);
}
