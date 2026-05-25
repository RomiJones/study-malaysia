import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation
} from "typeorm";
import {
  SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS,
  SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS
} from "@studymy/shared";
import type {
  ApplicationTier,
  ApplicationStage,
  AuthMethod,
  DegreeLevel,
  FeeAuditStatus,
  InstitutionOwnership,
  InstitutionType,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  MaterialStatus,
  OfficialSourceLink,
  OfficialSourceStatus,
  PlannerVisaChecklist,
  ProgramCategory,
  ProgramCategoryCode,
  ProgramRequirement,
  PublicDisplayStatus,
  SmartRecommendationOptionalProfileField,
  SmartRecommendationProfileField,
  SmartRecommendationPublicDisplayStatus,
  SmartRecommendationReasonDto,
  SmartRecommendationRequiredProfileField,
  SmartRecommendationRiskDto,
  SmartRecommendationTraceDto,
  SupportedLocale,
  TuitionCurrency
} from "@studymy/shared";

export type AdminDataScope = "all" | "assigned" | "created";
export type AdminMenuType = "directory" | "menu" | "action";
export type ApplicationStatus = "draft" | "submitted" | "reviewing" | "offer" | "visa" | "done" | "closed";
export type VisaStatus = "not-started" | "preparing" | "submitted" | "approved" | "rejected";
export type FollowUpType = "note" | "status" | "assign" | "material" | "visa";
export type UserLocalePreferenceSource = "default" | "browser" | "local-storage" | "query-param" | "user-account";
export type RecommendationProfileFieldKey = SmartRecommendationProfileField;
export type RecommendationRequiredProfileFieldKey = SmartRecommendationRequiredProfileField;
export type RecommendationOptionalProfileFieldKey = SmartRecommendationOptionalProfileField;
export type PlannerProfileCompletenessStatus = "incomplete" | "complete" | "stale";
export type RecommendationRunStatus = "blocked-profile-incomplete" | "generated" | "no-match" | "expired";

export const RECOMMENDATION_REQUIRED_PROFILE_FIELDS: RecommendationRequiredProfileFieldKey[] = [
  ...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS
];

export const RECOMMENDATION_OPTIONAL_PROFILE_FIELDS: RecommendationOptionalProfileFieldKey[] = [
  ...SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS
];

export interface RecommendationProfileSnapshot {
  level: DegreeLevel;
  targetCategory: ProgramCategoryCode;
  budgetCny: number;
  gpa: number;
  ielts: number;
  experience?: string | null;
  acceptNoLanguage: boolean;
}

export interface RecommendationResultSnapshot {
  universityId: number;
  programId: number;
  score: number;
  annualCostCny: number;
  tier: ApplicationTier;
  publicDisplayStatus: SmartRecommendationPublicDisplayStatus;
  reasons: LocalizedStringArray;
  reasonsDetailed: SmartRecommendationReasonDto[];
  risks: SmartRecommendationRiskDto[];
  trace: SmartRecommendationTraceDto;
}

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 20, default: "student" })
  role!: "student" | "admin";

  @Column({ type: "varchar", length: 20 })
  method!: AuthMethod;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 190 })
  account!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "varchar", length: 120 })
  displayName!: string;

  @Column({ type: "varchar", length: 10, default: "zh-CN" })
  preferredLocale!: SupportedLocale;

  @Column({ type: "varchar", length: 30, default: "default" })
  localePreferenceSource!: UserLocalePreferenceSource;

  @Column({ type: "datetime", nullable: true })
  localePreferenceUpdatedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => PlannerProfileEntity, (profile) => profile.user)
  profile?: Relation<PlannerProfileEntity>;

  @OneToMany(() => FavoriteEntity, (favorite) => favorite.user)
  favorites?: Relation<FavoriteEntity[]>;

  @OneToMany(() => CompareItemEntity, (compareItem) => compareItem.user)
  compareItems?: Relation<CompareItemEntity[]>;

  @OneToMany(() => PlannerTaskEntity, (task) => task.user)
  plannerTasks?: Relation<PlannerTaskEntity[]>;

  @OneToMany(() => RecommendationRunEntity, (run) => run.user)
  recommendationRuns?: Relation<RecommendationRunEntity[]>;

  @OneToMany(() => StudentApplicationEntity, (application) => application.student)
  applications?: Relation<StudentApplicationEntity[]>;
}

