export function isAdmin(role) {
  return role === "ADMIN";
}

export function isCoordinator(role) {
  return role === "COORDENADOR";
}

export function isReader(role) {
  return role === "LEITOR";
}

export function isAuthor(role) {
  return role === "AUTOR";
}

export function isReviewer(role) {
  return role === "REVISOR";
}

export function displayRole(role) {
  return (
    {
      ADMIN: "ADMIN",
      COORDENADOR: "COORDENADOR",
      REVISOR: "REVISOR",
      AUTOR: "AUTOR",
      LEITOR: "LEITOR",
    }[role] || role
  );
}

export function canAccessSearch(role) {
  return !isAdmin(role);
}

export function canAccessNovoDocumento(role) {
  return isAuthor(role) || isReviewer(role) || isCoordinator(role);
}

export function canAccessAtualizarDocumento(role) {
  return isAuthor(role) || isReviewer(role) || isCoordinator(role);
}

export function canAccessHistoricoSolicitacoes(role) {
  return isAuthor(role) || isReviewer(role) || isCoordinator(role);
}

export function canAccessCentralAprovacao(role) {
  return isReviewer(role) || isCoordinator(role);
}

export function canAccessPainel(role) {
  return isReviewer(role);
}

export function canAccessAdminUsers(role) {
  return isAdmin(role);
}

export function canAccessAdminCatalog(role) {
  return isReviewer(role) || isAdmin(role);
}

export function canAccessSolicitacoesSection(role) {
  return (
    canAccessNovoDocumento(role) ||
    canAccessAtualizarDocumento(role) ||
    canAccessHistoricoSolicitacoes(role)
  );
}
