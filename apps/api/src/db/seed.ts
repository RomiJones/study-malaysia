import "reflect-metadata";
import { DataSource } from "typeorm";
import { hash } from "bcryptjs";
import {
  ALL_ENTITIES,
  AdminMenuEntity,
  AdminPermissionEntity,
  AdminRoleEntity,
  AdminRoleMenuEntity,
  AdminRolePermissionEntity,
  AdminUserEntity,
  AdminUserRoleEntity,
  type ApplicationStatus,
  ApplicationFollowUpEntity,
  ContentBlockEntity,
  DictionaryItemEntity,
  PlannerProfileEntity,
  ProgramEntity,
  StudentApplicationEntity,
  SystemConfigEntity,
  UniversityEntity,
  UserEntity
} from "./entities.js";
import { seedAdminUsers, seedConfigs, seedDictionaryItems, seedMenus, seedPermissions, seedRoles } from "./admin-seed.js";
import { seedContentBlocks, seedPrograms, seedUniversities, seedUsers } from "./seed-data.js";
import { loadEnvFiles } from "../config/env.js";

loadEnvFiles();

async function run() {
  const dataSource = new DataSource({
    type: "mysql",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "123456",
    database: process.env.MYSQL_DATABASE || "study_malaysia",
    entities: [...ALL_ENTITIES],
    synchronize: true,
    charset: "utf8mb4_unicode_ci"
  });

  await dataSource.initialize();

  const repos = {
    users: dataSource.getRepository(UserEntity),
    plannerProfiles: dataSource.getRepository(PlannerProfileEntity),
    universities: dataSource.getRepository(UniversityEntity),
    programs: dataSource.getRepository(ProgramEntity),
    content: dataSource.getRepository(ContentBlockEntity),
    permissions: dataSource.getRepository(AdminPermissionEntity),
    menus: dataSource.getRepository(AdminMenuEntity),
    roles: dataSource.getRepository(AdminRoleEntity),
    adminUsers: dataSource.getRepository(AdminUserEntity),
    userRoles: dataSource.getRepository(AdminUserRoleEntity),
    rolePermissions: dataSource.getRepository(AdminRolePermissionEntity),
    roleMenus: dataSource.getRepository(AdminRoleMenuEntity),
    applications: dataSource.getRepository(StudentApplicationEntity),
    followUps: dataSource.getRepository(ApplicationFollowUpEntity),
    configs: dataSource.getRepository(SystemConfigEntity),
    dictionaries: dataSource.getRepository(DictionaryItemEntity)
  };

  const deleteOrder = [
    "application_follow_ups",
    "student_applications",
    "planner_tasks",
    "favorites",
    "planner_profiles",
    "admin_user_roles",
    "admin_role_permissions",
    "admin_role_menus",
    "operation_logs",
    "admin_users",
    "admin_roles",
    "admin_permissions",
    "admin_menus",
    "system_configs",
    "dictionary_items",
    "programs",
    "universities",
    "content_blocks",
    "users"
  ];

  for (const table of deleteOrder) {
    await dataSource.createQueryBuilder().delete().from(table).execute();
  }

  const userMap = new Map<string, UserEntity>();
  for (const item of seedUsers) {
    const saved = await repos.users.save(repos.users.create({
      role: item.role,
      method: item.method,
      account: item.account,
      displayName: item.displayName,
      passwordHash: await hash(item.password, 10)
    }));
    userMap.set(item.account, saved);
    if (saved.role === "student") {
      await repos.plannerProfiles.save(repos.plannerProfiles.create({
        userId: saved.id,
        materialProgress: {},
        visaChecklist: {
          offerAccepted: false,
          depositPaid: false,
          visaDocsReady: false,
          preDeparture: false,
          arrivalReady: false
        }
      }));
    }
  }

  const universityMap = new Map<string, UniversityEntity>();
  for (const item of seedUniversities) {
    const saved = await repos.universities.save(repos.universities.create({ ...item, programCount: 0, isPublished: true }));
    universityMap.set(item.code, saved);
  }

  for (const item of seedPrograms) {
    const university = universityMap.get(item.universityCode);
    if (!university) continue;
    await repos.programs.save(repos.programs.create({
      universityId: university.id,
      slug: item.slug,
      code: item.code,
      name: item.name,
      level: item.level,
      category: item.category,
      faculty: item.faculty,
      durationYears: item.durationYears,
      annualTuitionCny: item.annualTuitionCny,
      intakeMonths: item.intakeMonths,
      languageRequirement: item.languageRequirement,
      requirement: item.requirement,
      applicationDocs: item.applicationDocs,
      curriculum: item.curriculum,
      careers: item.careers,
      specializations: item.specializations,
      description: item.description,
      isPublished: true
    }));
  }

  for (const university of universityMap.values()) {
    university.programCount = await repos.programs.count({ where: { universityId: university.id } });
    await repos.universities.save(university);
  }

  for (const block of seedContentBlocks) {
    await repos.content.save(repos.content.create(block));
  }

  const permissionMap = new Map<string, AdminPermissionEntity>();
  for (const item of seedPermissions) {
    const saved = await repos.permissions.save(repos.permissions.create({ ...item, isSystem: true }));
    permissionMap.set(item.code, saved);
  }

  const menuMap = new Map<string, AdminMenuEntity>();
  for (const item of seedMenus.filter((menu) => !menu.parentCode)) {
    const saved = await repos.menus.save(repos.menus.create({
      title: item.title,
      icon: item.icon,
      path: item.path,
      routeName: item.routeName,
      permissionCode: item.permissionCode || "",
      menuType: item.menuType,
      sortOrder: item.sortOrder,
      isVisible: item.isVisible ?? true,
      isEnabled: item.isEnabled ?? true,
      parentId: null
    }));
    menuMap.set(item.code, saved);
  }
  for (const item of seedMenus.filter((menu) => menu.parentCode)) {
    const saved = await repos.menus.save(repos.menus.create({
      title: item.title,
      icon: item.icon,
      path: item.path,
      routeName: item.routeName,
      permissionCode: item.permissionCode || "",
      menuType: item.menuType,
      sortOrder: item.sortOrder,
      isVisible: item.isVisible ?? true,
      isEnabled: item.isEnabled ?? true,
      parentId: menuMap.get(item.parentCode!)?.id || null
    }));
    menuMap.set(item.code, saved);
  }

  const roleMap = new Map<string, AdminRoleEntity>();
  for (const item of seedRoles) {
    const saved = await repos.roles.save(repos.roles.create({
      code: item.code,
      name: item.name,
      description: item.description,
      dataScope: item.dataScope,
      isSystem: item.isSystem ?? true,
      isActive: true
    }));
    roleMap.set(item.code, saved);
    await repos.rolePermissions.save(
      item.permissions
        .map((code) => permissionMap.get(code))
        .filter(Boolean)
        .map((permission) => repos.rolePermissions.create({ roleId: saved.id, permissionId: permission!.id }))
    );
    await repos.roleMenus.save(
      item.menus
        .map((code) => menuMap.get(code))
        .filter(Boolean)
        .map((menu) => repos.roleMenus.create({ roleId: saved.id, menuId: menu!.id }))
    );
  }

  for (const item of seedAdminUsers) {
    const saved = await repos.adminUsers.save(repos.adminUsers.create({
      username: item.username,
      email: item.email,
      displayName: item.displayName,
      passwordHash: await hash(item.password, 10),
      isActive: item.isActive ?? true,
      dataScope: item.dataScope || "assigned",
      managedUniversityIds: item.managedUniversityIds || [],
      createdById: null
    }));
    await repos.userRoles.save(
      item.roles
        .map((code) => roleMap.get(code))
        .filter(Boolean)
        .map((role) => repos.userRoles.create({ adminUserId: saved.id, roleId: role!.id }))
    );
  }

  for (const item of seedConfigs) {
    await repos.configs.save(repos.configs.create({
      category: item.category,
      configKey: item.configKey,
      label: item.label,
      value: item.value,
      description: item.description,
      sortOrder: item.sortOrder,
      isPublic: item.isPublic ?? false
    }));
  }

  for (const item of seedDictionaryItems) {
    await repos.dictionaries.save(repos.dictionaries.create({
      dictType: item.dictType,
      code: item.code,
      label: item.label,
      status: item.status || "enabled",
      sortOrder: item.sortOrder,
      extra: item.extra || null
    }));
  }

  const student = userMap.get("demo@studymy.local");
  const superAdmin = await repos.adminUsers.findOneBy({ username: "superadmin" });
  if (student && superAdmin) {
    const samplePrograms = await repos.programs.find({ take: 3, relations: { university: true }, order: { id: "ASC" } });
    const statuses: ApplicationStatus[] = ["submitted", "reviewing", "offer"];
    let index = 0;
    for (const program of samplePrograms) {
      const application = await repos.applications.save(repos.applications.create({
        applicationNo: `APP-${new Date().getFullYear()}-${String(index + 1).padStart(4, "0")}`,
        studentId: student.id,
        studentName: student.displayName,
        studentEmail: student.account,
        studentPhone: "",
        universityId: program.universityId,
        programId: program.id,
        applicationStatus: statuses[index] || "submitted",
        currentStage: index === 2 ? "conditional-offer" : index === 1 ? "review" : "ready",
        materialStatus: index === 0 ? "progress" : "done",
        visaStatus: index === 2 ? "preparing" : "not-started",
        priority: index === 0 ? "high" : "medium",
        intake: "2026-09",
        ownerAdminId: superAdmin.id,
        assignedAdminId: superAdmin.id,
        submittedAt: "2026-03-15",
        expectedDecisionDate: "2026-05-30",
        notes: "Seeded sample application",
        metadata: { source: "seed" },
        lastFollowUpAt: new Date()
      }));
      await repos.followUps.save(repos.followUps.create({
        applicationId: application.id,
        adminUserId: superAdmin.id,
        followUpType: "note",
        statusFrom: "draft",
        statusTo: application.applicationStatus,
        content: "Initial seeded follow-up record.",
        nextStep: "Review materials and confirm intake.",
        nextFollowUpAt: new Date()
      }));
      index += 1;
    }
  }

  await dataSource.destroy();
  console.log("StudyMY seed completed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