@Entity({ name: "admin_users" })
export class AdminUserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 80 })
  username!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 190 })
  email!: string;

  @Column({ type: "varchar", length: 120 })
  displayName!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "varchar", length: 20, default: "all" })
  dataScope!: AdminDataScope;

  @Column({ type: "json", nullable: true })
  managedUniversityIds!: number[] | null;

  @Column({ type: "int", nullable: true })
  createdById!: number | null;

  @ManyToOne(() => AdminUserEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "createdById" })
  createdBy?: Relation<AdminUserEntity>;

  @OneToMany(() => AdminUserRoleEntity, (relation) => relation.adminUser)
  roleRelations?: Relation<AdminUserRoleEntity[]>;

  @OneToMany(() => StudentApplicationEntity, (application) => application.ownerAdmin)
  ownedApplications?: Relation<StudentApplicationEntity[]>;

  @OneToMany(() => StudentApplicationEntity, (application) => application.assignedAdmin)
  assignedApplications?: Relation<StudentApplicationEntity[]>;

  @OneToMany(() => ApplicationFollowUpEntity, (followUp) => followUp.adminUser)
  followUps?: Relation<ApplicationFollowUpEntity[]>;

  @OneToMany(() => OperationLogEntity, (log) => log.adminUser)
  operationLogs?: Relation<OperationLogEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "admin_roles" })
export class AdminRoleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 80 })
  code!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  description!: string;

  @Column({ type: "varchar", length: 20, default: "assigned" })
  dataScope!: AdminDataScope;

  @Column({ type: "boolean", default: true })
  isSystem!: boolean;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @OneToMany(() => AdminUserRoleEntity, (relation) => relation.role)
  userRelations?: Relation<AdminUserRoleEntity[]>;

  @OneToMany(() => AdminRolePermissionEntity, (relation) => relation.role)
  permissionRelations?: Relation<AdminRolePermissionEntity[]>;

  @OneToMany(() => AdminRoleMenuEntity, (relation) => relation.role)
  menuRelations?: Relation<AdminRoleMenuEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "admin_permissions" })
export class AdminPermissionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 120 })
  code!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 80 })
  groupName!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  description!: string;

  @Column({ type: "boolean", default: true })
  isSystem!: boolean;

  @OneToMany(() => AdminRolePermissionEntity, (relation) => relation.permission)
  roleRelations?: Relation<AdminRolePermissionEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "admin_menus" })
export class AdminMenuEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: true })
  parentId!: number | null;

  @ManyToOne(() => AdminMenuEntity, (menu) => menu.children, { onDelete: "CASCADE" })
  @JoinColumn({ name: "parentId" })
  parent?: Relation<AdminMenuEntity>;

  @OneToMany(() => AdminMenuEntity, (menu) => menu.parent)
  children?: Relation<AdminMenuEntity[]>;

  @Column({ type: "varchar", length: 20, default: "menu" })
  menuType!: AdminMenuType;

  @Column({ type: "varchar", length: 120 })
  title!: string;

  @Column({ type: "varchar", length: 120, default: "" })
  icon!: string;

  @Column({ type: "varchar", length: 160, default: "" })
  path!: string;

  @Column({ type: "varchar", length: 120, default: "" })
  routeName!: string;

  @Column({ type: "varchar", length: 120, default: "" })
  permissionCode!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @Column({ type: "boolean", default: true })
  isVisible!: boolean;

  @Column({ type: "boolean", default: true })
  isEnabled!: boolean;

  @OneToMany(() => AdminRoleMenuEntity, (relation) => relation.menu)
  roleRelations?: Relation<AdminRoleMenuEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "admin_user_roles" })
@Index(["adminUserId", "roleId"], { unique: true })
export class AdminUserRoleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  adminUserId!: number;

  @Column({ type: "int" })
  roleId!: number;

  @ManyToOne(() => AdminUserEntity, (adminUser) => adminUser.roleRelations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "adminUserId" })
  adminUser!: Relation<AdminUserEntity>;

  @ManyToOne(() => AdminRoleEntity, (role) => role.userRelations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "roleId" })
  role!: Relation<AdminRoleEntity>;
}

