import { Controller, Get, Param, Query, Inject } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { ProgramsService } from "./programs.service.js";

function toArray(value: unknown): string[] | undefined {
  if (value == null || value === "") return undefined;
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
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
  @IsIn(["bachelor", "master", "phd"])
  level?: "bachelor" | "master" | "phd";

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
  list(@Query() query: ProgramsQueryDto) {
    return this.programsService.list(query);
  }

  @Get("meta/filters")
  filters(@Query() query: ProgramsQueryDto) {
    return this.programsService.getFacets(query);
  }

  @Get("detail/:id")
  detailById(@Param("id") id: string) {
    return this.programsService.getByIdentifier(id);
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
