import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";
import type { SupportedLocale } from "@studymy/shared";
import { AuthGuard } from "../common/guards.js";
import { RecommendationsService } from "./recommendations.service.js";

class RecommendationRequestDto {
  @IsOptional()
  @IsIn(["personalized-profile-match"])
  mode?: "personalized-profile-match";

  @IsOptional()
  @IsIn(["zh-CN", "zh-TW", "en", "ms"])
  locale?: SupportedLocale;

  @IsOptional()
  @IsString()
  profileVersion?: string;

  @IsOptional()
  @IsISO8601()
  requestedAt?: string;
}

@Controller("recommendations")
export class RecommendationsController {
  private readonly recommendationsService: RecommendationsService;

  constructor(@Inject(RecommendationsService) recommendationsService: RecommendationsService) {
    this.recommendationsService = recommendationsService;
  }

  @Get("contract")
  contract() {
    return this.recommendationsService.getContract();
  }

  @UseGuards(AuthGuard)
  @Get("me")
  currentUserRecommendations(@Req() request: { user: { id: number } }, @Query() query: RecommendationRequestDto) {
    return this.recommendationsService.getPersonalizedRecommendations(request.user.id, {
      mode: "personalized-profile-match",
      ...query
    });
  }

  @UseGuards(AuthGuard)
  @Post("refresh")
  refresh(@Req() request: { user: { id: number } }, @Body() payload: RecommendationRequestDto) {
    return this.recommendationsService.refreshPersonalizedRecommendations(request.user.id, {
      mode: "personalized-profile-match",
      ...payload
    });
  }
}
