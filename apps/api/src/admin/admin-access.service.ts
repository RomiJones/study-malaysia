import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { hash } from "bcryptjs";
import { In, Like, Repository } from "typeorm";
import type { AdminRequestUser } from "../common/guards.js";
import {
  AdminMenuEntity,
  AdminPermissionEntity,
  AdminRoleEntity,
  AdminRoleMenuEntity,
  AdminRolePermissionEntity,
  AdminUserEntity,
  AdminUserRoleEntity,
  type AdminDataScope
} from "../db/entities.js";
import { buildMenuTree, normalizePagination, type AdminListQuery } from "./admin.helpers.js";
import { AdminLogService } from "./admin-log.service.js";

@Injectable()
export class AdminAccessService {
  constructor(
    @InjectRepository(AdminUserEntity) private readonly adminUsersRepository: Repository<AdminUserEntity>,
    @InjectRepository(AdminRoleEntity) private readonly adminRolesRepository: Repository<AdminRoleEntity>,
    @InjectRepository(AdminPermissionEntity) private readonly adminPermissionsRepository: Repository<AdminPermissionEntity>,
    @InjectRepository(AdminMenuEntity) private readonly adminMenusRepository: Repository<AdminMenuEntity>,
    @InjectRepository(AdminUserRoleEntity) private readonly adminUserRoleRepository: Repository<AdminUserRoleEntity>,
    @InjectRepository(AdminRolePermissionEntity) private readonly adminRolePermissionRepository: Repository<AdminRolePermissionEntity>,
    @InjectRepository(AdminRoleMenuEntity) private readonly adminRoleMenuRepository: Repository<AdminRoleMenuEntity>,
    @Inject(AdminLogService) private readonly logService: AdminLogService
  ) {}

  async listCurrentMenus(adminUserId: number) {
    const userRoles = await this.adminUserRoleRepository.find({ where: { adminUserId }, relations: { role: true } });
    const roleIds = userRoles.map((item) => item.roleId);
    const menuRelations = roleIds.length
      ? await this.adminRoleMenuRepository.find({ where: roleIds.map((roleId) => ({ roleId })), relations: { menu: true } })
      : [];
    const menuIds = Array.from(new Set(menuRelations.map((item) => item.menuId)));
    const menus = menuIds.length
      ? await this.adminMenusRepository.find({ where: { id: In(menuIds), isEnabled: true }, order: { sortOrder: "ASC", id: "ASC" } })
      : [];
    return buildMenuTree(menus);
  }

  async listPermissions(query: AdminListQuery) {
    const { page, pageSize, skip } = normalizePagination(query);
    const [items, total] = await this.adminPermissionsRepository.findAndCount({
      where: query.search
        ? [{ code: Like(`%${query.search}%`) }, { name: Like(`%${query.search}%`) }, { groupName: Like(`%${query.search}%`) }]
        : undefined,
      order: { groupName: "ASC", code: "ASC" },
      skip,
      take: pageSize
    });
    return { items, total, page, pageSize };
  }

  async savePermission(actor: AdminRequestUser, payload: Partial<AdminPermissionEntity> & { id?: number }) {
    let entity: AdminPermissionEntity;
    if (payload.id) {
      const existing = await this.adminPermissionsRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Permission not found");
      entity = existing;
      Object.assign(entity, payload);
    } else {
      entity = this.adminPermissionsRepository.create({
        code: payload.code!,
        name: payload.name!,
        groupName: payload.groupName || "general",
        description: payload.description || "",
        isSystem: false
      });
    }
    const saved = await this.adminPermissionsRepository.save(entity);
    await this.logService.write(actor, "permission", payload.id ? "update" : "create", "permission", String(saved.id), `${payload.id ? "Update" : "Create"} permission ${saved.name}`);
    return saved;
  }

  async deletePermission(actor: AdminRequestUser, id: number) {
    const entity = await this.adminPermissionsRepository.findOneBy({ id });
    if (!entity) throw new NotFoundException("Permission not found");
    if (entity.isSystem) throw new BadRequestException("System permission cannot be deleted");
    await this.adminRolePermissionRepository.delete({ permissionId: id });
    await this.adminPermissionsRepository.delete({ id });
    await this.logService.write(actor, "permission", "delete", "permission", String(id), `Delete permission ${entity.code}`);
    return true;
  }

