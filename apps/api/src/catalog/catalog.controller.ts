import { Controller, Get, Inject } from "@nestjs/common";
import { QualityEngineService } from "../admin/quality-engine.service.js";

@Controller("catalog")
export class CatalogController {
  constructor(@Inject(QualityEngineService) private readonly qualityEngine: QualityEngineService) {}

  @Get("stats")
  stats() {
    return this.qualityEngine.catalogStats();
  }
}
