import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors, Inject } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { AuthGuard } from "../common/guards.js";
import { UserEntity } from "../db/entities.js";
import { ApplicationsService, type UploadedApplicationFile } from "./applications.service.js";

class SubmitApplicationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  universityId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId!: number;

  @IsOptional()
  @IsString()
  intake?: string;

  @IsOptional()
  @IsString()
  studentPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class SendApplicationMessageDto {
  @IsString()
  content!: string;
}

class UploadMaterialLibraryDto {
  @IsOptional()
  @IsString()
  materialType?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

class LinkMaterialFromLibraryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  libraryMaterialId!: number;
}

@UseGuards(AuthGuard)
@Controller("applications")
export class ApplicationsController {
  private readonly applicationsService: ApplicationsService;

  constructor(@Inject(ApplicationsService) applicationsService: ApplicationsService) {
    this.applicationsService = applicationsService;
  }

  @Get()
  list(@Req() request: { user: UserEntity }) {
    return this.applicationsService.list(request.user.id);
  }

  @Post()
  submit(@Req() request: { user: UserEntity }, @Body() payload: SubmitApplicationDto) {
    return this.applicationsService.submit(request.user, payload);
  }

  @Get("material-library")
  materialLibrary(@Req() request: { user: UserEntity }) {
    return this.applicationsService.materialLibrary(request.user.id);
  }

  @Post("material-library/upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadMaterialLibrary(
    @Req() request: { user: UserEntity },
    @Body() payload: UploadMaterialLibraryDto,
    @UploadedFile() file: UploadedApplicationFile
  ) {
    return this.applicationsService.uploadMaterialLibrary(request.user.id, payload, file);
  }

  @Get("material-library/:materialId/download")
  async downloadMaterialLibrary(
    @Req() request: { user: UserEntity },
    @Param("materialId") materialId: string,
    @Query("versionId") versionId: string | undefined,
    @Res() response: any
  ) {
    const file = await this.applicationsService.materialLibraryFile(request.user.id, Number(materialId), versionId);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    file.stream.pipe(response);
  }

  @Post(":id/materials/:key/upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadMaterial(
    @Req() request: { user: UserEntity },
    @Param("id") id: string,
    @Param("key") key: string,
    @UploadedFile() file: UploadedApplicationFile
  ) {
    return this.applicationsService.uploadMaterial(request.user.id, Number(id), key, file);
  }

  @Post(":id/materials/:key/link-library")
  linkMaterialFromLibrary(
    @Req() request: { user: UserEntity },
    @Param("id") id: string,
    @Param("key") key: string,
    @Body() payload: LinkMaterialFromLibraryDto
  ) {
    return this.applicationsService.linkMaterialFromLibrary(request.user.id, Number(id), key, payload);
  }

  @Get(":id/materials/:key/download")
  async downloadMaterial(
    @Req() request: { user: UserEntity },
    @Param("id") id: string,
    @Param("key") key: string,
    @Query("versionId") versionId: string | undefined,
    @Res() response: any
  ) {
    const file = await this.applicationsService.materialFile(request.user.id, Number(id), key, versionId);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    file.stream.pipe(response);
  }

  @Post(":id/messages")
  sendMessage(@Req() request: { user: UserEntity }, @Param("id") id: string, @Body() payload: SendApplicationMessageDto) {
    return this.applicationsService.sendMessage(request.user.id, Number(id), payload);
  }

  @Get(":id")
  detail(@Req() request: { user: UserEntity }, @Param("id") id: string) {
    return this.applicationsService.detail(request.user.id, Number(id));
  }
}
