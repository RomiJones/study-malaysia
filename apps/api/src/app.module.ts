import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller.js";
import { ALL_ENTITIES } from "./db/entities.js";
import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { UniversitiesController } from "./universities/universities.controller.js";
import { UniversitiesService } from "./universities/universities.service.js";
import { ProgramsController } from "./programs/programs.controller.js";
import { ProgramsService } from "./programs/programs.service.js";
import { RecommendationsController } from "./recommendations/recommendations.controller.js";
import { RecommendationsService } from "./recommendations/recommendations.service.js";
import { ToolsController } from "./tools/tools.controller.js";
import { ToolsService } from "./tools/tools.service.js";
import { I18nController } from "./i18n/i18n.controller.js";
import { I18nService } from "./i18n/i18n.service.js";
import { CatalogLocalizationController } from "./i18n/catalog-localization.controller.js";
import { CatalogLocalizationService } from "./i18n/catalog-localization.service.js";
import { NotionController } from "./notion/notion.controller.js";
import { NotionService } from "./notion/notion.service.js";
import { SearchController } from "./search/search.controller.js";
import { SearchService } from "./search/search.service.js";
import { PlannerController } from "./planner/planner.controller.js";
import { PlannerService } from "./planner/planner.service.js";
import { FavoritesController } from "./favorites/favorites.controller.js";
import { FavoritesService } from "./favorites/favorites.service.js";
import { CompareController } from "./compare/compare.controller.js";
import { CompareService } from "./compare/compare.service.js";
import { ApplicationsController } from "./applications/applications.controller.js";
import { ApplicationsService } from "./applications/applications.service.js";
import { CatalogController } from "./catalog/catalog.controller.js";
import { AdminController } from "./admin/admin.controller.js";
import { AdminAuthController } from "./admin/admin-auth.controller.js";
import { AdminAuthService } from "./admin/admin-auth.service.js";
import { AdminAccessController } from "./admin/admin-access.controller.js";
import { AdminAccessService } from "./admin/admin-access.service.js";
import { AdminCmsService } from "./admin/admin-cms.service.js";
import { AdminApplicationsService } from "./admin/admin-applications.service.js";
import { AdminRecommendationsService } from "./admin/admin-recommendations.service.js";
import { AdminSettingsService } from "./admin/admin-settings.service.js";
import { AdminLogService } from "./admin/admin-log.service.js";
import { QualityEngineService } from "./admin/quality-engine.service.js";
import { FeeReviewController } from "./admin/fee-review.controller.js";
import { FeeReviewService } from "./admin/fee-review.service.js";
import { AuthGuard, AdminGuard, AdminAuthGuard, AdminPermissionGuard } from "./common/guards.js";
import { CacheService } from "./common/cache.service.js";
import { ENV_FILE_PATHS, loadEnvFiles } from "./config/env.js";

loadEnvFiles();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ENV_FILE_PATHS }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "studymy-demo-secret",
      signOptions: { expiresIn: "7d" }
    }),
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      username: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "123456",
      database: process.env.MYSQL_DATABASE || "study_malaysia",
      entities: [...ALL_ENTITIES],
      synchronize: false,
      charset: "utf8mb4_unicode_ci"
    }),
    TypeOrmModule.forFeature([...ALL_ENTITIES])
  ],
  controllers: [
    AppController,
    AuthController,
    UniversitiesController,
    ProgramsController,
    RecommendationsController,
    ToolsController,
    I18nController,
    CatalogLocalizationController,
    NotionController,
    SearchController,
    PlannerController,
    FavoritesController,
    CompareController,
    ApplicationsController,
    CatalogController,
    AdminController,
    FeeReviewController,
    AdminAuthController,
    AdminAccessController
  ],
  providers: [
    Reflector,
    CacheService,
    AuthService,
    UniversitiesService,
    ProgramsService,
    RecommendationsService,
    ToolsService,
    I18nService,
    CatalogLocalizationService,
    NotionService,
    SearchService,
    PlannerService,
    FavoritesService,
    CompareService,
    ApplicationsService,
    AdminAuthService,
    AdminAccessService,
    AdminCmsService,
    AdminApplicationsService,
    AdminRecommendationsService,
    AdminSettingsService,
    AdminLogService,
    QualityEngineService,
    FeeReviewService,
    AuthGuard,
    AdminGuard,
    AdminAuthGuard,
    AdminPermissionGuard
  ]
})
export class AppModule {}
