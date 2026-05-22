import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AdminPermissionEntity,
  AdminRolePermissionEntity,
  AdminUserEntity,
  AdminUserRoleEntity,
  UserEntity
} from "../db/entities.js";
import { ADMIN_PERMISSION_KEY } from "./admin-permissions.js";

export interface AdminRequestUser {
  id: number;
  username: string;
  displayName: string;
  dataScope: string;
  permissions: string[];
  roleCodes: string[];
  managedUniversityIds: number[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly usersRepository: Repository<UserEntity>;

  constructor(
    @Inject(JwtService) jwtService: JwtService,
    @InjectRepository(UserEntity) usersRepository: Repository<UserEntity>
  ) {
    this.jwtService = jwtService;
    this.usersRepository = usersRepository;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number; tokenType?: string }>(header.replace("Bearer ", ""));
      if (payload.tokenType && payload.tokenType !== "student") {
        throw new UnauthorizedException("Invalid token type");
      }
      const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException("User not found");
      }
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}

@Injectable()
export class AdminGuard extends AuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    if (request.user?.role !== "admin") {
      throw new BadRequestException("Admin access required");
    }
    return true;
  }
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly adminUsersRepository: Repository<AdminUserEntity>;
  private readonly userRoleRepository: Repository<AdminUserRoleEntity>;
  private readonly rolePermissionRepository: Repository<AdminRolePermissionEntity>;

  constructor(
    @Inject(JwtService) jwtService: JwtService,
    @InjectRepository(AdminUserEntity) adminUsersRepository: Repository<AdminUserEntity>,
    @InjectRepository(AdminUserRoleEntity) userRoleRepository: Repository<AdminUserRoleEntity>,
    @InjectRepository(AdminRolePermissionEntity) rolePermissionRepository: Repository<AdminRolePermissionEntity>
  ) {
    this.jwtService = jwtService;
    this.adminUsersRepository = adminUsersRepository;
    this.userRoleRepository = userRoleRepository;
    this.rolePermissionRepository = rolePermissionRepository;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing admin bearer token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: number; tokenType?: string }>(header.replace("Bearer ", ""));
      if (payload.tokenType !== "admin") {
        throw new UnauthorizedException("Invalid admin token");
      }

      const adminUser = await this.adminUsersRepository.findOne({ where: { id: payload.sub } });
      if (!adminUser || !adminUser.isActive) {
        throw new UnauthorizedException("Admin user not found");
      }

      const roleRelations = await this.userRoleRepository.find({
        where: { adminUserId: adminUser.id },
        relations: { role: true }
      });
      const activeRoles = roleRelations.map((relation) => relation.role).filter((role) => role && role.isActive);
      const roleIds = activeRoles.map((role) => role.id);
      const permissionRelations = roleIds.length
        ? await this.rolePermissionRepository.find({
            where: roleIds.map((roleId) => ({ roleId })),
            relations: { permission: true }
          })
        : [];
      const permissions = Array.from(
        new Set(permissionRelations.map((relation) => relation.permission?.code).filter(Boolean) as string[])
      );

      request.adminUser = {
        id: adminUser.id,
        username: adminUser.username,
        displayName: adminUser.displayName,
        dataScope: adminUser.dataScope,
        managedUniversityIds: adminUser.managedUniversityIds || [],
        permissions,
        roleCodes: activeRoles.map((role) => role.code)
      } satisfies AdminRequestUser;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid admin token");
    }
  }
}

@Injectable()
export class AdminPermissionGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(@Inject(Reflector) reflector: Reflector) {
    this.reflector = reflector;
  }

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ADMIN_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const adminUser = request.adminUser as AdminRequestUser | undefined;
    if (!adminUser) {
      throw new UnauthorizedException("Admin user missing");
    }

    const granted = new Set(adminUser.permissions);
    const matched = required.every((permission) => granted.has(permission));
    if (!matched) {
      throw new ForbiddenException("Permission denied");
    }
    return true;
  }
}
