import { Body, Controller, Inject, Post } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional } from "class-validator";
import { ToolsService, type CostEstimateInput } from "./tools.service.js";

function toNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

class CostEstimateDto implements CostEstimateInput {
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  programId?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  tuition?: number;

  @IsOptional()
  @IsIn(["MYR", "CNY", "USD", "UNKNOWN"])
  currency?: CostEstimateInput["currency"];

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  duration?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  durationYears?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  livingCost?: number;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  miscCost?: number;
}

@Controller("tools")
export class ToolsController {
  constructor(@Inject(ToolsService) private readonly toolsService: ToolsService) {}

  @Post("cost-estimate")
  costEstimate(@Body() body: CostEstimateDto) {
    return this.toolsService.costEstimate(body);
  }
}
