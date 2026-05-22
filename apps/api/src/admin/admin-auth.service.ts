import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { compare } from "bcryptjs";
import { In, Repository } from "typeorm";
import {
  AdminMenuEntity,
  AdminRoleMenuEntity,
  AdminRolePermissionEntity,
  AdminUserEntity,
  AdminUserRoleEntity
} from "../db/entities.js";
import { buildMenuTree } from "./admin.helpers.js";

@Injectable()
export class AdminAuthService {
  private readonly adminUsersRepository: Repository<AdminUserEntity>;
  private readonly adminMenusRepository: Repository<AdminMenuEntity>;
  private readonly adminUserRoleRepository: Repository<AdminUserRoleEntity>;
  private readonly adminRolePermissionRepository: Repository<AdminRolePermissionEntity>;
  private readonly adminRoleMenuRepository: Repository<AdminRoleMenuEntity>;
  private readonly jwtService: JwtService;

  constructor(
    @InjectRepository(AdminUserEntity) adminUsersRepository: Repository<AdminUserEntity>,
    @InjectRepository(AdminMenuEntity) adminMenusRepository: Repository<AdminMenuEntity>,
    @InjectRepository(AdminUserRoleEntity) adminUserRoleRepository: Repository<AdminUserRoleEntity>,
    @InjectRepository(AdminRolePermissionEntity) adminRolePermissionRepository: Repository<AdminRolePermissionEntity>,
    @InjectRepository(AdminRoleMenuEntity) adminRoleMenuRepository: Repository<AdminRoleMenuEntity>,
    @Inject(JwtService) jwtService: JwtService
  ) {
    this.adminUsersRepository = adminUsersRepository;
    this.adminMenusRepository = adminMenusRepository;
    this.adminUserRoleRepository = adminUserRoleRepository;
    this.adminRolePermissionRepository = adminRolePermissionRepository;
    this.adminRoleMenuRepository = adminRoleMenuRepository;
    this.jwtService = jwtService;
  }

  async login(payload: { username: string; password: string }) {
    const adminUser = await this.adminUsersRepository.findOne({ where: [{ username: payload.username }, { email: payload.username }] });
    if (!adminUser || !adminUser.isActive) {
      throw new UnauthorizedException("管理员账号不存在或已停用");
    }

    const matched = await compare(payload.password, adminUser.passwordHash);
    if (!matched) {
      throw new UnauthorizedException("密码错误");
    }

    const accessToken = await this.jwtService.signAsync({ sub: adminUser.id, tokenType: "admin" }, { expiresIn: "12h" });
    return {
      accessToken,
      user: await this.me(adminUser.id)
    };
  }

  async me(adminUserId: number) {
    const adminUser = await this.adminUsersRepository.findOneBy({ id: adminUserId });
    if (!adminUser) {
      throw new UnauthorizedException("管理员不存在");
    }

    const userRoles = await this.adminUserRoleRepository.find({ where: { adminUserId }, relations: { role: true } });
    const roles = userRoles.map((item) => item.role).filter((item) => item && item.isActive);
    const roleIds = roles.map((item) => item.id);
    const [permissionRelations, menuRelations] = await Promise.all([
      roleIds.length
        ? this.adminRolePermissionRepository.find({ where: roleIds.map((roleId) => ({ roleId })), relations: { permission: true } })
        : [],
      roleIds.length ? this.adminRoleMenuRepository.find({ where: roleIds.map((roleId) => ({ roleId })), relations: { menu: true } }) : []
    ]);

    const permissions = Array.from(new Set(permissionRelations.map((item) => item.permission.code)));
    const menuIds = Array.from(new Set(menuRelations.map((item) => item.menuId)));
    const menus = menuIds.length
      ? await this.adminMenusRepository.find({ where: { id: In(menuIds), isEnabled: true }, order: { sortOrder: "ASC", id: "ASC" } })
      : [];

    return {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      displayName: adminUser.displayName,
      isActive: adminUser.isActive,
      dataScope: adminUser.dataScope,
      managedUniversityIds: adminUser.managedUniversityIds || [],
      roles: roles.map((item) => ({ id: item.id, code: item.code, name: item.name, dataScope: item.dataScope })),
      permissions,
      menus: buildMenuTree(menus)
    };
  }
}
