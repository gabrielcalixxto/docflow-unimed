const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  RASCUNHO_REVISADO: "Rascunho revisado",
  REVISAR_RASCUNHO: "Pendente Ajuste",
  PENDENTE_COORDENACAO: "Pendente coordenacao",
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
