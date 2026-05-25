import { Controller, Get, Inject, Query } from "@nestjs/common";
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

  @Get("coverage")
  coverage(@Query() query: CatalogLocalizationQuery) {
    return this.catalogLocalizationService.getCoverageReport(query || {});
  }
}