@Entity({ name: "admin_role_permissions" })
@Index(["roleId", "permissionId"], { unique: true })
export class AdminRolePermissionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  roleId!: number;

  @Column({ type: "int" })
  permissionId!: number;

  @ManyToOne(() => AdminRoleEntity, (role) => role.permissionRelations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "roleId" })
  role!: Relation<AdminRoleEntity>;

  @ManyToOne(() => AdminPermissionEntity, (permission) => permission.roleRelations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "permissionId" })
  permission!: Relation<AdminPermissionEntity>;
}

@Entity({ name: "admin_role_menus" })
@Index(["roleId", "menuId"], { unique: true })
export class AdminRoleMenuEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  roleId!: number;

  @Column({ type: "int" })
  menuId!: number;

  @ManyToOne(() => AdminRoleEntity, (role) => role.menuRelations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "roleId" })
  role!: Relation<AdminRoleEntity>;

  @ManyToOne(() => AdminMenuEntity, (menu) => menu.roleRelations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "menuId" })
  menu!: Relation<AdminMenuEntity>;
}

@Entity({ name: "universities" })
export class UniversityEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 120 })
  slug!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 50 })
  code!: string;

  @Column({ type: "json" })
  name!: LocalizedText;

  @Column({ type: "varchar", length: 50 })
  shortName!: string;

  @Column({ type: "varchar", length: 255 })
  logoUrl!: string;

  @Column({ type: "varchar", length: 255 })
  imageUrl!: string;

  @Column({ type: "varchar", length: 20, default: "#6C47FF" })
  color!: string;

  @Column({ type: "int" })
  qsRank!: number;

  @Column({ type: "int", nullable: true })
  qsAsiaRank!: number | null;

  @Column({ type: "json" })
  location!: LocalizedText;

  @Column({ type: "json" })
  region!: LocalizedText;

  @Column({ type: "varchar", length: 20 })
  ownership!: InstitutionOwnership;

  @Column({ type: "varchar", length: 20 })
  institutionType!: InstitutionType;

  @Column({ type: "int" })
  foundedYear!: number;

  @Column({ type: "int", default: 0 })
  students!: number;

  @Column({ type: "int", default: 0 })
  intlStudents!: number;

  @Column({ type: "boolean", default: false })
  csrCertified!: boolean;

  @Column({ type: "json" })
  description!: LocalizedText;

  @Column({ type: "varchar", length: 255 })
  website!: string;

  @Column({ type: "varchar", length: 255 })
  admissionEmail!: string;

  @Column({ type: "varchar", length: 255, default: "" })
  nameEnOfficial!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  officialWebsite!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  studyPortalUrl!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  internationalPageUrl!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  applicationPortalUrl!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  officialAddress!: string;

  @Column({ type: "json", nullable: true })
  applicationPeriods!: string[] | null;

  @Column({ type: "json", nullable: true })
  applicationFees!: string[] | null;

  @Column({ type: "json", nullable: true })
  applicationDocuments!: LocalizedStringArray | null;

  @Column({ type: "json", nullable: true })
  chinaStudentRequirements!: LocalizedStringArray | null;

  @Column({ type: "json", nullable: true })
  officialProfile!: Record<string, unknown> | null;

  @Column({ type: "json", nullable: true })
  officialSources!: OfficialSourceLink[] | null;

  @Column({ type: "date", nullable: true })
  officialVerifiedAt!: string | null;

  @Column({ type: "varchar", length: 80, default: "needs-review" })
  officialSourceStatus!: OfficialSourceStatus;

  @Column({ type: "text", nullable: true })
  officialAuditSummary!: string | null;

  @Column({ type: "varchar", length: 80, default: "ready" })
  publicDisplayStatus!: PublicDisplayStatus;

  @Column({ type: "text", nullable: true })
  livingCostOfficialNote!: string | null;

  @Column({ type: "int" })
  tuitionMinCny!: number;

  @Column({ type: "int" })
  tuitionMaxCny!: number;

  @Column({ type: "int" })
  livingCostCny!: number;

  @Column({ type: "decimal", precision: 3, scale: 1, default: 5.5 })
  minIelts!: number;

  @Column({ type: "boolean", default: false })
  acceptNoLanguage!: boolean;

  @Column({ type: "json" })
  facilities!: LocalizedStringArray;

  @Column({ type: "json" })
  highlights!: LocalizedStringArray;

  @Column({ type: "int", default: 0 })
  programCount!: number;

  @Column({ type: "boolean", default: true })
  isPublished!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ProgramEntity, (program) => program.university, { cascade: false })
  programs?: Relation<ProgramEntity[]>;

  @OneToMany(() => StudentApplicationEntity, (application) => application.university)
  applications?: Relation<StudentApplicationEntity[]>;
}

