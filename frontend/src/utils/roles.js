export function isAdmin(role) {
  return role === "ADMIN";
}

export function isCoordinator(role) {
  return role === "COORDENADOR";
}

export function isReviewer(role) {
  return role === "AUTOR" || role === "REVISOR";
}

export function displayRole(role) {
  if (role === "AUTOR") {
    return "REVISOR";
  }
  return role;
}

export function canAccessPainel(role) {
  return isReviewer(role) || isAdmin(role);
}

export function canAccessSolicitacoes(role) {
  return isReviewer(role) || isCoordinator(role) || isAdmin(role);
}

export function canAccessAdminUsers(role) {
  return isAdmin(role);
}
