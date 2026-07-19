const ROLES = {
  AGENT_JUNIOR: {
    id: "AGENT_JUNIOR",
    label: "Agent Junior",
    category: "Agents",
    level: 1,
    hasAdminPerms: false,
  },
  AGENT: {
    id: "AGENT",
    label: "Agent",
    category: "Agents",
    level: 2,
    hasAdminPerms: false,
  },
  AGENT_EXPERIENCED: {
    id: "AGENT_EXPERIENCED",
    label: "Agent Expérimenté",
    category: "Agents",
    level: 3,
    hasAdminPerms: false,
  },
  STAGIAIRE: {
    id: "STAGIAIRE",
    label: "Stagiaire",
    category: "Encadrement",
    level: 3.5,
    hasAdminPerms: false,
  },
  SUPERVISEUR: {
    id: "SUPERVISEUR",
    label: "Superviseur",
    category: "Encadrement",
    level: 4,
    hasAdminPerms: true,
  },
  SECRETAIRE: {
    id: "SECRETAIRE",
    label: "Secrétaire",
    category: "Encadrement",
    level: 5,
    hasAdminPerms: true,
  },
  MANAGER: {
    id: "MANAGER",
    label: "Manager",
    category: "Encadrement",
    level: 5.5,
    hasAdminPerms: true,
    isSectorRestricted: true,
  },
  CO_FONDATEUR: {
    id: "CO_FONDATEUR",
    label: "Co-fondateur",
    category: "Direction",
    level: 6,
    hasAdminPerms: true,
  },
  PDG: {
    id: "PDG",
    label: "PDG",
    category: "Direction",
    level: 7,
    hasAdminPerms: true,
  },
  ADMIN: {
    id: "ADMIN",
    label: "Administrateur Système",
    category: "Direction",
    level: 8,
    hasAdminPerms: true,
  },
};

const ROLES_WITH_ADMIN_PERMS = Object.values(ROLES)
  .filter((r) => r.hasAdminPerms)
  .map((r) => r.id);

const TOP_ADMIN_ROLES = ["CO_FONDATEUR", "PDG", "ADMIN"];

function getRole(roleId) {
  return ROLES[roleId];
}

function getRoleLabel(roleId) {
  return ROLES[roleId]?.label || roleId;
}

function hasAdminPerms(roleId) {
  return ROLES_WITH_ADMIN_PERMS.includes(roleId);
}

function isTopAdmin(roleId) {
  return TOP_ADMIN_ROLES.includes(roleId);
}

function getRoleLevel(roleId) {
  return ROLES[roleId]?.level || 0;
}

module.exports = {
  ROLES,
  ROLES_WITH_ADMIN_PERMS,
  TOP_ADMIN_ROLES,
  getRole,
  getRoleLabel,
  hasAdminPerms,
  isTopAdmin,
  getRoleLevel,
};
