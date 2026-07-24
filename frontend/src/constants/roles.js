// User roles in the Audela Washing system.
// Uses constants instead of typing strings directly to avoid typos.
export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
}

// List of all roles (useful for checking/validation).
export const ALL_ROLES = Object.values(ROLES)
