const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  RASCUNHO_REVISADO: "Rascunho revisado",
  REVISAR_RASCUNHO: "Revisar rascunho",
  PENDENTE_COORDENACAO: "Pendente coordenacao",
  PENDENTE_QUALIDADE: "Pendente qualidade",
  EM_REVISAO: "Em revisao",
  REPROVADO: "Reprovado",
  VIGENTE: "Vigente",
  OBSOLETO: "Obsoleto",
  SEM_VERSAO: "Sem versao",
};

export function formatStatusLabel(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!normalized) {
    return "-";
  }
  return STATUS_LABELS[normalized] || normalized.replaceAll("_", " ");
}
