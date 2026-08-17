'use strict';

const ROLE_PERMISSIONS = {
  Admin: {
    chat: true,
    history: true,
    metrics: true,
    kb_visibility: ['public', 'employee', 'admin'],
  },
  Employee: {
    chat: true,
    history: true,
    metrics: false,
    kb_visibility: ['public', 'employee'],
  },
  Guest: {
    chat: true,
    history: false,
    metrics: false,
    kb_visibility: ['public'],
  },
};

function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || null;
}

function canAccessMetrics(role) {
  const perms = getPermissions(role);
  return Boolean(perms && perms.metrics);
}

function canAccessHistory(role) {
  const perms = getPermissions(role);
  return Boolean(perms && perms.history);
}

function allowedKbVisibility(role) {
  const perms = getPermissions(role);
  return perms ? perms.kb_visibility : [];
}

function canAccessDoc(role, visibility) {
  return allowedKbVisibility(role).includes(visibility);
}

module.exports = {
  ROLE_PERMISSIONS,
  getPermissions,
  canAccessMetrics,
  canAccessHistory,
  allowedKbVisibility,
  canAccessDoc,
};
