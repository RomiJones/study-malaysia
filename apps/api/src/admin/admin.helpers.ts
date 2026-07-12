import type { SelectQueryBuilder } from "typeorm";
import type { AdminRequestUser } from "../common/guards.js";
import type { AdminMenuEntity } from "../db/entities.js";

export interface AdminListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function normalizePagination(query: AdminListQuery) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function buildMenuTree(menus: AdminMenuEntity[], includeDisabled = false) {
  const source = includeDisabled ? menus : menus.filter((item) => item.isVisible && item.isEnabled);
  const map = new Map<number, any>();
  const roots: any[] = [];

  for (const item of source) {
    map.set(item.id, { ...item, children: [] });
  }
  for (const item of source) {
    const current = map.get(item.id);
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(current);
    } else {
      roots.push(current);
    }
  }

  const sortTree = (nodes: any[]): any[] =>
    nodes
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({ ...item, children: sortTree(item.children || []) }));

  return sortTree(roots);
}

export function applyDataScope(qb: SelectQueryBuilder<any>, adminUser: AdminRequestUser) {
  if (adminUser.roleCodes?.includes("super-admin") || adminUser.dataScope === "all") {
    return qb;
  }
  if (adminUser.dataScope === "created") {
    qb.andWhere("application.ownerAdminId = :adminUserId", { adminUserId: adminUser.id });
    return qb;
  }
  qb.andWhere("(application.ownerAdminId = :adminUserId OR application.assignedAdminId = :adminUserId)", {
    adminUserId: adminUser.id
  });
  return qb;
}
