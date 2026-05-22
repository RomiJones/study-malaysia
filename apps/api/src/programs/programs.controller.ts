import { Controller, Get, Param, Query, Inject } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional } from "class-validator";
import { ProgramsService } from "./programs.service.js";

class RecommendationQueryDto {
  @IsOptional()
  @IsIn(["bachelor", "master", "phd"])
  level?: "bachelor" | "master" | "phd";

  @IsOptional()
  @IsIn(["business", "it", "engineering", "science", "arts", "medicine", "law"])
  targetCategory?: "business" | "it" | "engineering" | "science" | "arts" | "medicine" | "law";

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
  @Transform(({ value }) => value === "true")
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
  list() {
    return this.programsService.list();
  }

  @Get("recommendations")
  recommend(@Query() query: RecommendationQueryDto) {
    return this.programsService.recommend(query);
  }

  @Get("cost-estimate/:id")
  costEstimate(@Param("id") id: string) {
    return this.programsService.costEstimate(Number(id));
  }

  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.programsService.getBySlug(slug);
  }
}