  async listRoles(query: AdminListQuery) {
    const roles = await this.adminRolesRepository.find({ order: { createdAt: "ASC" } });
    const filtered = roles.filter((item) => !query.search || item.code.includes(query.search) || item.name.includes(query.search));
    const roleIds = filtered.map((item) => item.id);
    const [permissionRelations, menuRelations] = await Promise.all([
      roleIds.length ? this.adminRolePermissionRepository.find({ where: roleIds.map((roleId) => ({ roleId })), relations: { permission: true } }) : [],
      roleIds.length ? this.adminRoleMenuRepository.find({ where: roleIds.map((roleId) => ({ roleId })), relations: { menu: true } }) : []
    ]);
    return filtered.map((role) => ({
      ...role,
      permissionCodes: permissionRelations.filter((item) => item.roleId === role.id).map((item) => item.permission.code),
      menuIds: menuRelations.filter((item) => item.roleId === role.id).map((item) => item.menuId)
    }));
  }

  async saveRole(actor: AdminRequestUser, payload: { id?: number; code: string; name: string; description?: string; dataScope: AdminDataScope; isActive?: boolean; permissionCodes: string[]; menuIds: number[] }) {
    let entity: AdminRoleEntity;
    if (payload.id) {
      const existing = await this.adminRolesRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Role not found");
      entity = existing;
      Object.assign(entity, payload);
    } else {
      entity = this.adminRolesRepository.create({
        code: payload.code,
        name: payload.name,
        description: payload.description || "",
        dataScope: payload.dataScope,
        isActive: payload.isActive ?? true,
        isSystem: false
      });
    }

    const saved = await this.adminRolesRepository.save(entity);
    await this.adminRolePermissionRepository.delete({ roleId: saved.id });
    await this.adminRoleMenuRepository.delete({ roleId: saved.id });

    const permissions = payload.permissionCodes.length ? await this.adminPermissionsRepository.find({ where: { code: In(payload.permissionCodes) } }) : [];
    const menus = payload.menuIds.length ? await this.adminMenusRepository.find({ where: { id: In(payload.menuIds) } }) : [];

    if (permissions.length) {
      await this.adminRolePermissionRepository.save(permissions.map((permission) => this.adminRolePermissionRepository.create({ roleId: saved.id, permissionId: permission.id })));
    }
    if (menus.length) {
      await this.adminRoleMenuRepository.save(menus.map((menu) => this.adminRoleMenuRepository.create({ roleId: saved.id, menuId: menu.id })));
    }

    await this.logService.write(actor, "role", payload.id ? "update" : "create", "role", String(saved.id), `${payload.id ? "Update" : "Create"} role ${saved.name}`);
    return saved;
  }

  async deleteRole(actor: AdminRequestUser, id: number) {
    const entity = await this.adminRolesRepository.findOneBy({ id });
    if (!entity) throw new NotFoundException("Role not found");
    if (entity.isSystem) throw new BadRequestException("System role cannot be deleted");
    await this.adminUserRoleRepository.delete({ roleId: id });
    await this.adminRolePermissionRepository.delete({ roleId: id });
    await this.adminRoleMenuRepository.delete({ roleId: id });
    await this.adminRolesRepository.delete({ id });
    await this.logService.write(actor, "role", "delete", "role", String(id), `Delete role ${entity.code}`);
    return true;
  }

  async listAdminUsers(query: AdminListQuery) {
    const { page, pageSize, skip } = normalizePagination(query);
    const [items, total] = await this.adminUsersRepository.findAndCount({
      where: query.search
        ? [{ username: Like(`%${query.search}%`) }, { email: Like(`%${query.search}%`) }, { displayName: Like(`%${query.search}%`) }]
        : undefined,
      order: { createdAt: "DESC" },
      skip,
      take: pageSize
    });
    const userIds = items.map((item) => item.id);
    const relations = userIds.length
      ? await this.adminUserRoleRepository.find({ where: userIds.map((adminUserId) => ({ adminUserId })), relations: { role: true } })
      : [];
    return {
      items: items.map((item) => ({
        ...item,
        passwordHash: undefined,
        roleIds: relations.filter((relation) => relation.adminUserId === item.id).map((relation) => relation.roleId),
        roles: relations.filter((relation) => relation.adminUserId === item.id).map((relation) => ({ id: relation.role.id, code: relation.role.code, name: relation.role.name }))
      })),
      total,
      page,
      pageSize
    };
  }

