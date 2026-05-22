import { Controller, Get, Inject, Query } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { SearchService } from "./search.service.js";

function toNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

class SearchSuggestionQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber()
  limit?: number;
}

@Controller("search")
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get("suggestions")
  suggestions(@Query() query: SearchSuggestionQueryDto) {
    return this.searchService.suggest(query);
  }
}
