export const dashboardMetrics = [
  {
    label: "Documentos vigentes",
    value: "42",
    kicker: "protegidos",
    detail: "A busca principal ja respeita a regra de listar somente conteudo aprovado e vigente.",
    tone: "green",
  },
  {
    label: "Fila de revisao",
    value: "07",
    kicker: "coordenacao",
    detail: "Painel executivo mostra o que esta aguardando decisao sem contaminar a busca do leitor.",
    tone: "orange",
  },
  {
    label: "Setores monitorados",
    value: "04",
    kicker: "abrangencia",
    detail: "Nutricao, Enfermagem, Qualidade e Administrativo no mesmo recorte operacional.",
    tone: "citrus",
  },
  {
    label: "Documentos locais",
    value: "18",
    kicker: "segregacao",
    detail: "Materiais locais permanecem restritos ao setor responsavel e perfis autorizados.",
    tone: "dark",
  },
];

export const workflowHighlights = [
  {
    kicker: "Ciclo de vida",
    title: "Rascunho > Em revisao > Vigente > Obsoleto",
    description: "A interface mostra a regra, mas a busca operacional permanece protegida em VIGENTE.",
    value: "4 estados",
  },
  {
    kicker: "Versionamento",
    title: "Uma unica versao ativa por documento",
    description: "O painel lateral deixa claro qual versao esta vigente e quais ja foram obsoletadas.",
    value: "1 vigente",
  },
];

