/**
 * Fixed catalogue of admin page/action permissions.
 *
 * The values are stored as plain strings in StaffPermissionGrant so adding a
 * permission never requires a database migration. Unknown strings are ignored
 * when grants are loaded, which makes old grants harmless after a rename.
 */
export const ADMIN_PERMISSION_VALUES = [
  "dashboard.view",
  "members.view",
  "members.manage",
  "orders.view",
  "orders.manage",
  "products.view",
  "products.manage",
  "categories.view",
  "categories.manage",
  "investments.view",
  "investments.review",
  "distributions.view",
  "distributions.post",
  "affiliateCommissions.view",
  "roiCommission.view",
  "roiCommission.manage",
  "ranks.view",
  "ranks.manage",
  "salary.view",
  "salary.manage",
  "withdrawals.view",
  "withdrawals.manage",
  "topUps.view",
  "topUps.manage",
  "settings.view",
  "settings.manage",
  "content.view",
  "content.manage",
  "audit.view",
  "staff.view",
  "staff.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSION_VALUES)[number];

/** Every admin-like user can see the panel home, even with no explicit grants. */
export const BASELINE_PERMISSIONS = ["dashboard.view"] as const;

const PERMISSION_SET: ReadonlySet<string> = new Set(ADMIN_PERMISSION_VALUES);
const BASELINE_SET: ReadonlySet<string> = new Set(BASELINE_PERMISSIONS);

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && PERMISSION_SET.has(value);
}

export function isBaselinePermission(value: AdminPermission): boolean {
  return BASELINE_SET.has(value);
}

/** Normalizes untrusted permission input and discards baseline/unknown values. */
export function parseAssignedPermissions(input: readonly unknown[]): AdminPermission[] {
  const result = new Set<AdminPermission>();
  for (const value of input) {
    if (!isAdminPermission(value) || isBaselinePermission(value)) continue;
    result.add(value);
  }
  return [...result];
}

export type PermissionEntry = {
  readonly value: AdminPermission;
  readonly labelKey: string;
  readonly alwaysOn?: boolean;
};

export type PermissionGroup = {
  readonly id: string;
  readonly labelKey: string;
  readonly permissions: readonly PermissionEntry[];
};

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    id: "overview",
    labelKey: "permissionGroupOverview",
    permissions: [{ value: "dashboard.view", labelKey: "permissionDashboardView", alwaysOn: true }],
  },
  {
    id: "operations",
    labelKey: "permissionGroupOperations",
    permissions: [
      { value: "members.view", labelKey: "permissionMembersView" },
      { value: "members.manage", labelKey: "permissionMembersManage" },
      { value: "orders.view", labelKey: "permissionOrdersView" },
      { value: "orders.manage", labelKey: "permissionOrdersManage" },
      { value: "products.view", labelKey: "permissionProductsView" },
      { value: "products.manage", labelKey: "permissionProductsManage" },
      { value: "categories.view", labelKey: "permissionCategoriesView" },
      { value: "categories.manage", labelKey: "permissionCategoriesManage" },
    ],
  },
  {
    id: "rewards",
    labelKey: "permissionGroupRewards",
    permissions: [
      { value: "investments.view", labelKey: "permissionInvestmentsView" },
      { value: "investments.review", labelKey: "permissionInvestmentsReview" },
      { value: "distributions.view", labelKey: "permissionDistributionsView" },
      { value: "distributions.post", labelKey: "permissionDistributionsPost" },
      { value: "affiliateCommissions.view", labelKey: "permissionAffiliateCommissionsView" },
      { value: "roiCommission.view", labelKey: "permissionRoiView" },
      { value: "roiCommission.manage", labelKey: "permissionRoiManage" },
      { value: "ranks.view", labelKey: "permissionRanksView" },
      { value: "ranks.manage", labelKey: "permissionRanksManage" },
      { value: "salary.view", labelKey: "permissionSalaryView" },
      { value: "salary.manage", labelKey: "permissionSalaryManage" },
    ],
  },
  {
    id: "money",
    labelKey: "permissionGroupMoney",
    permissions: [
      { value: "withdrawals.view", labelKey: "permissionWithdrawalsView" },
      { value: "withdrawals.manage", labelKey: "permissionWithdrawalsManage" },
      { value: "topUps.view", labelKey: "permissionTopUpsView" },
      { value: "topUps.manage", labelKey: "permissionTopUpsManage" },
    ],
  },
  {
    id: "content",
    labelKey: "permissionGroupContent",
    permissions: [
      { value: "settings.view", labelKey: "permissionSettingsView" },
      { value: "settings.manage", labelKey: "permissionSettingsManage" },
      { value: "content.view", labelKey: "permissionContentView" },
      { value: "content.manage", labelKey: "permissionContentManage" },
    ],
  },
  {
    id: "system",
    labelKey: "permissionGroupSystem",
    permissions: [
      { value: "audit.view", labelKey: "permissionAuditView" },
      { value: "staff.view", labelKey: "permissionStaffView" },
      { value: "staff.manage", labelKey: "permissionStaffManage" },
    ],
  },
];

export const ADMIN_PERMISSION_KEYS = {
  dashboardView: "permissionDashboardView",
  membersView: "permissionMembersView",
  membersManage: "permissionMembersManage",
  ordersView: "permissionOrdersView",
  ordersManage: "permissionOrdersManage",
  productsView: "permissionProductsView",
  productsManage: "permissionProductsManage",
  categoriesView: "permissionCategoriesView",
  categoriesManage: "permissionCategoriesManage",
  investmentsView: "permissionInvestmentsView",
  investmentsReview: "permissionInvestmentsReview",
  distributionsView: "permissionDistributionsView",
  distributionsPost: "permissionDistributionsPost",
  affiliateCommissionsView: "permissionAffiliateCommissionsView",
  roiView: "permissionRoiView",
  roiManage: "permissionRoiManage",
  ranksView: "permissionRanksView",
  ranksManage: "permissionRanksManage",
  salaryView: "permissionSalaryView",
  salaryManage: "permissionSalaryManage",
  withdrawalsView: "permissionWithdrawalsView",
  withdrawalsManage: "permissionWithdrawalsManage",
  topUpsView: "permissionTopUpsView",
  topUpsManage: "permissionTopUpsManage",
  settingsView: "permissionSettingsView",
  settingsManage: "permissionSettingsManage",
  contentView: "permissionContentView",
  contentManage: "permissionContentManage",
  auditView: "permissionAuditView",
  staffView: "permissionStaffView",
  staffManage: "permissionStaffManage",
} as const;
