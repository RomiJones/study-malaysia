import { Body, Controller, Get, Post, Req, UseGuards, Inject } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { AdminAuthGuard } from "../common/guards.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { adminOk } from "./admin.response.js";

class AdminLoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

@Controller("admin/auth")
export class AdminAuthController {
  private readonly adminAuthService: AdminAuthService;

  constructor(@Inject(AdminAuthService) adminAuthService: AdminAuthService) {
    this.adminAuthService = adminAuthService;
  }

  @Post("login")
  async login(@Body() payload: AdminLoginDto) {
    return adminOk(await this.adminAuthService.login(payload));
  }

  @UseGuards(AdminAuthGuard)
  @Get("me")
  async me(@Req() request: { adminUser: { id: number } }) {
    return adminOk(await this.adminAuthService.me(request.adminUser.id));
  }
}