import { getDocumentFormOptions, getDocumentVersions, getDocuments } from "./api";

export async function fetchWorkflowItems() {
  const [docs, options] = await Promise.all([
    getDocuments(),
    getDocumentFormOptions().catch((requestError) => {
      if (requestError?.status === 401) {
        throw requestError;
      }
      return { companies: [], sectors: [] };
    }),
  ]);

  const companyById = new Map(
    (options?.companies || []).map((company) => [Number(company.id), company.name]),
  );
  const sectorById = new Map(
    (options?.sectors || []).map((sector) => [Number(sector.id), sector.name]),
  );

  const items = await Promise.all(
    (docs || []).map(async (doc) => {
      const versions = await getDocumentVersions(doc.id);
      const latestVersion = versions?.[0] ?? null;
      return {
        ...doc,
        companyName: companyById.get(Number(doc.company_id)) || `ID ${doc.company_id}`,
        sectorName: sectorById.get(Number(doc.sector_id)) || `ID ${doc.sector_id}`,
        versions: versions || [],
        latestVersion,
        latestStatus: latestVersion?.status || "SEM_VERSAO",
      };
    }),
  );
  return items;
}

export function summarizeWorkflow(items) {
  const summary = {
    total: items.length,
    semVersao: 0,
    rascunho: 0,
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