@Entity({ name: "programs" })
export class ProgramEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  universityId!: number;

  @ManyToOne(() => UniversityEntity, (university) => university.programs, { onDelete: "CASCADE" })
  @JoinColumn({ name: "universityId" })
  university!: Relation<UniversityEntity>;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 120 })
  slug!: string;

  @Column({ type: "varchar", length: 50 })
  code!: string;

  @Column({ type: "json" })
  name!: LocalizedText;

  @Column({ type: "varchar", length: 255, default: "" })
  nameEnOfficial!: string;

  @Column({ type: "varchar", length: 20 })
  level!: DegreeLevel;

  @Column({ type: "varchar", length: 80 })
  category!: ProgramCategoryCode;

  @Column({ type: "json" })
  faculty!: LocalizedText;

  @Column({ type: "varchar", length: 255, default: "" })
  facultyZh!: string;

  @Column({ type: "varchar", length: 80, default: "" })
  studyMode!: string;

  @Column({ type: "varchar", length: 120, default: "" })
  campus!: string;

  @Column({ type: "decimal", precision: 4, scale: 1 })
  durationYears!: number;

  @Column({ type: "varchar", length: 500, default: "" })
  durationOfficial!: string;

  @Column({ type: "int" })
  annualTuitionCny!: number;

  @Column({ type: "int", nullable: true })
  tuitionAmount!: number | null;

  @Column({ type: "varchar", length: 20, default: "CNY" })
  tuitionCurrency!: TuitionCurrency;

  @Column({ type: "varchar", length: 255, default: "" })
  tuitionDisplay!: string;

  @Column({ type: "int", nullable: true })
  officialTuitionMYR!: number | null;

  @Column({ type: "text", nullable: true })
  officialTuitionNote!: string | null;

  @Column({ type: "varchar", length: 500, default: "" })
  officialFeeSourceUrl!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  secondaryOfficialFeeSourceUrl!: string;

  @Column({ type: "varchar", length: 80, default: "pending-review" })
  officialFeeAuditStatus!: FeeAuditStatus;

  @Column({ type: "date", nullable: true })
  officialFeeAuditedAt!: string | null;

  @Column({ type: "json" })
  intakeMonths!: string[];

  @Column({ type: "varchar", length: 255, default: "" })
  officialIntake!: string;

  @Column({ type: "text", nullable: true })
  officialIntakeNote!: string | null;

  @Column({ type: "json" })
  languageRequirement!: LanguageRequirement;

  @Column({ type: "text", nullable: true })
  officialLanguageRequirement!: string | null;

  @Column({ type: "json" })
  requirement!: ProgramRequirement;

  @Column({ type: "text", nullable: true })
  officialAcademicRequirement!: string | null;

  @Column({ type: "text", nullable: true })
  chinaStudentRequirement!: string | null;

  @Column({ type: "text", nullable: true })
  specialRequirementsNote!: string | null;

  @Column({ type: "json" })
  applicationDocs!: LocalizedStringArray;

  @Column({ type: "json" })
  curriculum!: LocalizedStringArray;

  @Column({ type: "json" })
  careers!: LocalizedStringArray;

  @Column({ type: "json" })
  specializations!: LocalizedStringArray;

  @Column({ type: "json" })
  description!: LocalizedText;

  @Column({ type: "text", nullable: true })
  officialAccreditationNote!: string | null;

  @Column({ type: "varchar", length: 500, default: "" })
  officialSourceUrl!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  officialEntryRequirementSourceUrl!: string;

  @Column({ type: "varchar", length: 500, default: "" })
  officialAccreditationSourceUrl!: string;

  @Column({ type: "json", nullable: true })
  sourceUrls!: OfficialSourceLink[] | null;

  @Column({ type: "date", nullable: true })
  officialVerifiedAt!: string | null;

  @Column({ type: "varchar", length: 80, default: "needs-review" })
  officialSourceStatus!: OfficialSourceStatus;

  @Column({ type: "varchar", length: 80, default: "ready" })
  publicDisplayStatus!: PublicDisplayStatus;

  @Column({ type: "text", nullable: true })
  publicDisplayNote!: string | null;

  @Column({ type: "text", nullable: true })
  reviewReason!: string | null;

  @Column({ type: "text", nullable: true })
  auditNote!: string | null;

  @Column({ type: "varchar", length: 255, default: "" })
  listTuitionText!: string;

  @Column({ type: "boolean", default: true })
  isPublished!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => StudentApplicationEntity, (application) => application.program)
  applications?: Relation<StudentApplicationEntity[]>;
}

