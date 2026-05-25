import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from "class-validator";
import { NotionService, type NotionTaskListQuery } from "./notion.service.js";

const TASK_ID_PATTERN = /^TASK-\d{3,}$/;

function toOptionalInteger(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

class NotionTaskParamsDto {
  @Matches(TASK_ID_PATTERN)
  taskId!: string;
}

class NotionTaskListQueryDto implements NotionTaskListQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  taskType?: string;

  @IsOptional()
  @IsString()
  parallelGroup?: string;

  @IsOptional()
  @Matches(TASK_ID_PATTERN)
  parentTaskId?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

class NotionTaskContractValidationDto {
  @Matches(TASK_ID_PATTERN)
  taskId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  status!: string;

  @IsString()
  @MinLength(1)
  taskType!: string;
}

@Controller("notion")
export class NotionController {
  constructor(@Inject(NotionService) private readonly notionService: NotionService) {}

  @Get("health")
  health() {
    return this.notionService.health();
  }

  @Get("tasks")
  listTasks(@Query() query: NotionTaskListQueryDto) {
    return this.notionService.listTasks(query);
  }

  @Get("tasks/:taskId")
  getTaskContract(@Param() params: NotionTaskParamsDto) {
    return this.notionService.getTaskContract(params.taskId);
  }

  @Get("tasks/:taskId/dependency-plan")
  getDependencyPlan(@Param() params: NotionTaskParamsDto) {
    return this.notionService.getDependencyPlan(params.taskId);
  }

  @Post("tasks/validate")
  validateTaskContract(@Body() body: NotionTaskContractValidationDto) {
    return {
      valid: true,
      taskId: body.taskId,
      requiredFields: ["taskId", "title", "status", "taskType"]
    };
  }
}
