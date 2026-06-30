import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";
import { RequireAdminPermissions } from "../common/admin-permissions.js";
import { AdminAuthGuard, AdminPermissionGuard, type AdminRequestUser } from "../common/guards.js";
import { adminOk } from "./admin.response.js";
import { FeeReviewService } from "./fee-review.service.js";

class BatchFeeReviewDto {
  @IsArray()
  programIds!: number[];

  @IsString()
  feeAuditStatus!: string;

  @IsOptional()
  @IsString()
  feeSourceUrl?: string;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

class FeeReviewDetailDto {
  @IsOptional()
  @IsNumber()
  officialTuitionMYR?: number | null;

  @IsOptional()
  @IsString()
  tuitionDisplay?: string | null;

  @IsOptional()
  @IsString()
  feeAuditStatus?: string;

  @IsOptional()
  @IsString()
  feeSourceUrl?: string | null;

  @IsOptional()
  @IsString()
  feeSourceNote?: string | null;

  @IsOptional()
  @IsString()
  reviewNote?: string | null;
}

@UseGuards(AdminAuthGuard, AdminPermissionGuard)
@Controller("admin/fee-review")
export class FeeReviewController {
  constructor(private readonly feeReviewService: FeeReviewService) {}

  @RequireAdminPermissions("program:view")
  @Get("programs")
  async programs(@Query() query: Record<string, string>) {
    return adminOk(await this.feeReviewService.listPrograms(query));
  }

  @RequireAdminPermissions("program:view")
  @Get("programs/:id/fee-detail")
  async feeDetail(@Param("id") id: string) {
    return adminOk(await this.feeReviewService.getFeeDetail(Number(id)));
  }

  @RequireAdminPermissions("program:update")
  @Patch("programs/:id/fee-detail")
  async updateFeeDetail(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string, @Body() payload: FeeReviewDetailDto) {
    return adminOk(await this.feeReviewService.updateFeeDetail(request.adminUser, Number(id), payload));
  }

  @RequireAdminPermissions("program:update")
  @Patch("programs/batch")
  async batchReview(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: BatchFeeReviewDto) {
    return adminOk(await this.feeReviewService.batchReview(request.adminUser, payload));
  }
}