@Entity({ name: "planner_profiles" })
export class PlannerProfileEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "int" })
  userId!: number;

  @OneToOne(() => UserEntity, (user) => user.profile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<UserEntity>;

  @Column({ type: "varchar", length: 20, default: "master" })
  level!: DegreeLevel;

  @Column({ type: "varchar", length: 80, default: "it" })
  targetCategory!: ProgramCategory;

  @Column({ type: "int", default: 80000 })
  budgetCny!: number;

  @Column({ type: "decimal", precision: 3, scale: 2, default: 3.0 })
  gpa!: number;

  @Column({ type: "decimal", precision: 3, scale: 1, default: 5.5 })
  ielts!: number;

  @Column({ type: "varchar", length: 60, default: "0-1 years" })
  experience!: string;

  @Column({ type: "boolean", default: true })
  acceptNoLanguage!: boolean;

  @Column({ type: "int", default: 1 })
  profileVersion!: number;

  @Column({ type: "varchar", length: 30, default: "incomplete" })
  completenessStatus!: PlannerProfileCompletenessStatus;

  @Column({ type: "json", nullable: true })
  requiredProfileFields!: RecommendationRequiredProfileFieldKey[] | null;

  @Column({ type: "json", nullable: true })
  missingProfileFields!: RecommendationRequiredProfileFieldKey[] | null;

  @Column({ type: "varchar", length: 128, default: "" })
  profileSnapshotHash!: string;

  @Column({ type: "datetime", nullable: true })
  profileCompletedAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  recommendationRefreshedAt!: Date | null;

  @Column({ type: "json" })
  materialProgress!: Record<string, MaterialStatus>;

  @Column({ type: "json" })
  visaChecklist!: PlannerVisaChecklist;

  @OneToMany(() => RecommendationRunEntity, (run) => run.profile)
  recommendationRuns?: Relation<RecommendationRunEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "recommendation_runs" })
@Index(["userId", "profileVersion"])
@Index(["userId", "status"])
@Index(["cacheKey"])
export class RecommendationRunEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, (user) => user.recommendationRuns, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<UserEntity>;

  @Column({ type: "int" })
  profileId!: number;

  @ManyToOne(() => PlannerProfileEntity, (profile) => profile.recommendationRuns, { onDelete: "CASCADE" })
  @JoinColumn({ name: "profileId" })
  profile!: Relation<PlannerProfileEntity>;

  @Column({ type: "int", default: 1 })
  profileVersion!: number;

  @Column({ type: "varchar", length: 30, default: "blocked-profile-incomplete" })
  status!: RecommendationRunStatus;

  @Column({ type: "varchar", length: 128, default: "" })
  cacheKey!: string;

  @Column({ type: "json", nullable: true })
  profileSnapshot!: RecommendationProfileSnapshot | null;

  @Column({ type: "json", nullable: true })
  requiredProfileFields!: RecommendationRequiredProfileFieldKey[] | null;

  @Column({ type: "json", nullable: true })
  missingProfileFields!: RecommendationRequiredProfileFieldKey[] | null;

  @Column({ type: "json", nullable: true })
  results!: RecommendationResultSnapshot[] | null;

  @Column({ type: "int", default: 0 })
  resultCount!: number;

  @Column({ type: "datetime", nullable: true })
  generatedAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "text", nullable: true })
  auditNote!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "favorites" })
