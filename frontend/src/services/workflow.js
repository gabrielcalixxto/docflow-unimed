import { getWorkflowDocuments } from "./api";

export async function fetchWorkflowItems() {
  const response = await getWorkflowDocuments({ page: 1, page_size: 500 });
  const items = Array.isArray(response?.items) ? response.items : [];

  return items.map((item) => {
    const versions = Array.isArray(item.versions) ? item.versions : [];
    const latestVersion = versions[0] ?? null;
    return {
      ...item,
      companyName: item.company_name || `ID ${item.company_id}`,
      sectorName: item.sector_name || `ID ${item.sector_id}`,
      versions,
      latestVersion,
      latestStatus: item.latest_status || latestVersion?.status || "SEM_VERSAO",
    };
  });
}

export function summarizeWorkflow(items) {
  const summary = {
    total: items.length,
    semVersao: 0,
    rascunho: 0,
    rascunhoRevisado: 0,
    revisarRascunho: 0,
    pendenteCoordenacao: 0,
    emRevisao: 0,
    reprovado: 0,
    vigente: 0,
    obsoleto: 0,
  };

  items.forEach((item) => {
    switch (item.latestStatus) {
      case "RASCUNHO":
        summary.rascunho += 1;
        break;
      case "RASCUNHO_REVISADO":
        summary.rascunhoRevisado += 1;
        break;
      case "REVISAR_RASCUNHO":
        summary.revisarRascunho += 1;
        break;
      case "PENDENTE_COORDENACAO":
        summary.pendenteCoordenacao += 1;
        break;
      case "EM_REVISAO":
        summary.emRevisao += 1;
        break;
      case "REPROVADO":
        summary.reprovado += 1;
        break;
      case "VIGENTE":
        summary.vigente += 1;
        break;
      case "OBSOLETO":
        summary.obsoleto += 1;
        break;
      default:
        summary.semVersao += 1;
        break;
    }
  });

  return summary;
}
