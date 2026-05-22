import { Controller, Get, Param, Query, Inject } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { UniversitiesService } from "./universities.service.js";

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
  filters(@Query() query: UniversitiesQueryDto) {
    return this.universitiesService.getFacets(query);
  }

  @Get()
  list(@Query() query: UniversitiesQueryDto) {
    return this.universitiesService.list(query);
  }

  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.universitiesService.getBySlug(slug);
  }
}
