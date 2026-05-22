import { Controller, Get, Param, Query, Inject } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { UniversitiesService } from "./universities.service.js";

class UniversitiesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).split(",").filter(Boolean))
  categories?: string[];

  @IsOptional()
  @Transform(({ value }) => String(value).split(",").filter(Boolean))
  levels?: string[];

  @IsOptional()
  @Transform(({ value }) => String(value).split(",").filter(Boolean))
  ownerships?: string[];

  @IsOptional()
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  acceptNoLanguage?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  qsRankMax?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  tuitionMax?: number;
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

  @Get()
  list(@Query() query: UniversitiesQueryDto) {
    return this.universitiesService.list(query);
  }

  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.universitiesService.getBySlug(slug);
  }
}