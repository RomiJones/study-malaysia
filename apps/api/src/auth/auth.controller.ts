import { Body, Controller, Get, Post, Req, UseGuards, Inject } from "@nestjs/common";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { AuthService } from "./auth.service.js";
import { AuthGuard } from "../common/guards.js";

class AuthDto {
  @IsIn(["phone", "email", "wechat", "qq"])
  method!: "phone" | "email" | "wechat" | "qq";

  @IsString()
  account!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

@Controller("auth")
export class AuthController {
  private readonly authService: AuthService;

  constructor(@Inject(AuthService) authService: AuthService) {
    this.authService = authService;
  }

  @Post("register")
  register(@Body() payload: AuthDto) {
    return this.authService.register(payload);
  }

  @Post("login")
  login(@Body() payload: AuthDto) {
    return this.authService.login(payload);
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@Req() request: { user: { id: number } }) {
    return this.authService.me(request.user.id);
  }
}