  async saveAdminUser(actor: AdminRequestUser, payload: { id?: number; username: string; email: string; displayName: string; password?: string; isActive?: boolean; dataScope?: AdminDataScope; managedUniversityIds?: number[]; roleIds: number[] }) {
    let entity: AdminUserEntity;
    if (payload.id) {
      const existing = await this.adminUsersRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Admin user not found");
      entity = existing;
      entity.username = payload.username;
      entity.email = payload.email;
      entity.displayName = payload.displayName;
      entity.isActive = payload.isActive ?? entity.isActive;
      entity.dataScope = payload.dataScope ?? entity.dataScope;
      entity.managedUniversityIds = payload.managedUniversityIds || [];
      if (payload.password) {
        entity.passwordHash = await hash(payload.password, 10);
      }
    } else {
      if (!payload.password) throw new BadRequestException("Password is required when creating an admin user");
      entity = this.adminUsersRepository.create({
        username: payload.username,
        email: payload.email,
        displayName: payload.displayName,
        passwordHash: await hash(payload.password, 10),
        isActive: payload.isActive ?? true,
        dataScope: payload.dataScope || "assigned",
        managedUniversityIds: payload.managedUniversityIds || [],
        createdById: actor.id
      });
    }

    const saved = await this.adminUsersRepository.save(entity);
    await this.adminUserRoleRepository.delete({ adminUserId: saved.id });
    if (payload.roleIds.length) {
      await this.adminUserRoleRepository.save(payload.roleIds.map((roleId) => this.adminUserRoleRepository.create({ adminUserId: saved.id, roleId })));
    }
    await this.logService.write(actor, "admin-user", payload.id ? "update" : "create", "admin-user", String(saved.id), `${payload.id ? "Update" : "Create"} admin user ${saved.displayName}`);
    return saved;
  }

  async deleteAdminUser(actor: AdminRequestUser, id: number) {
    const entity = await this.adminUsersRepository.findOneBy({ id });
    if (!entity) throw new NotFoundException("Admin user not found");
    if (entity.id === actor.id) throw new BadRequestException("Cannot delete current login user");
    await this.adminUserRoleRepository.delete({ adminUserId: id });
    await this.adminUsersRepository.delete({ id });
    await this.logService.write(actor, "admin-user", "delete", "admin-user", String(id), `Delete admin user ${entity.username}`);
    return true;
  }

  async listMenus(query: AdminListQuery) {
    const menus = await this.adminMenusRepository.find({ order: { sortOrder: "ASC", id: "ASC" } });
    const keyword = query.search || "";
    const filtered = keyword ? menus.filter((item) => item.title.includes(keyword) || item.path.includes(keyword)) : menus;
    return buildMenuTree(filtered, true);
  }

  async saveMenu(actor: AdminRequestUser, payload: Partial<AdminMenuEntity> & { id?: number }) {
    let entity: AdminMenuEntity;
    if (payload.id) {
      const existing = await this.adminMenusRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Menu not found");
      entity = existing;
      Object.assign(entity, payload);
    } else {
      entity = this.adminMenusRepository.create({
        title: payload.title!,
        path: payload.path || "",
        icon: payload.icon || "Menu",
        parentId: payload.parentId ?? null,
        routeName: payload.routeName || "",
        permissionCode: payload.permissionCode || "",
        sortOrder: payload.sortOrder || 0,
        isVisible: payload.isVisible ?? true,
        isEnabled: payload.isEnabled ?? true,
        menuType: payload.menuType || "menu"
      });
    }
    const saved = await this.adminMenusRepository.save(entity);
    await this.logService.write(actor, "menu", payload.id ? "update" : "create", "menu", String(saved.id), `${payload.id ? "Update" : "Create"} menu ${saved.title}`);
    return saved;
  }

  async deleteMenu(actor: AdminRequestUser, id: number) {
    await this.adminMenusRepository.delete({ id });
    await this.adminRoleMenuRepository.delete({ menuId: id });
    await this.logService.write(actor, "menu", "delete", "menu", String(id), `Delete menu ${id}`);
    return true;
  }
}
