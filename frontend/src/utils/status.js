const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  REVISAR_RASCUNHO: "Revisar rascunho",
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

