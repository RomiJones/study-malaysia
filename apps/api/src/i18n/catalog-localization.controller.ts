import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../common/guards.js";
import { CatalogLocalizationService, type CatalogLocalizationQuery } from "./catalog-localization.service.js";

@Controller("i18n/catalog-localization")
export class CatalogLocalizationController {
  constructor(
    @Inject(CatalogLocalizationService)
    private readonly catalogLocalizationService: CatalogLocalizationService
  ) {}

  @Get("contract")
  contract() {
    return this.catalogLocalizationService.getContract();
  }

  @UseGuards(AdminAuthGuard)
  @Get("coverage")
  coverage(@Query() query: CatalogLocalizationQuery) {
    return this.catalogLocalizationService.getCoverageReport(query || {});
  }
}