export const mockDocuments = [
  {
    id: "doc-001",
    code: "POP-QD-014",
    title: "Controle de higienizacao de equipamentos assistenciais",
    company: "Hospital Unimed",
    sector: "Qualidade",
    documentType: "POP",
    scope: "LOCAL",
    status: "VIGENTE",
    summary:
      "Padroniza a higienizacao de equipamentos criticos, define checklist de liberacao e consolida pontos de auditoria para inspecoes internas.",
    expirationDateLabel: "18 Nov 2026",
    createdBy: "Camila Souza",
    createdRole: "Autora responsavel - Qualidade",
    approvedBy: "Rafaela Costa",
    approvalCoordination: "Coordenacao de Qualidade",
    currentVersionLabel: "v3.0",
    versions: [
      {
        label: "v3.0",
        status: "VIGENTE",
        dateLabel: "12 Jan 2026",
        owner: "Camila Souza",
        note: "Atualizacao do fluxo de liberacao e padrao de assinatura.",
      },
      {
        label: "v2.0",
        status: "OBSOLETO",
        dateLabel: "03 Ago 2025",
        owner: "Camila Souza",
        note: "Versao substituida apos aprovacao da coordenacao.",
      },
      {
        label: "v1.0",
        status: "OBSOLETO",
        dateLabel: "15 Mar 2025",
        owner: "Camila Souza",
        note: "Emissao inicial do procedimento.",
      },
    ],
    audit: [
      { type: "approved", label: "Aprovado", user: "Rafaela Costa", at: "12 Jan 2026 - 14:22" },
      { type: "submitted", label: "Submetido para revisao", user: "Camila Souza", at: "10 Jan 2026 - 09:18" },
      { type: "version", label: "Nova versao criada", user: "Camila Souza", at: "07 Jan 2026 - 08:40" },
      { type: "viewed", label: "Visualizado pela equipe", user: "Leitores do setor", at: "Hoje - 07:50" },
    ],
    pages: [
      {
        pageNumber: 1,
        section: "Capa",
        title: "Procedimento operacional padrao",
        summary: "Controle documental para higienizacao de equipamentos assistenciais e liberacao segura para uso clinico.",
        highlights: [
          { label: "Escopo", value: "Local - Qualidade e apoio tecnico ao centro assistencial." },
          { label: "Aplicacao", value: "Equipamentos reutilizaveis classificados como criticos e semicriticos." },
          { label: "Controle", value: "Distribuicao local, copia controlada e revalidacao anual." },
          { label: "Compliance", value: "Registro obrigatorio de aprovacao, vencimento e consulta." },
        ],
        sections: [
          {
            kicker: "Objetivo",
            heading: "Padronizar a higienizacao e a liberacao",
            badge: "Obrigatorio",
            items: [
              "Definir a sequencia de limpeza, desinfeccao e checagem funcional.",
              "Estabelecer rastreabilidade por lote, data e profissional executor.",
              "Evitar reutilizacao sem conferencia de integridade e liberacao.",
            ],
          },
          {
            kicker: "Taxonomia",
            heading: "Identificacao do documento controlado",
            badge: "MVP",
            items: [
              "Setor: Qualidade.",
              "Tipo documental: POP.",
              "Data de vencimento: 18 Nov 2026.",
            ],
          },
        ],
      },
      {
        pageNumber: 2,
        section: "Responsabilidades",
        title: "Alcadas, checklist e aceite operacional",
        summary: "Pagina voltada a responsabilidades de autor, coordenacao e leitor durante o ciclo documental.",
        highlights: [
          { label: "Autor", value: "Monta rascunho, atualiza conteudo e envia para revisao." },
          { label: "Coordenacao", value: "Valida a aderencia tecnica e promove o documento para vigente." },
          { label: "Leitor", value: "Acessa somente o documento vigente permitido pelo escopo." },
          { label: "Auditoria", value: "Cada evento relevante gera registro imutavel." },
        ],
        sections: [
          {
            kicker: "Checklist",
            heading: "Verificacoes antes da liberacao",
            badge: "Aprovacao",
            items: [
              "Conferencia da versao, codigo e setor responsavel.",
              "Validacao do prazo de vencimento e anexos obrigatorios.",
              "Registro nominal de quem elaborou e quem aprovou.",
            ],
          },
          {
            kicker: "Risco",
            heading: "Pontos criticos de uso",
            badge: "Controle",
            items: [
              "Nao utilizar versoes obsoletas impressas sem carimbo de controle.",
              "Nao substituir arquivos vigentes em lote sem gerar nova versao.",
              "Rejeicoes retornam o documento para rascunho com justificativa.",
            ],
          },
        ],
      },
      {
        pageNumber: 3,
        section: "Registros",
        title: "Anexos, registros e evidencias",
        summary: "Consolida registros minimos e destinos de arquivamento para inspecoes e auditorias.",
        highlights: [
          { label: "Anexos", value: "Checklist de limpeza, relatorio de liberacao e termo de conformidade." },
          { label: "Arquivo", value: "Repositorio interno com historico de versoes e trilha de eventos." },
          { label: "Retencao", value: "Prazo minimo de guarda alinhado ao procedimento matriz." },
          { label: "Disponibilidade", value: "Leitura imediata no portal e copia PDF controlada." },
        ],
        sections: [
          {
            kicker: "Auditoria",
            heading: "Eventos obrigatorios do fluxo",
            badge: "Log",
            items: [
              "Criacao do documento e das novas versoes.",
              "Mudancas de status, aprovacao e obsolescencia.",
              "Visualizacao do documento vigente pelos perfis permitidos.",
            ],
          },
          {
            kicker: "Distribuicao",
            heading: "Politica de acesso ao PDF",
            badge: "Visibilidade",
            items: [
              "Busca padrao sempre resolve para a versao vigente.",
              "Historico de versoes fica em contexto administrativo.",
              "Escopo local bloqueia setores nao relacionados.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "doc-002",
    code: "IT-ENF-022",
    title: "Administracao segura de antibioticos de alto risco",
    company: "Operadora Unimed",
    sector: "Enfermagem",
    documentType: "Instrucao de trabalho",
    scope: "CORPORATIVO",
    status: "VIGENTE",
    summary:
      "Consolida parametros de preparo, dupla checagem e monitoramento de eventos adversos para antimicrobianos de alta vigilancia.",
    expirationDateLabel: "04 Fev 2027",
    createdBy: "Luciana Prado",
    createdRole: "Autora responsavel - Enfermagem",
    approvedBy: "Tiago Mendes",
    approvalCoordination: "Coordenacao Assistencial",
    currentVersionLabel: "v4.1",
    versions: [
      {
        label: "v4.1",
        status: "VIGENTE",
        dateLabel: "04 Fev 2026",
        owner: "Luciana Prado",
        note: "Ajuste da tabela de diluicao e monitoramento clinico.",
      },
      {
        label: "v4.0",
        status: "OBSOLETO",
        dateLabel: "22 Mai 2025",
        owner: "Luciana Prado",
        note: "Consolidacao do checklist de dupla checagem.",
      },
    ],
    audit: [
      { type: "approved", label: "Aprovado", user: "Tiago Mendes", at: "04 Fev 2026 - 10:15" },
      { type: "submitted", label: "Submetido para revisao", user: "Luciana Prado", at: "02 Fev 2026 - 16:07" },
      { type: "viewed", label: "Visualizado pela assistencia", user: "Equipe assistencial", at: "Hoje - 06:32" },
    ],
    pages: [
      {
        pageNumber: 1,
        section: "Capa",
        title: "Instrucao de trabalho assistencial",
        summary: "Fluxo de preparo, validacao e administracao segura de antibioticos classificados como alto risco.",
        highlights: [
          { label: "Escopo", value: "Corporativo - Enfermagem e farmacia clinica." },
          { label: "Aplicacao", value: "Unidades assistenciais com infusao e monitoramento continuo." },
          { label: "Controle", value: "Consulta liberada para toda a rede autorizada." },
          { label: "Compliance", value: "Checagem dupla e leitura do documento vigente antes do uso." },
        ],
        sections: [
          {
            kicker: "Objetivo",
            heading: "Garantir administracao com barreiras de seguranca",
            badge: "Assistencial",
            items: [
              "Padronizar preparo e identificacao antes da administracao.",
              "Reduzir erro de dose e incompatibilidade medicamentosa.",
              "Registrar ocorrencias e condutas no prontuario e no evento.",
            ],
          },
          {
            kicker: "Taxonomia",
            heading: "Identificacao minima obrigatoria",
            badge: "MVP",
            items: [
              "Setor: Enfermagem.",
              "Tipo documental: Instrucao de trabalho.",
              "Data de vencimento: 04 Fev 2027.",
            ],
          },
        ],
      },
      {
        pageNumber: 2,
        section: "Fluxo",
        title: "Sequencia operacional para preparo e administracao",
        summary: "Pagina dedicada aos pontos de checagem e registros criticos.",
        highlights: [
          { label: "Prescricao", value: "Validar dose, via e horario antes do preparo." },
          { label: "Farmacia", value: "Confirmar compatibilidade e estabilidade da solucao." },
          { label: "Leito", value: "Checagem dupla a beira leito com identificacao positiva." },
          { label: "Registro", value: "Documentar hora, lote e intercorrencias." },
        ],
        sections: [
          {
            kicker: "Execucao",
            heading: "Pontos de atencao do processo",
            badge: "Check",
            items: [
              "Usar checklist de preparo e bomba de infusao quando aplicavel.",
              "Confirmar alergias e parametros clinicos do paciente.",
              "Suspender administracao e escalar anomalias para a coordenacao.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "doc-003",
    code: "MAP-NT-005",
    title: "Mapa de distribuicao enteral por unidade assistencial",
    company: "Crescer Bem",
    sector: "Nutricao",
    documentType: "Mapa de processo",
    scope: "LOCAL",
    status: "VIGENTE",
    summary:
      "Apresenta o circuito de preparo, segregacao, transporte e entrega de dietas enterais por unidade assistencial e horarios criticos.",
    expirationDateLabel: "30 Set 2026",
    createdBy: "Paula Viana",
    createdRole: "Autora responsavel - Nutricao",
    approvedBy: "Mariana Goulart",
    approvalCoordination: "Coordenacao de Nutricao",
    currentVersionLabel: "v2.2",
    versions: [
      {
        label: "v2.2",
        status: "VIGENTE",
        dateLabel: "30 Set 2025",
        owner: "Paula Viana",
        note: "Revisao de janelas de distribuicao e check de temperatura.",
      },
      {
        label: "v2.1",
        status: "OBSOLETO",
        dateLabel: "18 Abr 2025",
        owner: "Paula Viana",
        note: "Versao anterior arquivada automaticamente.",
      },
    ],
    audit: [
      { type: "approved", label: "Aprovado", user: "Mariana Goulart", at: "30 Set 2025 - 11:05" },
      { type: "submitted", label: "Submetido para revisao", user: "Paula Viana", at: "28 Set 2025 - 15:21" },
      { type: "viewed", label: "Visualizado pelo setor", user: "Equipe de nutricao", at: "Hoje - 08:14" },
    ],
    pages: [
      {
        pageNumber: 1,
        section: "Mapa",
        title: "Fluxo visual de distribuicao enteral",
        summary: "Pagina principal com horarios de producao, rota de entrega e pontos de checagem termica.",
        highlights: [
          { label: "Escopo", value: "Local - Nutricao clinica e apoio logistico." },
          { label: "Aplicacao", value: "Unidades de internacao, UTI e observacao." },
          { label: "Controle", value: "Distribuicao local e monitoramento por turno." },
          { label: "Compliance", value: "Leitura do mapa vigente antes da expedicao." },
        ],
        sections: [
          {
            kicker: "Fluxo",
            heading: "Da producao a entrega final",
            badge: "Mapa",
            items: [
              "Separacao por unidade assistencial e horario de entrega.",
              "Checagem de temperatura no momento da saida e da entrega.",
              "Registro de nao conformidade quando houver atraso ou troca.",
            ],
          },
          {
            kicker: "Taxonomia",
            heading: "Classificacao do documento",
            badge: "MVP",
            items: [
              "Setor: Nutricao.",
              "Tipo documental: Mapa de processo.",
              "Data de vencimento: 30 Set 2026.",
            ],
          },
        ],
      },
      {
        pageNumber: 2,
        section: "Controles",
        title: "Rastreabilidade de entrega e devolucao",
        summary: "Pagina com checkpoints de retorno, ajuste e descarte.",
        highlights: [
          { label: "Entrega", value: "Assinatura de recebimento por unidade assistencial." },
          { label: "Devolucao", value: "Registro de sobra, avaria ou recusa." },
          { label: "Descarte", value: "Tratativa conforme procedimento matriz de residuos." },
          { label: "Historico", value: "Versoes antigas disponiveis apenas em contexto administrativo." },
        ],
        sections: [
          {
            kicker: "Risco",
            heading: "Nao conformidades acompanhadas",
            badge: "Monitoramento",
            items: [
              "Atraso de rota acima da tolerancia prevista.",
              "Troca de unidade, dieta ou paciente.",
              "Falha de acondicionamento durante o transporte.",
            ],
          },
        ],
      },
    ],
  },
];
