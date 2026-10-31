import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards, Inject } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { PlannerService } from "./planner.service.js";
import { AuthGuard } from "../common/guards.js";

class UpdateProfileDto {
  @IsOptional()
  @IsIn(["bachelor", "master", "phd"])
  level?: "bachelor" | "master" | "phd";

  @IsOptional()
  @IsIn(["business", "it", "engineering", "science", "arts", "medicine", "law"])
  targetCategory?: "business" | "it" | "engineering" | "science" | "arts" | "medicine" | "law";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetCny?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4)
  gpa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(9)
  ielts?: number;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsBoolean()
  acceptNoLanguage?: boolean;

  @IsOptional()
  @IsObject()
  contactInfo?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  academicBackground?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  languageProfile?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  studyPreferences?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  serviceNeeds?: Record<string, unknown>;
}

class UpdateMaterialDto {
  @IsIn(["draft", "wait", "progress", "done"])
  status!: "draft" | "wait" | "progress" | "done";
}

class SaveMaterialsDto {
  @IsObject()
  materialProgress!: Record<string, "draft" | "wait" | "progress" | "done">;
}

class PlannerTaskDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  universityId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId!: number;

  @IsOptional()
  @IsObject()
  tier?: Record<string, string>;

  @IsOptional()
  @IsIn(["draft", "materials", "ready", "review", "conditional-offer", "visa"])
  stage?: "draft" | "materials" | "ready" | "review" | "conditional-offer" | "visa";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsObject()
  deadlineNote?: Record<string, string>;

  @IsOptional()
  @IsObject()
  nextAction?: Record<string, string>;
}

class SaveTasksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannerTaskDto)
  tasks!: PlannerTaskDto[];
}

class UpdateTaskDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  universityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId?: number;

  @IsOptional()
  @IsObject()
  tier?: Record<string, string>;

  @IsOptional()
  @IsIn(["draft", "materials", "ready", "review", "conditional-offer", "visa"])
  stage?: "draft" | "materials" | "ready" | "review" | "conditional-offer" | "visa";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsObject()
  deadlineNote?: Record<string, string>;

  @IsOptional()
  @IsObject()
  nextAction?: Record<string, string>;
}

class AddTaskDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  universityId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId!: number;
}

class UpdateVisaDto {
  @IsOptional()
  @IsBoolean()
  offerAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  depositPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  visaDocsReady?: boolean;

  @IsOptional()
  @IsBoolean()
  preDeparture?: boolean;

  @IsOptional()
  @IsBoolean()
  arrivalReady?: boolean;
}

class MergePlannerLocalStateDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProfileDto)
  profile?: UpdateProfileDto;

  @IsOptional()
  @IsObject()
  materialProgress?: Record<string, "draft" | "wait" | "progress" | "done">;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateVisaDto)
  visaChecklist?: UpdateVisaDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannerTaskDto)
  tasks?: PlannerTaskDto[];
}

@UseGuards(AuthGuard)
@Controller("planner")
export class PlannerController {
  private readonly plannerService: PlannerService;

  constructor(@Inject(PlannerService) plannerService: PlannerService) {
    this.plannerService = plannerService;
  }

  @Get()
  dashboard(@Req() request: { user: { id: number } }) {
    return this.plannerService.getDashboard(request.user.id);
  }

  @Patch("profile")
  updateProfile(@Req() request: { user: { id: number } }, @Body() payload: UpdateProfileDto) {
    return this.plannerService.updateProfile(request.user.id, payload);
  }

  @Put("profile")
  saveProfile(@Req() request: { user: { id: number } }, @Body() payload: UpdateProfileDto) {
    return this.plannerService.updateProfile(request.user.id, payload);
  }

  @Put("materials")
  saveMaterials(@Req() request: { user: { id: number } }, @Body() payload: SaveMaterialsDto) {
    return this.plannerService.saveMaterials(request.user.id, payload.materialProgress);
  }

  @Patch("materials/:key")
  updateMaterial(
    @Req() request: { user: { id: number } },
    @Param("key") key: string,
    @Body() payload: UpdateMaterialDto
  ) {
    return this.plannerService.updateMaterialStatus(request.user.id, key, payload.status);
  }

  @Get("tasks")
  listTasks(@Req() request: { user: { id: number } }) {
    return this.plannerService.listTasks(request.user.id);
  }

  @Post("tasks")
  addTask(@Req() request: { user: { id: number } }, @Body() payload: AddTaskDto) {
    return this.plannerService.addTask(request.user.id, payload.universityId, payload.programId);
  }

  @Put("tasks")
  saveTasks(@Req() request: { user: { id: number } }, @Body() payload: SaveTasksDto) {
    return this.plannerService.saveTasks(request.user.id, payload.tasks);
  }

  @Patch("tasks/:id/advance")
  advanceTask(@Req() request: { user: { id: number } }, @Param("id") id: string) {
    return this.plannerService.advanceTask(request.user.id, Number(id));
  }

  @Patch("tasks/:id")
  updateTask(@Req() request: { user: { id: number } }, @Param("id") id: string, @Body() payload: UpdateTaskDto) {
    return this.plannerService.updateTask(request.user.id, Number(id), payload);
  }

  @Delete("tasks/:id")
  deleteTask(@Req() request: { user: { id: number } }, @Param("id") id: string) {
    return this.plannerService.deleteTask(request.user.id, Number(id));
  }

  @Put("visa")
  saveVisa(@Req() request: { user: { id: number } }, @Body() payload: UpdateVisaDto) {
    return this.plannerService.saveVisa(request.user.id, payload);
  }

  @Patch("visa")
  updateVisa(@Req() request: { user: { id: number } }, @Body() payload: UpdateVisaDto) {
    return this.plannerService.updateVisa(request.user.id, payload);
  }

  @Post("merge-local-state")
  mergeLocalState(@Req() request: { user: { id: number } }, @Body() payload: MergePlannerLocalStateDto) {
    return this.plannerService.mergeLocalState(request.user.id, payload);
  }
}
