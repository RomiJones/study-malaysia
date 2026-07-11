import { Controller, Get, Param, Query, Inject } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { UniversitiesService, type UniversityQuery } from "./universities.service.js";

function toArray(value: unknown): string[] | undefined {
  if (value == null || value === "") return undefined;
  const items = (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (value == null || value === "") return undefined;
  return value === true || value === "true";
}

function toStringValue(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const firstValue = Array.isArray(value) ? value[0] : value;
  const text = String(firstValue).trim();
  return text || undefined;
}

function toArrayQuery(query: Record<string, unknown>, key: string): string[] | undefined {
  return toArray(query[key]) || toArray(query[`${key}[]`]);
}

function normalizeUniversitiesQuery(query: Record<string, unknown>): UniversityQuery {
  return {
    search: toStringValue(query.search),
    categories: toArrayQuery(query, "categories"),
    levels: toArrayQuery(query, "levels"),
    ownerships: toArrayQuery(query, "ownerships"),
    types: toArrayQuery(query, "types"),
    institutionTypes: toArrayQuery(query, "institutionTypes"),
    acceptNoLanguage: toBoolean(query.acceptNoLanguage),
    qsRankMax: toNumber(query.qsRankMax),
    tuitionMin: toNumber(query.tuitionMin),
    tuitionMax: toNumber(query.tuitionMax),
    budgetCny: toNumber(query.budgetCny),
    ieltsMax: toNumber(query.ieltsMax),
    page: toNumber(query.page),
    pageSize: toNumber(query.pageSize),
    includeMeta: toBoolean(query.includeMeta)
  };
}

class UniversitiesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  categories?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  levels?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  ownerships?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  types?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  institutionTypes?: string[];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  acceptNoLanguage?: boolean;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  qsRankMax?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  tuitionMin?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  tuitionMax?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  budgetCny?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  ieltsMax?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  pageSize?: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeMeta?: boolean;
}

@Controller("universities")
export class UniversitiesController {
  private readonly universitiesService: UniversitiesService;

  constructor(@Inject(UniversitiesService) universitiesService: UniversitiesService) {
    this.universitiesService = universitiesService;
  }

  @Get("meta/home")
  homeMeta() {
    return this.universitiesService.getHomeMeta();
  }

  @Get("meta/filters")
  filters(@Query() query: Record<string, unknown>) {
    return this.universitiesService.getFacets(normalizeUniversitiesQuery(query));
  }

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.universitiesService.list(normalizeUniversitiesQuery(query));
  }

  @Get(":slug/review-preview")
  reviewPreview(@Param("slug") slug: string, @Query("key") key?: string) {
    return this.universitiesService.getReviewPreview(slug, key);
  }

  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.universitiesService.getBySlug(slug);
  }
}
