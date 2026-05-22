import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, Inject } from "@nestjs/common";
import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from "class-validator";
import { RequireAdminPermissions } from "../common/admin-permissions.js";
import { AdminAuthGuard, AdminPermissionGuard, type AdminRequestUser } from "../common/guards.js";
import { AdminApplicationsService } from "./admin-applications.service.js";
import { AdminCmsService } from "./admin-cms.service.js";
import { AdminSettingsService } from "./admin-settings.service.js";
import { adminOk } from "./admin.response.js";

class SaveUniversityDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() slug!: string;
  @IsString() code!: string;
  @IsObject() name!: Record<string, string>;
  @IsString() shortName!: string;
  @IsString() logoUrl!: string;
  @IsString() imageUrl!: string;
  @IsString() color!: string;
  @IsNumber() qsRank!: number;
  @IsOptional() @IsNumber() qsAsiaRank?: number | null;
  @IsObject() location!: Record<string, string>;
  @IsObject() region!: Record<string, string>;
  @IsString() ownership!: string;
  @IsString() institutionType!: string;
  @IsNumber() foundedYear!: number;
  @IsNumber() students!: number;
  @IsNumber() intlStudents!: number;
  @IsBoolean() csrCertified!: boolean;
  @IsObject() description!: Record<string, string>;
  @IsString() website!: string;
  @IsString() admissionEmail!: string;
  @IsOptional() @IsString() nameEnOfficial?: string;
  @IsOptional() @IsString() officialWebsite?: string;
  @IsOptional() @IsString() studyPortalUrl?: string;
  @IsOptional() @IsString() internationalPageUrl?: string;
  @IsOptional() @IsString() applicationPortalUrl?: string;
  @IsOptional() @IsString() officialAddress?: string;
  @IsOptional() @IsArray() applicationPeriods?: string[];
  @IsOptional() @IsArray() applicationFees?: string[];
  @IsOptional() @IsObject() applicationDocuments?: Record<string, string[]>;
  @IsOptional() @IsObject() chinaStudentRequirements?: Record<string, string[]>;
  @IsOptional() @IsObject() officialProfile?: Record<string, unknown> | null;
  @IsOptional() @IsArray() officialSources?: Record<string, unknown>[];
  @IsOptional() @IsString() officialVerifiedAt?: string | null;
  @IsOptional() @IsString() officialSourceStatus?: string;
  @IsOptional() @IsString() officialAuditSummary?: string | null;
  @IsOptional() @IsString() publicDisplayStatus?: string;
  @IsOptional() @IsString() livingCostOfficialNote?: string | null;
  @IsNumber() tuitionMinCny!: number;
  @IsNumber() tuitionMaxCny!: number;
  @IsNumber() livingCostCny!: number;
  @IsNumber() minIelts!: number;
  @IsBoolean() acceptNoLanguage!: boolean;
  @IsObject() facilities!: Record<string, string[]>;
  @IsObject() highlights!: Record<string, string[]>;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class SaveProgramDto {
  @IsOptional() @IsNumber() id?: number;
  @IsNumber() universityId!: number;
  @IsString() slug!: string;
  @IsString() code!: string;
  @IsObject() name!: Record<string, string>;
  @IsOptional() @IsString() nameEnOfficial?: string;
  @IsString() level!: string;
  @IsString() category!: string;
  @IsObject() faculty!: Record<string, string>;
  @IsOptional() @IsString() facultyZh?: string;
  @IsOptional() @IsString() studyMode?: string;
  @IsOptional() @IsString() campus?: string;
  @IsNumber() durationYears!: number;
  @IsOptional() @IsString() durationOfficial?: string;
  @IsNumber() annualTuitionCny!: number;
  @IsOptional() @IsNumber() tuitionAmount?: number | null;
  @IsOptional() @IsString() tuitionCurrency?: string;
  @IsOptional() @IsString() tuitionDisplay?: string;
  @IsOptional() @IsNumber() officialTuitionMYR?: number | null;
  @IsOptional() @IsString() officialTuitionNote?: string | null;
  @IsOptional() @IsString() officialFeeSourceUrl?: string;
  @IsOptional() @IsString() secondaryOfficialFeeSourceUrl?: string;
  @IsOptional() @IsString() officialFeeAuditStatus?: string;
  @IsOptional() @IsString() officialFeeAuditedAt?: string | null;
  @IsArray() intakeMonths!: string[];
  @IsOptional() @IsString() officialIntake?: string;
  @IsOptional() @IsString() officialIntakeNote?: string | null;
  @IsObject() languageRequirement!: Record<string, unknown>;
  @IsOptional() @IsString() officialLanguageRequirement?: string | null;
  @IsObject() requirement!: Record<string, unknown>;
  @IsOptional() @IsString() officialAcademicRequirement?: string | null;
  @IsOptional() @IsString() chinaStudentRequirement?: string | null;
  @IsOptional() @IsString() specialRequirementsNote?: string | null;
  @IsObject() applicationDocs!: Record<string, string[]>;
  @IsObject() curriculum!: Record<string, string[]>;
  @IsObject() careers!: Record<string, string[]>;
  @IsObject() specializations!: Record<string, string[]>;
  @IsObject() description!: Record<string, string>;
  @IsOptional() @IsString() officialAccreditationNote?: string | null;
  @IsOptional() @IsString() officialSourceUrl?: string;
  @IsOptional() @IsString() officialEntryRequirementSourceUrl?: string;
  @IsOptional() @IsString() officialAccreditationSourceUrl?: string;
  @IsOptional() @IsArray() sourceUrls?: Record<string, unknown>[];
  @IsOptional() @IsString() officialVerifiedAt?: string | null;
  @IsOptional() @IsString() officialSourceStatus?: string;
  @IsOptional() @IsString() publicDisplayStatus?: string;
  @IsOptional() @IsString() publicDisplayNote?: string | null;
  @IsOptional() @IsString() reviewReason?: string | null;
  @IsOptional() @IsString() auditNote?: string | null;
  @IsOptional() @IsString() listTuitionText?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class SaveContentDto {
  @IsObject() title!: Record<string, string>;
  @IsObject() body!: Record<string, string>;
}

class SaveApplicationDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() studentName!: string;
  @IsString() studentEmail!: string;
  @IsOptional() @IsString() studentPhone?: string;
  @IsNumber() universityId!: number;
  @IsNumber() programId!: number;
  @IsString() applicationStatus!: string;
  @IsString() currentStage!: string;
  @IsString() materialStatus!: string;
  @IsString() visaStatus!: string;
  @IsString() priority!: "low" | "medium" | "high";
  @IsString() intake!: string;
  @IsOptional() @IsNumber() ownerAdminId?: number | null;
  @IsOptional() @IsNumber() assignedAdminId?: number | null;
  @IsOptional() @IsString() submittedAt?: string | null;
  @IsOptional() @IsString() expectedDecisionDate?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsObject() metadata?: Record<string, unknown> | null;
}

