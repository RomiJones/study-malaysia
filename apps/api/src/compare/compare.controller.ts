import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards, Inject } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, Min } from "class-validator";
import { CompareService } from "./compare.service.js";
import { AuthGuard } from "../common/guards.js";

class CompareTargetDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  universityId!: number;
}

class MergeCompareDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  universityIds?: number[];
}

@UseGuards(AuthGuard)
@Controller("compare")
export class CompareController {
  private readonly compareService: CompareService;

  constructor(@Inject(CompareService) compareService: CompareService) {
    this.compareService = compareService;
  }

  @Get()
  list(@Req() request: { user: { id: number } }) {
    return this.compareService.list(request.user.id);
  }

  @Post()
  add(@Req() request: { user: { id: number } }, @Body() payload: CompareTargetDto) {
    return this.compareService.add(request.user.id, payload.universityId);
  }

  @Post("universities/:universityId")
  addUniversity(@Req() request: { user: { id: number } }, @Param("universityId") universityId: string) {
    return this.compareService.add(request.user.id, Number(universityId));
  }

  @Delete()
  clear(@Req() request: { user: { id: number } }) {
    return this.compareService.clear(request.user.id);
  }

  @Delete("universities/:universityId")
  removeUniversity(@Req() request: { user: { id: number } }, @Param("universityId") universityId: string) {
    return this.compareService.remove(request.user.id, Number(universityId));
  }

  @Post("merge")
  merge(@Req() request: { user: { id: number } }, @Body() payload: MergeCompareDto) {
    return this.compareService.merge(request.user.id, payload.universityIds || []);
  }
}
