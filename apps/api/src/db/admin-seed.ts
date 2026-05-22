export interface SeedAdminUser {
  username: string;
  email: string;
  displayName: string;
  password: string;
  isActive?: boolean;
  dataScope?: "all" | "assigned" | "created";
  managedUniversityIds?: number[];
  roles: string[];
}

export interface SeedRole {
  code: string;
  name: string;
  description: string;
  dataScope: "all" | "assigned" | "created";
  isSystem?: boolean;
  permissions: string[];
  menus: string[];
}

export interface SeedPermission {
  code: string;
  name: string;
  groupName: string;
  description: string;
}

export interface SeedMenu {
  code: string;
  parentCode?: string;
  menuType: "directory" | "menu" | "action";
  title: string;
  icon: string;
  path: string;
  routeName: string;
  permissionCode?: string;
  sortOrder: number;
  isVisible?: boolean;
  isEnabled?: boolean;
}

export interface SeedConfig {
  category: string;
  configKey: string;
  label: string;
  value: string;
  description: string;
  sortOrder: number;
  isPublic?: boolean;
}

export interface SeedDictionaryItem {
  dictType: string;
  code: string;
  label: string;
  status?: "enabled" | "disabled";
  sortOrder: number;
  extra?: Record<string, unknown>;
}

export const seedPermissions: SeedPermission[] = [
  { code: "dashboard:view", name: "查看仪表盘", groupName: "dashboard", description: "查看统计与工作台数据" },
  { code: "school:view", name: "查看学校", groupName: "school", description: "查看学校列表与详情" },
  { code: "school:create", name: "新增学校", groupName: "school", description: "新增学校数据" },
  { code: "school:update", name: "编辑学校", groupName: "school", description: "编辑学校数据" },
  { code: "school:delete", name: "删除学校", groupName: "school", description: "删除学校数据" },
  { code: "school:publish", name: "发布学校", groupName: "school", description: "上下架学校" },
  { code: "program:view", name: "查看专业", groupName: "program", description: "查看专业列表与详情" },
  { code: "program:create", name: "新增专业", groupName: "program", description: "新增专业数据" },
  { code: "program:update", name: "编辑专业", groupName: "program", description: "编辑专业数据" },
  { code: "program:delete", name: "删除专业", groupName: "program", description: "删除专业数据" },
  { code: "program:publish", name: "发布专业", groupName: "program", description: "上下架专业" },
  { code: "content:view", name: "查看内容", groupName: "content", description: "查看站点内容" },
  { code: "content:update", name: "编辑内容", groupName: "content", description: "维护首页与 CMS 内容" },
  { code: "application:view", name: "查看申请", groupName: "application", description: "查看学生申请数据" },
  { code: "application:update", name: "更新申请", groupName: "application", description: "编辑申请、状态与备注" },
  { code: "application:assign", name: "分配申请", groupName: "application", description: "分配负责人和顾问" },
  { code: "application:export", name: "导出申请", groupName: "application", description: "导出申请数据" },
  { code: "application:followup", name: "跟进记录", groupName: "application", description: "新增跟进记录" },
  { code: "admin-user:view", name: "查看管理员", groupName: "access", description: "查看管理员账号" },
  { code: "admin-user:create", name: "新增管理员", groupName: "access", description: "新增管理员账号" },
  { code: "admin-user:update", name: "编辑管理员", groupName: "access", description: "编辑管理员账号" },
  { code: "admin-user:delete", name: "删除管理员", groupName: "access", description: "删除管理员账号" },
  { code: "role:view", name: "查看角色", groupName: "access", description: "查看角色列表" },
  { code: "role:update", name: "维护角色", groupName: "access", description: "维护角色和权限" },
  { code: "role:delete", name: "删除角色", groupName: "access", description: "删除角色" },
  { code: "permission:view", name: "查看权限", groupName: "access", description: "查看权限点" },
  { code: "permission:update", name: "维护权限", groupName: "access", description: "维护权限点" },
  { code: "permission:delete", name: "删除权限", groupName: "access", description: "删除权限点" },
  { code: "menu:view", name: "查看菜单", groupName: "access", description: "查看后台菜单" },
  { code: "menu:update", name: "维护菜单", groupName: "access", description: "维护后台菜单" },
  { code: "settings:view", name: "查看设置", groupName: "settings", description: "查看系统配置" },
  { code: "settings:update", name: "维护设置", groupName: "settings", description: "维护系统配置和字典" },
  { code: "log:view", name: "查看日志", groupName: "settings", description: "查看操作日志" }
];

