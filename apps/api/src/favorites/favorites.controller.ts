import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards, Inject } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, Min } from "class-validator";
import { FavoritesService } from "./favorites.service.js";
import { AuthGuard } from "../common/guards.js";

class FavoriteTargetDto {
  @IsIn(["university", "program"])
  favoriteType!: "university" | "program";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetId!: number;
}

class MergeFavoritesDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  universityIds?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  programIds?: number[];
}

@UseGuards(AuthGuard)
@Controller("favorites")
export class FavoritesController {
  private readonly favoritesService: FavoritesService;

  constructor(@Inject(FavoritesService) favoritesService: FavoritesService) {
    this.favoritesService = favoritesService;
  }

  @Get()
  list(@Req() request: { user: { id: number } }) {
    return this.favoritesService.list(request.user.id);
  }

  @Post()
  add(@Req() request: { user: { id: number } }, @Body() payload: FavoriteTargetDto) {
    return this.favoritesService.add(request.user.id, payload.favoriteType, payload.targetId);
  }

  @Post("toggle")
  toggle(@Req() request: { user: { id: number } }, @Body() payload: FavoriteTargetDto) {
    return this.favoritesService.toggle(request.user.id, payload.favoriteType, payload.targetId);
  }

  @Post("universities/:universityId")
  addUniversity(@Req() request: { user: { id: number } }, @Param("universityId") universityId: string) {
    return this.favoritesService.add(request.user.id, "university", Number(universityId));
  }

  @Delete("universities/:universityId")
  removeUniversity(@Req() request: { user: { id: number } }, @Param("universityId") universityId: string) {
    return this.favoritesService.remove(request.user.id, "university", Number(universityId));
  }

  @Post("programs/:programId")
  addProgram(@Req() request: { user: { id: number } }, @Param("programId") programId: string) {
    return this.favoritesService.add(request.user.id, "program", Number(programId));
  }

  @Delete("programs/:programId")
  removeProgram(@Req() request: { user: { id: number } }, @Param("programId") programId: string) {
    return this.favoritesService.remove(request.user.id, "program", Number(programId));
  }

  @Delete(":type/:targetId")
  remove(
    @Req() request: { user: { id: number } },
    @Param("type") type: "university" | "program",
    @Param("targetId") targetId: string
  ) {
    return this.favoritesService.remove(request.user.id, type, Number(targetId));
  }

  @Post("merge")
  merge(@Req() request: { user: { id: number } }, @Body() payload: MergeFavoritesDto) {
    return this.favoritesService.merge(request.user.id, payload);
  }
}