class SaveFollowUpDto {
  @IsString() followUpType!: string;
  @IsString() content!: string;
  @IsOptional() @IsString() nextStep?: string;
  @IsOptional() @IsString() nextFollowUpAt?: string;
  @IsOptional() @IsString() statusTo?: string;
  @IsOptional() @IsNumber() assignAdminId?: number | null;
}

class SaveConfigDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() category!: string;
  @IsString() configKey!: string;
  @IsString() label!: string;
  @IsString() value!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isPublic?: boolean;
}

class SaveDictionaryDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() dictType!: string;
  @IsString() code!: string;
  @IsString() label!: string;
  @IsOptional() @IsString() status?: "enabled" | "disabled";
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsObject() extra?: Record<string, unknown>;
}

@UseGuards(AdminAuthGuard, AdminPermissionGuard)
@Controller("admin")
export class AdminController {
  private readonly cmsService: AdminCmsService;
  private readonly applicationsService: AdminApplicationsService;
  private readonly settingsService: AdminSettingsService;

  constructor(
    @Inject(AdminCmsService) cmsService: AdminCmsService,
    @Inject(AdminApplicationsService) applicationsService: AdminApplicationsService,
    @Inject(AdminSettingsService) settingsService: AdminSettingsService
  ) {
    this.cmsService = cmsService;
    this.applicationsService = applicationsService;
    this.settingsService = settingsService;
  }