export const seedMenus: SeedMenu[] = [
  { code: "dashboard", menuType: "menu", title: "仪表盘", icon: "DataBoard", path: "/dashboard", routeName: "dashboard", permissionCode: "dashboard:view", sortOrder: 10 },
  { code: "access", menuType: "directory", title: "权限中心", icon: "Lock", path: "/access", routeName: "access", sortOrder: 20 },
  { code: "access-admins", parentCode: "access", menuType: "menu", title: "管理员", icon: "User", path: "/admins", routeName: "admins", permissionCode: "admin-user:view", sortOrder: 21 },
  { code: "access-roles", parentCode: "access", menuType: "menu", title: "角色管理", icon: "Avatar", path: "/roles", routeName: "roles", permissionCode: "role:view", sortOrder: 22 },
  { code: "access-permissions", parentCode: "access", menuType: "menu", title: "权限点", icon: "Key", path: "/permissions", routeName: "permissions", permissionCode: "permission:view", sortOrder: 23 },
  { code: "access-menus", parentCode: "access", menuType: "menu", title: "菜单管理", icon: "Menu", path: "/menus", routeName: "menus", permissionCode: "menu:view", sortOrder: 24 },
  { code: "schools", menuType: "menu", title: "学校管理", icon: "School", path: "/universities", routeName: "universities", permissionCode: "school:view", sortOrder: 30 },
  { code: "programs", menuType: "menu", title: "专业管理", icon: "Reading", path: "/programs", routeName: "programs", permissionCode: "program:view", sortOrder: 40 },
  { code: "content", menuType: "menu", title: "内容管理", icon: "EditPen", path: "/content", routeName: "content", permissionCode: "content:view", sortOrder: 50 },
  { code: "applications", menuType: "menu", title: "学生申请", icon: "Document", path: "/applications", routeName: "applications", permissionCode: "application:view", sortOrder: 60 },
  { code: "settings", menuType: "directory", title: "系统设置", icon: "Setting", path: "/settings", routeName: "settings", sortOrder: 70 },
  { code: "settings-base", parentCode: "settings", menuType: "menu", title: "基础配置", icon: "Tools", path: "/settings", routeName: "settings", permissionCode: "settings:view", sortOrder: 71 },
  { code: "settings-logs", parentCode: "settings", menuType: "menu", title: "操作日志", icon: "Tickets", path: "/settings?tab=logs", routeName: "settings", permissionCode: "log:view", sortOrder: 72 }
];

export const seedRoles: SeedRole[] = [
  {
    code: "super-admin",
    name: "超级管理员",
    description: "拥有后台全部权限与全量数据权限",
    dataScope: "all",
    isSystem: true,
    permissions: seedPermissions.map((item) => item.code),
    menus: seedMenus.map((item) => item.code)
  },
  {
    code: "content-editor",
    name: "内容运营",
    description: "负责学校、专业与内容维护",
    dataScope: "assigned",
    isSystem: true,
    permissions: [
      "dashboard:view",
      "school:view",
      "school:create",
      "school:update",
      "school:publish",
      "program:view",
      "program:create",
      "program:update",
      "program:publish",
      "content:view",
      "content:update"
    ],
    menus: ["dashboard", "schools", "programs", "content"]
  },
  {
    code: "counselor",
    name: "申请顾问",
    description: "负责学生申请跟进与状态管理",
    dataScope: "assigned",
    isSystem: true,
    permissions: [
      "dashboard:view",
      "application:view",
      "application:update",
      "application:assign",
      "application:followup",
      "application:export",
      "school:view",
      "program:view"
    ],
    menus: ["dashboard", "schools", "programs", "applications"]
  }
];

export const seedAdminUsers: SeedAdminUser[] = [
  {
    username: "superadmin",
    email: "superadmin@studymy.local",
    displayName: "系统超级管理员",
    password: "Admin123!",
    dataScope: "all",
    roles: ["super-admin"]
  },
  {
    username: "editor",
    email: "editor@studymy.local",
    displayName: "内容运营",
    password: "Editor123!",
    dataScope: "assigned",
    roles: ["content-editor"]
  },
  {
    username: "counselor",
    email: "counselor@studymy.local",
    displayName: "申请顾问",
    password: "Counselor123!",
    dataScope: "assigned",
    roles: ["counselor"]
  }
];

export const seedConfigs: SeedConfig[] = [
  { category: "site", configKey: "siteName", label: "站点名称", value: "StudyMY", description: "前台站点展示名称", sortOrder: 10, isPublic: true },
  { category: "site", configKey: "defaultLocale", label: "默认语言", value: "zh-CN", description: "前台默认语言", sortOrder: 20, isPublic: true },
  { category: "upload", configKey: "maxFileSizeMb", label: "上传大小限制(MB)", value: "20", description: "后台文件上传大小限制", sortOrder: 30 },
  { category: "upload", configKey: "allowedFileTypes", label: "允许上传格式", value: "pdf,jpg,jpeg,png,doc,docx,xls,xlsx", description: "逗号分隔", sortOrder: 40 },
  { category: "application", configKey: "autoAssign", label: "自动分配顾问", value: "false", description: "是否自动分配学生申请负责人", sortOrder: 50 }
];

export const seedDictionaryItems: SeedDictionaryItem[] = [
  { dictType: "application_status", code: "draft", label: "待整理", sortOrder: 10 },
  { dictType: "application_status", code: "submitted", label: "已递交", sortOrder: 20 },
  { dictType: "application_status", code: "reviewing", label: "审核中", sortOrder: 30 },
  { dictType: "application_status", code: "offer", label: "Offer 阶段", sortOrder: 40 },
  { dictType: "application_status", code: "visa", label: "签证阶段", sortOrder: 50 },
  { dictType: "application_status", code: "done", label: "已完成", sortOrder: 60 },
  { dictType: "material_status", code: "draft", label: "待准备", sortOrder: 10 },
  { dictType: "material_status", code: "progress", label: "准备中", sortOrder: 20 },
  { dictType: "material_status", code: "done", label: "已齐全", sortOrder: 30 },
  { dictType: "visa_status", code: "not-started", label: "未开始", sortOrder: 10 },
  { dictType: "visa_status", code: "preparing", label: "准备中", sortOrder: 20 },
  { dictType: "visa_status", code: "submitted", label: "已提交", sortOrder: 30 },
  { dictType: "visa_status", code: "approved", label: "已获批", sortOrder: 40 }
];