@Index(["userId", "favoriteType", "targetId"], { unique: true })
export class FavoriteEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, (user) => user.favorites, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<UserEntity>;

  @Column({ type: "varchar", length: 20 })
  favoriteType!: "university" | "program";

  @Column({ type: "int" })
  targetId!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity({ name: "compare_items" })
@Index(["userId", "universityId"], { unique: true })
export class CompareItemEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, (user) => user.compareItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<UserEntity>;

  @Column({ type: "int" })
  universityId!: number;

  @ManyToOne(() => UniversityEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "universityId" })
  university!: Relation<UniversityEntity>;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity({ name: "planner_tasks" })
@Unique(["userId", "universityId", "programId"])
export class PlannerTaskEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, (user) => user.plannerTasks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<UserEntity>;

  @Column({ type: "int" })
  universityId!: number;

  @ManyToOne(() => UniversityEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "universityId" })
  university!: Relation<UniversityEntity>;

  @Column({ type: "int" })
  programId!: number;

  @ManyToOne(() => ProgramEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "programId" })
  program!: Relation<ProgramEntity>;

  @Column({ type: "json" })
  tier!: LocalizedText;

  @Column({ type: "varchar", length: 30, default: "draft" })
  stage!: ApplicationStage;

  @Column({ type: "int", default: 18 })
  progress!: number;

  @Column({ type: "json" })
  deadlineNote!: LocalizedText;

  @Column({ type: "json" })
  nextAction!: LocalizedText;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "content_blocks" })
export class ContentBlockEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 60 })
  key!: string;

  @Column({ type: "json" })
  title!: LocalizedText;

  @Column({ type: "json" })
  body!: LocalizedText;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "student_applications" })
export class StudentApplicationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 40 })
  applicationNo!: string;

  @Column({ type: "int" })
  studentId!: number;

  @ManyToOne(() => UserEntity, (user) => user.applications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "studentId" })
  student!: Relation<UserEntity>;

  @Column({ type: "varchar", length: 120 })
  studentName!: string;

  @Column({ type: "varchar", length: 190 })
  studentEmail!: string;

  @Column({ type: "varchar", length: 40, default: "" })
  studentPhone!: string;

  @Column({ type: "int" })
  universityId!: number;

  @ManyToOne(() => UniversityEntity, (university) => university.applications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "universityId" })
  university!: Relation<UniversityEntity>;

  @Column({ type: "int" })
  programId!: number;

  @ManyToOne(() => ProgramEntity, (program) => program.applications, { onDelete: "CASCADE" })
  @JoinColumn({ name: "programId" })
  program!: Relation<ProgramEntity>;

  @Column({ type: "varchar", length: 30, default: "draft" })
  applicationStatus!: ApplicationStatus;

  @Column({ type: "varchar", length: 30, default: "draft" })
  currentStage!: ApplicationStage;

  @Column({ type: "varchar", length: 30, default: "draft" })
  materialStatus!: MaterialStatus;

  @Column({ type: "varchar", length: 30, default: "not-started" })
  visaStatus!: VisaStatus;

  @Column({ type: "varchar", length: 20, default: "medium" })
  priority!: "low" | "medium" | "high";

  @Column({ type: "varchar", length: 60, default: "" })
  intake!: string;

  @Column({ type: "int", nullable: true })
  ownerAdminId!: number | null;

  @ManyToOne(() => AdminUserEntity, (adminUser) => adminUser.ownedApplications, { onDelete: "SET NULL" })
  @JoinColumn({ name: "ownerAdminId" })
  ownerAdmin?: Relation<AdminUserEntity>;

  @Column({ type: "int", nullable: true })
  assignedAdminId!: number | null;

  @ManyToOne(() => AdminUserEntity, (adminUser) => adminUser.assignedApplications, { onDelete: "SET NULL" })
  @JoinColumn({ name: "assignedAdminId" })
  assignedAdmin?: Relation<AdminUserEntity>;

  @Column({ type: "date", nullable: true })
  submittedAt!: string | null;

  @Column({ type: "date", nullable: true })
  expectedDecisionDate!: string | null;

  @Column({ type: "datetime", nullable: true })
  lastFollowUpAt!: Date | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "json", nullable: true })
  metadata!: Record<string, unknown> | null;

  @OneToMany(() => ApplicationFollowUpEntity, (followUp) => followUp.application)
  followUps?: Relation<ApplicationFollowUpEntity[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "application_follow_ups" })
