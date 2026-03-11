import { getDocumentVersions, getDocuments } from "./api";

export async function fetchWorkflowItems() {
  const docs = await getDocuments();
  const items = await Promise.all(
    (docs || []).map(async (doc) => {
      const versions = await getDocumentVersions(doc.id);
      const latestVersion = versions?.[0] ?? null;
      return {
        ...doc,
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
    emRevisao: 0,
    vigente: 0,
    obsoleto: 0,
  };

  items.forEach((item) => {
    switch (item.latestStatus) {
      case "RASCUNHO":
        summary.rascunho += 1;
        break;
      case "EM_REVISAO":
        summary.emRevisao += 1;
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
