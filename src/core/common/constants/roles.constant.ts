/**
 * User roles for multi-tenant application
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CLIENT = 'client',
  VENDOR = 'vendor',
  GUEST = 'guest',
}

/**
 * System permissions for fine-grained access control
 */
export enum Permission {
  // Admin permissions
  MANAGE_USERS = 'manage_users',
  VIEW_ALL_USERS = 'view_all_users',
  DELETE_USERS = 'delete_users',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_SYSTEM = 'manage_system',

  // Client permissions
  CREATE_ORDER = 'create_order',
  VIEW_OWN_ORDERS = 'view_own_orders',
  CANCEL_ORDER = 'cancel_order',
  MAKE_PAYMENT = 'make_payment',
  VIEW_PAYMENT_HISTORY = 'view_payment_history',

  // Vendor permissions
  MANAGE_PRODUCTS = 'manage_products',
  CREATE_PRODUCT = 'create_product',
  UPDATE_PRODUCT = 'update_product',
  DELETE_PRODUCT = 'delete_product',
  VIEW_SALES = 'view_sales',
  MANAGE_INVENTORY = 'manage_inventory',
  VIEW_VENDOR_ANALYTICS = 'view_vendor_analytics',

  // Shared permissions
  UPDATE_PROFILE = 'update_profile',
  VIEW_PROFILE = 'view_profile',
  VIEW_NOTIFICATIONS = 'view_notifications',
  MANAGE_NOTIFICATIONS = 'manage_notifications',
}

/**
 * Map roles to their default permissions
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Admin permissions
    Permission.MANAGE_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.DELETE_USERS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_SYSTEM,

    // Client permissions (can do everything)
    Permission.CREATE_ORDER,
    Permission.VIEW_OWN_ORDERS,
    Permission.CANCEL_ORDER,
    Permission.MAKE_PAYMENT,
    Permission.VIEW_PAYMENT_HISTORY,

    // Vendor permissions (can do everything)
    Permission.MANAGE_PRODUCTS,
    Permission.CREATE_PRODUCT,
    Permission.UPDATE_PRODUCT,
    Permission.DELETE_PRODUCT,
    Permission.VIEW_SALES,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_VENDOR_ANALYTICS,

    // Shared permissions
    Permission.UPDATE_PROFILE,
    Permission.VIEW_PROFILE,
    Permission.VIEW_NOTIFICATIONS,
    Permission.MANAGE_NOTIFICATIONS,
  ],

  [UserRole.ADMIN]: [
    Permission.VIEW_ALL_USERS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_SETTINGS,
    Permission.UPDATE_PROFILE,
    Permission.VIEW_PROFILE,
    Permission.VIEW_NOTIFICATIONS,
    Permission.MANAGE_NOTIFICATIONS,
  ],

  [UserRole.CLIENT]: [
    Permission.CREATE_ORDER,
    Permission.VIEW_OWN_ORDERS,
    Permission.CANCEL_ORDER,
    Permission.MAKE_PAYMENT,
    Permission.VIEW_PAYMENT_HISTORY,
    Permission.UPDATE_PROFILE,
    Permission.VIEW_PROFILE,
    Permission.VIEW_NOTIFICATIONS,
  ],

  [UserRole.VENDOR]: [
    Permission.MANAGE_PRODUCTS,
    Permission.CREATE_PRODUCT,
    Permission.UPDATE_PRODUCT,
    Permission.DELETE_PRODUCT,
    Permission.VIEW_SALES,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_VENDOR_ANALYTICS,
    Permission.UPDATE_PROFILE,
    Permission.VIEW_PROFILE,
    Permission.VIEW_NOTIFICATIONS,
  ],

  [UserRole.GUEST]: [Permission.VIEW_PROFILE],
};

/**
 * Get permissions for a specific role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all permissions for multiple roles
 */
export function getPermissionsForRoles(roles: UserRole[]): Permission[] {
  const permissions = new Set<Permission>();

  roles.forEach((role) => {
    const rolePermissions = getPermissionsForRole(role);
    rolePermissions.forEach((permission) => permissions.add(permission));
  });

  return Array.from(permissions);
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}
