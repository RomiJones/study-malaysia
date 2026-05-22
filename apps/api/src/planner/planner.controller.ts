import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Inject } from "@nestjs/common";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
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
  @IsNumber()
  @Min(0)
  budgetCny?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  gpa?: number;

  @IsOptional()
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
}

class UpdateMaterialDto {
  @IsIn(["draft", "wait", "progress", "done"])
  status!: "draft" | "wait" | "progress" | "done";
}

class AddTaskDto {
  @IsInt()
  universityId!: number;

  @IsInt()
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

  @Patch("materials/:key")
  updateMaterial(
    @Req() request: { user: { id: number } },
    @Param("key") key: string,
    @Body() payload: UpdateMaterialDto
  ) {
    return this.plannerService.updateMaterialStatus(request.user.id, key, payload.status);
  }

  @Post("tasks")
  addTask(@Req() request: { user: { id: number } }, @Body() payload: AddTaskDto) {
    return this.plannerService.addTask(request.user.id, payload.universityId, payload.programId);
  }

  @Patch("tasks/:id/advance")
  advanceTask(@Req() request: { user: { id: number } }, @Param("id") id: string) {
    return this.plannerService.advanceTask(request.user.id, Number(id));
  }

  @Patch("visa")
  updateVisa(@Req() request: { user: { id: number } }, @Body() payload: UpdateVisaDto) {
    return this.plannerService.updateVisa(request.user.id, payload);
  }
}