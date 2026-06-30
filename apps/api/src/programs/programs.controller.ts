import { Controller, Get, Param, Query, Inject } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import type { DegreeLevel } from "@studymy/shared";
import { ProgramsService, type ProgramQuery } from "./programs.service.js";

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

function normalizeProgramsQuery(query: Record<string, unknown>): ProgramQuery {
  return {
    search: toStringValue(query.search),
    categories: toArrayQuery(query, "categories"),
    levels: toArrayQuery(query, "levels"),
    ownerships: toArrayQuery(query, "ownerships"),
    types: toArrayQuery(query, "types"),
    institutionTypes: toArrayQuery(query, "institutionTypes"),
    universityId: toNumber(query.universityId),
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

class ProgramsQueryDto {
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
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  universityId?: number;

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

class RecommendationQueryDto {
  @IsOptional()
  @IsIn(["bachelor", "master", "phd", "postgraduate-certificate", "postgraduate-diploma"])
  level?: DegreeLevel;

  @IsOptional()
  @IsString()
  targetCategory?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  budgetCny?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  gpa?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  ielts?: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  acceptNoLanguage?: boolean;
}

@Controller("programs")
export class ProgramsController {
  private readonly programsService: ProgramsService;

  constructor(@Inject(ProgramsService) programsService: ProgramsService) {
    this.programsService = programsService;
  }

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.programsService.list(normalizeProgramsQuery(query));
  }

  @Get("meta/filters")
  filters(@Query() query: Record<string, unknown>) {
    return this.programsService.getFacets(normalizeProgramsQuery(query));
  }

  @Get("detail/:id")
  detailById(@Param("id") id: string) {
    return this.programsService.getByIdentifier(id);
  }

  @Get("review-preview/:identifier")
  reviewPreview(@Param("identifier") identifier: string, @Query("key") key?: string) {
    return this.programsService.getReviewPreviewByIdentifier(identifier, key);
  }

  @Get("recommendations")
  recommend(@Query() query: RecommendationQueryDto) {
    return this.programsService.recommend(query);
  }

  @Get("cost-estimate/:id")
  costEstimate(@Param("id") id: string) {
    return this.programsService.costEstimate(Number(id));
  }

  @Get(":identifier")
  detail(@Param("identifier") identifier: string) {
    return this.programsService.getByIdentifier(identifier);
  }
}
