import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, Inject } from "@nestjs/common";
import { IsArray, IsBoolean, IsEmail, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { RequireAdminPermissions } from "../common/admin-permissions.js";
import { AdminAuthGuard, AdminPermissionGuard, type AdminRequestUser } from "../common/guards.js";
import { AdminAccessService } from "./admin-access.service.js";
import { adminOk } from "./admin.response.js";

class SavePermissionDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() code!: string;
  @IsString() name!: string;
  @IsString() groupName!: string;
  @IsOptional() @IsString() description?: string;
}

class SaveRoleDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() dataScope!: "all" | "assigned" | "created";
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() permissionCodes!: string[];
  @IsArray() menuIds!: number[];
}

class SaveAdminUserDto {
  @IsOptional() @IsNumber() id?: number;
  @IsString() username!: string;
  @IsEmail() email!: string;
  @IsString() displayName!: string;
  @IsOptional() @MinLength(6) password?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() dataScope?: "all" | "assigned" | "created";
  @IsOptional() @IsArray() managedUniversityIds?: number[];
  @IsArray() roleIds!: number[];
}

class SaveMenuDto {
  @IsOptional() @IsNumber() id?: number;
  @IsOptional() @IsNumber() parentId?: number | null;
  @IsString() title!: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() path?: string;
  @IsOptional() @IsString() routeName?: string;
  @IsOptional() @IsString() permissionCode?: string;
  @IsOptional() @IsString() menuType?: "directory" | "menu" | "action";
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
}

@UseGuards(AdminAuthGuard, AdminPermissionGuard)
@Controller("admin/access")
export class AdminAccessController {
  private readonly accessService: AdminAccessService;

  constructor(@Inject(AdminAccessService) accessService: AdminAccessService) {
    this.accessService = accessService;
  }

  @Get("menus/current")
  async currentMenus(@Req() request: { adminUser: AdminRequestUser }) {
    return adminOk(await this.accessService.listCurrentMenus(request.adminUser.id));
  }

  @RequireAdminPermissions("permission:view")
  @Get("permissions")
  async permissions(@Query() query: Record<string, string>) {
    return adminOk(await this.accessService.listPermissions(query));
  }

  @RequireAdminPermissions("permission:update")
  @Post("permissions")
  async savePermission(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SavePermissionDto) {
    return adminOk(await this.accessService.savePermission(request.adminUser, payload));
  }

  @RequireAdminPermissions("permission:delete")
  @Delete("permissions/:id")
  async deletePermission(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string) {
    return adminOk(await this.accessService.deletePermission(request.adminUser, Number(id)));
  }

  @RequireAdminPermissions("role:view")
  @Get("roles")
  async roles(@Query() query: Record<string, string>) {
    return adminOk(await this.accessService.listRoles(query));
  }

  @RequireAdminPermissions("role:update")
  @Post("roles")
  async saveRole(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveRoleDto) {
    return adminOk(await this.accessService.saveRole(request.adminUser, payload));
  }

  @RequireAdminPermissions("role:delete")
  @Delete("roles/:id")
  async deleteRole(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string) {
    return adminOk(await this.accessService.deleteRole(request.adminUser, Number(id)));
  }

  @RequireAdminPermissions("admin-user:view")
  @Get("admins")
  async admins(@Query() query: Record<string, string>) {
    return adminOk(await this.accessService.listAdminUsers(query));
  }

  @RequireAdminPermissions("admin-user:update")
  @Post("admins")
  async saveAdmin(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveAdminUserDto) {
    return adminOk(await this.accessService.saveAdminUser(request.adminUser, payload));
  }

  @RequireAdminPermissions("admin-user:delete")
  @Delete("admins/:id")
  async deleteAdmin(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string) {
    return adminOk(await this.accessService.deleteAdminUser(request.adminUser, Number(id)));
  }

  @RequireAdminPermissions("menu:view")
  @Get("menus")
  async menus(@Query() query: Record<string, string>) {
    return adminOk(await this.accessService.listMenus(query));
  }

  @RequireAdminPermissions("menu:update")
  @Post("menus")
  async saveMenu(@Req() request: { adminUser: AdminRequestUser }, @Body() payload: SaveMenuDto) {
    return adminOk(await this.accessService.saveMenu(request.adminUser, payload));
  }

  @RequireAdminPermissions("menu:update")
  @Delete("menus/:id")
  async deleteMenu(@Req() request: { adminUser: AdminRequestUser }, @Param("id") id: string) {
    return adminOk(await this.accessService.deleteMenu(request.adminUser, Number(id)));
  }
}