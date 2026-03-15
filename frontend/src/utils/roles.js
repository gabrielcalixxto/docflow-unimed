function toRoleList(roleOrRoles) {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.filter((value) => typeof value === "string");
  }
  if (typeof roleOrRoles === "string") {
    return [roleOrRoles];
  }
  return [];
}

function hasRole(roleOrRoles, roleToCheck) {
  return toRoleList(roleOrRoles).includes(roleToCheck);
}

export function isAdmin(roleOrRoles) {
  return hasRole(roleOrRoles, "ADMIN");
}

export function isCoordinator(roleOrRoles) {
  return hasRole(roleOrRoles, "COORDENADOR");
}

export function isReader(roleOrRoles) {
  return hasRole(roleOrRoles, "LEITOR");
}

export function isAuthor(roleOrRoles) {
  return hasRole(roleOrRoles, "AUTOR");
}

export function isReviewer(roleOrRoles) {
  return hasRole(roleOrRoles, "REVISOR");
}

export function displayRole(roleOrRoles) {
  const mapped = toRoleList(roleOrRoles).map(
    (role) =>
      ({
        ADMIN: "ADMIN",
        COORDENADOR: "COORDENADOR",
        REVISOR: "REVISOR",
        AUTOR: "AUTOR",
        LEITOR: "LEITOR",
      }[role] || role),
  );
  if (mapped.length === 0) {
    return "-";
  }
  return mapped.join(", ");
}

export function canAccessSearch(roleOrRoles) {
  return true;
}

export function canAccessNovoDocumento(roleOrRoles) {
  return isAuthor(roleOrRoles) || isReviewer(roleOrRoles) || isCoordinator(roleOrRoles);
}

export function canAccessHistoricoSolicitacoes(roleOrRoles) {
  return isAuthor(roleOrRoles) || isReviewer(roleOrRoles) || isCoordinator(roleOrRoles);
}

export function canAccessCentralAprovacao(roleOrRoles) {
  return isReviewer(roleOrRoles) || isCoordinator(roleOrRoles);
}

export function canAccessPainel(roleOrRoles) {
  return isReviewer(roleOrRoles);
}

export function canAccessAdminUsers(roleOrRoles) {
  return isAdmin(roleOrRoles);
}

export function canAccessAdminCatalog(roleOrRoles) {
  return isReviewer(roleOrRoles) || isAdmin(roleOrRoles);
}

export function canAccessSolicitacoesSection(roleOrRoles) {
  return canAccessNovoDocumento(roleOrRoles) || canAccessHistoricoSolicitacoes(roleOrRoles);
}
