import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards, Inject } from "@nestjs/common";
import { IsIn, IsInt } from "class-validator";
import { FavoritesService } from "./favorites.service.js";
import { AuthGuard } from "../common/guards.js";

class ToggleFavoriteDto {
  @IsIn(["university", "program"])
  favoriteType!: "university" | "program";

  @IsInt()
  targetId!: number;
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

  @Post("toggle")
  toggle(@Req() request: { user: { id: number } }, @Body() payload: ToggleFavoriteDto) {
    return this.favoritesService.toggle(request.user.id, payload.favoriteType, payload.targetId);
  }

  @Delete(":type/:targetId")
  remove(
    @Req() request: { user: { id: number } },
    @Param("type") type: "university" | "program",
    @Param("targetId") targetId: string
  ) {
    return this.favoritesService.remove(request.user.id, type, Number(targetId));
  }
}