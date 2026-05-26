// core/permissions.js
export class PermissionManager {
  constructor(plan) {
    this.plan = plan;
    this.rules = {
      esencial: {
        max_businesses: 1,
        max_professionals: 3,
        invoicing: true,
        public_booking: true,
        advanced_reports: false,
        inventory: false,
      },
      pro: {
        max_businesses: 3,
        max_professionals: 10,
        invoicing: true,
        public_booking: true,
        advanced_reports: true,
        inventory: false,
      },
      max: {
        max_businesses: Infinity,
        max_professionals: Infinity,
        invoicing: true,
        public_booking: true,
        advanced_reports: true,
        inventory: true,  // futuro
      }
    };
  }

  can(feature) {
    return this.rules[this.plan]?.[feature] ?? false;
  }

  limit(resource) {
    return this.rules[this.plan]?.[resource] ?? 0;
  }
}