export class ApplicationFollowUpEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  applicationId!: number;

  @ManyToOne(() => StudentApplicationEntity, (application) => application.followUps, { onDelete: "CASCADE" })
  @JoinColumn({ name: "applicationId" })
  application!: Relation<StudentApplicationEntity>;

  @Column({ type: "int" })
  adminUserId!: number;

  @ManyToOne(() => AdminUserEntity, (adminUser) => adminUser.followUps, { onDelete: "CASCADE" })
  @JoinColumn({ name: "adminUserId" })
  adminUser!: Relation<AdminUserEntity>;

  @Column({ type: "varchar", length: 20, default: "note" })
  followUpType!: FollowUpType;

  @Column({ type: "varchar", length: 30, nullable: true })
  statusFrom!: string | null;

  @Column({ type: "varchar", length: 30, nullable: true })
  statusTo!: string | null;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "text", nullable: true })
  nextStep!: string | null;

  @Column({ type: "datetime", nullable: true })
  nextFollowUpAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity({ name: "system_configs" })
@Index(["category", "configKey"], { unique: true })
export class SystemConfigEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 60 })
  category!: string;

  @Column({ type: "varchar", length: 80 })
  configKey!: string;

  @Column({ type: "varchar", length: 120 })
  label!: string;

  @Column({ type: "text" })
  value!: string;

  @Column({ type: "varchar", length: 255, default: "" })
  description!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @Column({ type: "boolean", default: false })
  isPublic!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "dictionary_items" })
@Index(["dictType", "code"], { unique: true })
export class DictionaryItemEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 60 })
  dictType!: string;

  @Column({ type: "varchar", length: 80 })
  code!: string;

  @Column({ type: "varchar", length: 120 })
  label!: string;

  @Column({ type: "varchar", length: 20, default: "enabled" })
  status!: "enabled" | "disabled";

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @Column({ type: "json", nullable: true })
  extra!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity({ name: "operation_logs" })
export class OperationLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: true })
  adminUserId!: number | null;

  @ManyToOne(() => AdminUserEntity, (adminUser) => adminUser.operationLogs, { onDelete: "SET NULL" })
  @JoinColumn({ name: "adminUserId" })
  adminUser?: Relation<AdminUserEntity>;

  @Column({ type: "varchar", length: 60 })
  module!: string;

  @Column({ type: "varchar", length: 60 })
  action!: string;

  @Column({ type: "varchar", length: 60 })
  targetType!: string;

  @Column({ type: "varchar", length: 60, default: "" })
  targetId!: string;

  @Column({ type: "varchar", length: 255 })
  summary!: string;

  @Column({ type: "json", nullable: true })
  detail!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 60, default: "" })
  ip!: string;

  @Column({ type: "varchar", length: 255, default: "" })
  userAgent!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

export const ALL_ENTITIES = [
  UserEntity,
  AdminUserEntity,
  AdminRoleEntity,
  AdminPermissionEntity,
  AdminMenuEntity,
  AdminUserRoleEntity,
  AdminRolePermissionEntity,
  AdminRoleMenuEntity,
  UniversityEntity,
  ProgramEntity,
  PlannerProfileEntity,
  RecommendationRunEntity,
  FavoriteEntity,
  CompareItemEntity,
  PlannerTaskEntity,
  ContentBlockEntity,
  StudentApplicationEntity,
  ApplicationFollowUpEntity,
  SystemConfigEntity,
  DictionaryItemEntity,
  OperationLogEntity
] as const;