  @RequireAdminPermissions("dashboard:view")
  @Get("dashboard")
  async dashboard() {
    return adminOk(await this.cmsService.dashboard());
  }

  @RequireAdminPermissions("school:view")
  @Get("universities")
  async universities(@Query() query: Record<string, string>) {
    return adminOk(await this.cmsService.listUniversities(query));
  }

  @RequireAdminPermissions("school:update")
  @Post("universities")
  async saveUniversity(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveUniversityDto) {
    return adminOk(await this.cmsService.saveUniversity(request.adminUser, payload as any));
  }

  @RequireAdminPermissions("school:delete")
  @Delete("universities/:id")
  async deleteUniversity(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string) {
    return adminOk(await this.cmsService.deleteUniversity(request.adminUser, Number(id)));
  }

  @RequireAdminPermissions("program:view")
  @Get("programs")
  async programs(@Query() query: Record<string, string>) {
    return adminOk(await this.cmsService.listPrograms(query));
  }

  @RequireAdminPermissions("program:update")
  @Post("programs")
  async saveProgram(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveProgramDto) {
    return adminOk(await this.cmsService.saveProgram(request.adminUser, payload as any));
  }

  @RequireAdminPermissions("program:delete")
  @Delete("programs/:id")
  async deleteProgram(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string) {
    return adminOk(await this.cmsService.deleteProgram(request.adminUser, Number(id)));
  }

  @RequireAdminPermissions("content:view")
  @Get("content")
  async content(@Query() query: Record<string, string>) {
    return adminOk(await this.cmsService.listContent(query));
  }

  @RequireAdminPermissions("content:update")
  @Post("content/:key")
  async saveContent(@Req() request: { adminUser: AdminRequestUser }, @Param("key") key: string, @Body() payload: SaveContentDto) {
    return adminOk(await this.cmsService.saveContent(request.adminUser, key, payload as any));
  }

  @RequireAdminPermissions("application:view")
  @Get("applications")
  async applications(@Req() request: { adminUser: AdminRequestUser }, @Query() query: Record<string, string>) {
    return adminOk(await this.applicationsService.list(request.adminUser, query));
  }

  @RequireAdminPermissions("application:view")
  @Get("applications/:id")
  async applicationDetail(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string) {
    return adminOk(await this.applicationsService.detail(request.adminUser, Number(id)));
  }

  @RequireAdminPermissions("application:update")
  @Post("applications")
  async saveApplication(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveApplicationDto) {
    return adminOk(await this.applicationsService.save(request.adminUser, payload as any));
  }

  @RequireAdminPermissions("application:followup")
  @Post("applications/:id/follow-ups")
  async addFollowUp(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string, @Body() payload: SaveFollowUpDto) {
    return adminOk(await this.applicationsService.addFollowUp(request.adminUser, Number(id), payload));
  }

  @RequireAdminPermissions("application:export")
  @Get("applications-export")
  async exportApplications(@Req() request: { adminUser: AdminRequestUser }, @Query() query: Record<string, string>) {
    return adminOk(await this.applicationsService.export(request.adminUser, query));
  }

  @RequireAdminPermissions("settings:view")
  @Get("settings/configs")
  async configs(@Query("category") category?: string) {
    return adminOk(await this.settingsService.listConfigs(category));
  }

  @RequireAdminPermissions("settings:update")
  @Post("settings/configs")
  async saveConfig(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveConfigDto) {
    return adminOk(await this.settingsService.saveConfig(request.adminUser, payload));
  }

  @RequireAdminPermissions("settings:view")
  @Get("settings/dictionaries")
  async dictionaries(@Query("dictType") dictType?: string) {
    return adminOk(await this.settingsService.listDictionaries(dictType));
  }

  @RequireAdminPermissions("settings:update")
  @Post("settings/dictionaries")
  async saveDictionary(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveDictionaryDto) {
    return adminOk(await this.settingsService.saveDictionary(request.adminUser, payload));
  }

  @RequireAdminPermissions("log:view")
  @Get("settings/logs")
  async logs(@Query() query: Record<string, string>) {
    return adminOk(await this.settingsService.listLogs(query));
  }
}
