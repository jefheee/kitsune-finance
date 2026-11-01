# **Arquitetura de Alta Densidade e Engenharia de Software Financeiro: Relatório de Benchmarking, Motores Determinísticos e Expansão para o Kitsune Finance**

O desenvolvimento de plataformas de gestão financeira pessoal (PFM) e inteligência patrimonial no Brasil impõe desafios severos de engenharia. O ecossistema financeiro nacional combina particularidades tributárias e regulatórias — tais como a convenção de dias úteis bancários (DU/252), a tabela regressiva do Imposto de Renda, a tabela decrescente de IOF e as normas do Conselho Monetário Nacional (CMN) para o Custo Efetivo Total (CET) — com uma infraestrutura de agregação bancária aberta governada pelo Banco Central do Brasil (Open Finance Brasil)1. Concomitantemente, o compromisso operacional do Kitsune Finance com o modelo de **Custo Zero Rígido (Free Tier perpétuo)** impõe restrições severas de infraestrutura5.  
A operação sustentada sobre o plano Vercel Hobby (limite de 10 segundos por invocação serverless e limites de largura de banda), Supabase Free Tier (500 MB de armazenamento em disco no PostgreSQL, poolers de conexão limitados e pausa de instâncias inativas) e cotas gratuitas da API Google Gemini (limitações de requisições e tokens por minuto) exige uma reformulação arquitetural profunda7. Para eliminar os gargalos da nuvem, a computação pesada, a resolução de dados e a auditoria matemática devem migrar prioritariamente para o cliente por meio de uma arquitetura *Local-First* orientada a IndexedDB e Web Workers, mantendo o backend como um livro-razão (*ledger*) de sincronização assíncrona eventual7.

## **Benchmarking Especializado de Repositórios Open-Source Globais e Nacionais**

O ecossistema global de código aberto dispõe de soluções maduras de PFM que enfrentaram e resolveram problemas fundamentais de integridade transacional, conciliação de faturas, desempenho em listas extensas e modelagem contábil. A análise a seguir disseca projetos selecionados e estabelece os pontos de contato imediatos com o código-fonte do Kitsune Finance.

### **Actual Budget**

> 1. **Nome do Projeto e Link Direto:** Actual Budget (https\://github.com/actualbudget/actual)10.  
> 2. **Categoria e Modelo de Operação:** Sistema PFM Completo com metodologia de Orçamento Base Zero (*Zero-Based Budgeting*) e arquitetura *Local-First* sincronizada via CRDTs (*Conflict-Free Replicated Data Types*)10.  
> 3. **Stack Tecnológica:** TypeScript, Node.js, SQLite embarcado compilado para WebAssembly (WASM), React, pacotes de sincronização proprietários sob Licença MIT10.  
> 4. **Por que foi selecionado:** O Actual Budget resolve dois dos problemas mais críticos enfrentados por sistemas de finanças em produção: o tratamento de concorrência em interfaces reativas e a conciliação bancária entre registros pendentes e consolidados10. Seus padrões de *lock* transitório no cliente evitam que atualizações em lote vindas de sincronizações bancárias sobrescrevam edições manuais em andamento na tela do usuário10.  
> 5. **Funcionalidades e Ideias Criativas para Absorção Imediata:** O Actual Budget utiliza um sistema de regras condicionais encadeadas que executam no cliente no momento em que uma transação entra no sistema12. Essa lógica permite mapear padrões de texto e converter campos de maneira determinística antes que qualquer dado seja persistido12. Adicionalmente, o sistema lida com o ciclo de vida de transações pendentes de cartão de crédito que sofrem alterações de valor quando confirmadas pelo adquirente — como gorjetas ou flutuações cambiais —, unificando o identificador temporário ao identificador permanente sem duplicar o lançamento12.  
> 6. **Estratégia de Custo Zero (Free Tier Viability):** Toda a execução das regras de categorização e deduplicação pode rodar inteiramente no cliente via Web Workers antes de qualquer gravação no Supabase7. Ao filtrar e consolidar as transações no navegador, reduzem-se drasticamente os acessos de escrita à base de dados relacional e a largura de banda da Vercel, blindando a cota mensal gratuita do Supabase7.  
> 7. **Otimizações para Mobile e Desktop:** O Actual Budget utiliza listas virtualizadas combinadas com paginação direta sobre a base de dados local10. Para o Kitsune Finance, a implementação do @tanstack/react-virtual no extrato consolidado impede que a renderização de milhares de transações bloqueie o loop de eventos (*main thread*) de smartphones intermediários e básicos10.

### **Ghostfolio**

> 1. **Nome do Projeto e Link Direto:** Ghostfolio (https\://github.com/ghostfolio/ghostfolio)14.  
> 2. **Categoria e Modelo de Operação:** Plataforma de Gestão Patrimonial (*Wealth Management*) e Rastreador de Carteira Multiativos com foco em privacidade e análise de performance14.  
> 3. **Stack Tecnológica:** TypeScript, NestJS, Prisma ORM, PostgreSQL, Redis, Angular, arquitetura em Monorepo via Nx, distribuído sob Licença AGPL-3.014.  
> 4. **Por que foi selecionado:** Trata-se da referência aberta mais consistente no cálculo estrito de retornos sobre investimentos, separando formalmente a rentabilidade pura dos ativos dos aportes e retiradas operacionais15. O projeto soluciona a modelagem de ativos de rendimento periódico e depósitos a prazo fixo, algo indispensável para o tratamento da renda fixa no Brasil16.  
> 5. **Funcionalidades e Ideias Criativas para Absorção Imediata:** O Ghostfolio decompõe a rentabilidade em três eixos independentes: ganho de capital (*capital gains*), proventos periódicos (*dividends/interest*) e flutuações cambiais (*currency gains*)15. Sua implementação de Retorno Ponderado no Tempo (*Time-Weighted Return* \- TWR) e Retorno sobre o Investimento Médio (*Return on Average Investment* \- ROAI) permite auditar o desempenho real da carteira sem distorções causadas pelo tamanho ou momento de aportes extraordinários16. Apresenta ainda o *Zen Mode*, recurso visual de privacidade que mascara saldos brutos na interface e exibe apenas proporções percentuais14.  
> 6. **Estratégia de Custo Zero (Free Tier Viability):** Enquanto o Ghostfolio original requer instâncias persistentes de NestJS e servidores Redis para computar portfólios, as formulações de TWR e MWR podem ser transpostas para funções TypeScript puras executadas no cliente14. As séries temporais de cotações e taxas oficiais podem ser cacheadas no cliente, desonerando o banco relacional e eliminando servidores intermediários.  
> 7. **Otimizações para Mobile e Desktop:** O recálculo de curvas patrimoniais completas com milhares de nós históricos consome ciclos significativos de processamento14. Transferir a matemática de alocação para Web Workers impede quedas de taxa de quadros (jank) na interface gráfica durante a alternância de filtros temporais (1M, 6M, 1A, YTD, MAX)14.

### **Maybe Finance**

> 1. **Nome do Projeto e Link Direto:** Maybe (https\://github.com/maybe-finance/maybe)19.  
> 2. **Categoria e Modelo de Operação:** Sistema PFM e Rastreador de Patrimônio Líquido com foco em design de produto de alto padrão e visualização de balanço unificado19.  
> 3. **Stack Tecnológica:** Ruby on Rails, PostgreSQL, Hotwire/Turbo, Tailwind CSS, TypeScript, sob Licença AGPL-3.019.  
> 4. **Por que foi selecionado:** O Maybe construiu o padrão estético e de ergonomia visual mais refinado para ferramentas financeiras pessoais de código aberto19. Seu esquema de dados aborda o patrimônio líquido com precisão contábil através da equação unificada entre ativos tangíveis/intangíveis e passivos circulantes e de longo prazo19.  
> 5. **Funcionalidades e Ideias Criativas para Absorção Imediata:** O projeto destaca-se pela integração de diagramas de Sankey para demonstrar o destino exato de cada real que entra no orçamento doméstico, evidenciando as fatias consumidas por impostos, despesas fixas de moradia, compras discricionárias e investimentos de longo prazo19. Sua modelagem de passivos vincula débitos de cartão de crédito e amortizações de empréstimos diretamente ao cálculo de patrimônio líquido em tempo real19.  
> 6. **Estratégia de Custo Zero (Free Tier Viability):** A estrutura de banco de dados do Maybe baseia-se em agregações analíticas que podem ser convertidas em *Views* indexadas e funções de agregação leves no PostgreSQL do Supabase19. Ao realizar o agrupamento das transações do mês diretamente na camada de persistência via SQL puro, o tráfego de dados para o Next.js cai de megabytes para poucos kilobytes de payload JSON agregado.  
> 7. **Otimizações para Mobile e Desktop:** A visualização do fluxo de renda via diagrama de Sankey é tradicionalmente pesada se renderizada com bibliotecas genéricas baseadas em SVGs complexos19. A conversão desse componente para um elemento nativo em HTML5 Canvas, recalculado apenas quando houver alteração nas transações do mês, assegura renderização rápida mesmo em aparelhos móveis de entrada.

### **Firefly III**

> 1. **Nome do Projeto e Link Direto:** Firefly III (https\://github.com/firefly-iii/firefly-iii)23.  
> 2. **Categoria e Modelo de Operação:** Gerenciador Financeiro Pessoal autohospedado focado em auditoria contábil e metodologia estrita de partidas dobradas (*double-entry bookkeeping*)23.  
> 3. **Stack Tecnológica:** PHP, Laravel, MariaDB/PostgreSQL, Tailwind CSS, sob Licença AGPL-3.024.  
> 4. **Por que foi selecionado:** O Firefly III implementa o mecanismo de auditoria contábil mais rígido do universo open-source, eliminando incongruências clássicas de lançamentos23. Em sistemas simplificados, quando um usuário move dinheiro de sua conta corrente para a conta da corretora ou paga uma fatura de cartão de crédito, essas movimentações são erroneamente categorizadas como "despesa" em um lado e "receita" no outro, distorcendo o fluxo de caixa real23.  
> 5. **Funcionalidades e Ideias Criativas para Absorção Imediata:** A arquitetura do Firefly III utiliza transações de partidas dobradas onde cada lançamento contém obrigatoriamente uma conta de origem (*source*), uma conta de destino (*destination*) e o montante financeiro23. Ao pagar uma fatura de cartão de crédito, o saldo da conta corrente diminui, o passivo do cartão de crédito é amortizado e a despesa operacional permanece vinculada exclusivamente às compras individuais originárias23. Esse modelo também fornece rotinas de reconciliação de saldo com "contas fantasmas" de compensação transitória23.  
> 6. **Estratégia de Custo Zero (Free Tier Viability):** Em vez de manter o peso de um framework tradicional em servidores dedicados, a integridade das partidas dobradas pode ser assegurada diretamente por *triggers* em PL/pgSQL no Supabase7. Assim, ao inserir uma transação do tipo transferência, o banco executa atomicamente o débito e o crédito sob uma única transação ACID, sem custos computacionais externos.  
> 7. **Otimizações para Mobile e Desktop:** A busca e filtragem de grandes volumes de lançamentos do Firefly III utiliza índices compostos24. No Kitsune Finance, a aplicação de índices parciais no PostgreSQL (CREATE INDEX ... WHERE deleted\_at IS NULL) associada à paginação baseada em chaves ou cursores (cursor-based pagination) reduz o custo de leitura em disco e mantém a resposta das consultas abaixo de 20 milissegundos26.

### **Ecossistema Pluggy & Open Finance Tools**

> 1. **Nome do Projeto e Link Direto:** Pluggy Node SDK e Utilitários Comunitários (https\://github.com/pluggyai/pluggy-node e https\://github.com/icesnow10/personal-finance)26.  
> 2. **Categoria e Modelo de Operação:** SDKs Oficiais de Agregação Bancária e Conectores de Open Finance Brasil para Aplicações de Terminal e Automação6.  
> 3. **Stack Tecnológica:** TypeScript, Node.js, REST API, Webhooks, Model Context Protocol (MCP)26.  
> 4. **Por que foi selecionado:** O conector "Meu Pluggy" serve como o canal de ingestão bancária gratuita do Kitsune Finance6. Compreender os mecanismos internos e limitações do SDK oficial da Pluggy e de projetos periféricos evita quebras de conexão e garante a conformidade com as rotinas assíncronas do Open Finance26.  
> 5. **Funcionalidades e Ideias Criativas para Absorção Imediata:** O SDK oficial migrou definitivamente para o endpoint /v2/transactions, que implementa paginação estrita baseada em cursores (cursor-based pagination com os parâmetros after e results), tornando os métodos legados sujeitos a falhas e retorno 41026. No utilitário icesnow10/personal-finance, identifica-se uma solução para o tratamento de faturas fechadas: a ferramenta rastreia o evento de fechamento de ciclo do cartão de crédito, substitui os identificadores de cobranças pendentes pelos novos IDs permanentes postados e elimina as duplicatas geradas pela transição de estado da fatura bancária28.  
> 6. **Estratégia de Custo Zero (Free Tier Viability):** A recepção de webhooks de movimentações bancárias (item/updated, transactions/created) deve ser configurada para invocar *Route Handlers* serverless do Next.js de rápida finalização33. Para evitar o estouro dos limites de execução gratuita na Vercel (10 segundos), o webhook deve validar a assinatura de segurança em tempo constante, armazenar o payload cru em uma tabela de fila no Supabase com confirmação HTTP 200 imediata e delegar a conciliação semântica para execução em segundo plano ou no carregamento inicial do cliente34.  
> 7. **Otimizações para Mobile e Desktop:** O status da conexão Open Finance de cada instituição (Itaú, Nubank, Inter, Caixa) deve exibir um indicador visual de "frescor" dos dados (*freshness indicator*), informando há quantas horas o extrato foi sincronizado e permitindo que o usuário solicite atualizações manuais apenas quando o conector estiver ocioso13.

### **BrasilAPI e MinhaReceita SDKs**

> 1. **Nome do Projeto e Link Direto:** BrasilAPI SDK (https\://github.com/guhcostan/brasilapi-sdk) e MinhaReceita (https\://github.com/lenivene/minha-receita-api)36.  
> 2. **Categoria e Modelo de Operação:** Bibliotecas de Conexão com Microsserviços Públicos de Dados Governamentais e Fiscais Brasileiros36.  
> 3. **Stack Tecnológica:** TypeScript, Fetch nativo, empacotamento ESM/CJS, Licença MIT36.  
> 4. **Por que foi selecionado:** Os extratos bancários fornecidos via Open Finance rotineiramente trazem descrições truncadas ou códigos empresariais de credenciamento (ex: "CIELO*AUTO POSTO 123", "PAG*59274605000113", "MERCADOPAGO\*LOCADORA")38. A consulta a bases públicas de CNPJ transforma códigos fiscais em nomes comerciais amigáveis e identifica a Classificação Nacional de Atividades Econômicas (CNAE) da empresa37.  
> 5. **Funcionalidades e Ideias Criativas para Absorção Imediata:** Resolução de CNPJ em tempo de ingestão: extrai-se a sequência numérica de 14 dígitos presente no histórico da transferência Pix ou cartão e consulta-se a Razão Social, Nome Fantasia e CNAE Fiscal primário37. O código CNAE viabiliza a categorização temática primária com base na atividade oficial do recebedor (por exemplo, CNAE de alimentação, combustíveis ou serviços médicos) antes de qualquer intervenção de inteligência artificial37.  
> 6. **Estratégia de Custo Zero (Free Tier Viability):** As plataformas BrasilAPI e MinhaReceita são abertas e gratuitas, porém sujeitas a oscilações e limites de requisição por IP39. Para garantir viabilidade perpétua, o Kitsune Finance deve implementar um catálogo global comunitário em uma tabela pública no Supabase (known\_merchants). Sempre que um CNPJ for consultado com sucesso por qualquer usuário, o nome amigável e o CNAE correspondente ficam cacheados no banco de dados para consultas subsequentes de todos os usuários, reduzindo as chamadas externas para zero no médio prazo.  
> 7. **Otimizações para Mobile e Desktop:** Além do cache global, a aplicação deve manter um *Object Store* de estabelecimentos resolvidos no IndexedDB local do usuário7. Assim, a renderização de nomes limpos e logotipos nos lançamentos do extrato ocorre instantaneamente na interface sem bloquear a navegação7.

## **Motores de Cálculo Determinístico em TypeScript**

A integração de modelos de linguagem (LLMs) em sistemas financeiros acarreta o risco de aproximações ou erros de alucinação aritmética em cálculos de juros compostos, prazos úteis e obrigações tributárias. Para assegurar total precisão, o Kitsune Finance adota uma separação de arquitetura: **os modelos de IA atuam exclusivamente na interpretação de cenários e comunicação com o usuário, enquanto todos os cálculos matemáticos são executados por motores determinísticos em TypeScript**.  
As seções a seguir trazem as fórmulas oficiais e as implementações em código TypeScript prontas para produção, livres de dependências externas.

### **Curva DI e Acumulação Diária do CDI (Convenção DU/252)**

A precificação e o cálculo de rentabilidade de títulos de Renda Fixa pós-fixados indexados ao CDI (Certificados de Depósito Interbancário) seguem rigorosamente o Manual de Fórmulas e Cálculos da B3 e da ANBIMA3. O cálculo baseia-se no ano útil bancário nacional padronizado em 252 dias úteis3.  
O fator diário de acumulação da taxa DI em um determinado dia útil ![][image1] a partir da taxa anual divulgada ![][image2] é expresso por3:  
![][image3]  
Quando o contrato financeiro prevê remuneração baseada em um percentual ![][image4] (por exemplo, 115% do CDI implica ![][image5]), a taxa diária efetiva ponderada é dada por3:  
![][image6]  
O fator diário acumulado resultante (![][image7]) deve ser truncado na 16ª casa decimal, em conformidade com as normas operacionais da B3 e da CETIP42:  
![][image8]  
Para um intervalo composto por ![][image9] dias úteis decorridos, o Fator de Acumulação Composta Global (![][image10]) resulta da multiplicação sequencial de cada fator diário truncado, mantendo o truncamento na 16ª casa a cada dia subsequente3:  
![][image11]  
O Valor Nominal Atualizado bruto (![][image12]) partindo do capital inicial ![][image13] é truncado comercialmente em 8 casas durante o período de cálculo e exibido com arredondamento padrão de 2 casas decimais na liquidação3:  
![][image14]

TypeScript  
export interface CDIDailyObservation {  
  date: string; // Formato ISO YYYY-MM-DD  
  annualRate: number; // Ex: 10.65 para expressar 10,65% ao ano  
}

export class CDICalculationEngine {  
  private static readonly BASIS: number \= 252;

  /\*\*  
   \* Trunca o número estritamente na casa decimal informada sem arredondamento comercial  
   \*/  
  public static truncate(value: number, decimals: number): number {  
    const factor \= Math.pow(10, decimals);  
    return Math.trunc(value \* factor) / factor;  
  }

  /\*\*  
   \* Obtém o fator diário individual truncado em 16 casas decimais conforme padrão B3/Cetip  
   \*/  
  public static calculateDailyFactor(annualRate: number, cdiPercentage: number): number {  
    const baseFactor \= Math.pow(1 \+ annualRate / 100, 1 / this.BASIS) \- 1;  
    const adjustedRate \= baseFactor \* (cdiPercentage / 100);  
    return this.truncate(1 \+ adjustedRate, 16);  
  }

  /\*\*  
   \* Executa a acumulação do rendimento do título ao longo da série histórica de dias úteis  
   \*/  
  public static accumulateYield(  
    principal: number,  
    cdiPercentage: number,  
    dailyRates: CDIDailyObservation\[\]  
  ): { grossAmount: number; accumulatedFactor: number; grossYield: number } {  
    if (principal \<= 0) throw new Error('O principal investido deve ser maior que zero.');

    let accumulatedFactor \= 1.0;

    for (const item of dailyRates) {  
      const dailyFactor \= this.calculateDailyFactor(item.annualRate, cdiPercentage);  
      accumulatedFactor \= this.truncate(accumulatedFactor \* dailyFactor, 16);  
    }

    const grossAmountCalculated \= this.truncate(principal \* accumulatedFactor, 8);  
    const grossAmount \= Number(grossAmountCalculated.toFixed(2));  
    const grossYield \= Number((grossAmount \- principal).toFixed(2));

    return {  
      grossAmount,  
      accumulatedFactor,  
      grossYield: Math.max(0, grossYield)  
    };  
  }  
}

### **Tributação Regressiva de Renda Fixa e Tabela Decrescente de IOF**

A rentabilidade líquida de investimentos em títulos de renda fixa brasileira (CDBs, RDBs, Debêntures comuns e Fundos DI) está sujeita à incidência sucessiva de dois tributos federais: o Imposto sobre Operações Financeiras (IOF) e o Imposto de Renda Retido na Fonte (IRRF), regulamentados pelo Decreto Federal nº 6.306/2007 e pela Lei nº 11.033/20042.  
O IOF incide exclusivamente sobre os rendimentos brutos de aplicações resgatadas com prazo inferior a 30 dias corridos, obedecendo a uma tabela decrescente que zera a partir do 30º dia2. O Imposto de Renda incide sobre o rendimento bruto subtraído do montante de IOF devido2.  
![][image15]  
![][image16]

| Prazo Decorrido (Dias Corridos) | Alíquota de IRRF (%) | Enquadramento Legal |
| :---- | :---- | :---- |
| De 1 até 180 dias | 22,5% | Art. 1º, § 2º, Inciso I da Lei Federal 11.033/20042 |
| De 181 até 360 dias | 20,0% | Art. 1º, § 2º, Inciso II da Lei Federal 11.033/20042 |
| De 361 até 720 dias | 17,5% | Art. 1º, § 2º, Inciso III da Lei Federal 11.033/20042 |
| Igual ou superior a 721 dias | 15,0% | Art. 1º, § 2º, Inciso IV da Lei Federal 11.033/20042 |

TypeScript  
export class BrazilianTaxEngine {  
  // Tabela decrescente de alíquotas de IOF do 1º ao 29º dia corrido (Decreto 6.306/2007)  
  private static readonly IOF\_RATES\_BY\_DAY: readonly number\[\] \= \[  
    0.96, 0.93, 0.90, 0.86, 0.83, 0.80, 0.76, 0.73, 0.70, 0.66,  
    0.63, 0.60, 0.56, 0.53, 0.50, 0.46, 0.43, 0.40, 0.36, 0.33,  
    0.30, 0.26, 0.23, 0.20, 0.16, 0.13, 0.10, 0.06, 0.03  
  \];

  public static getIRRate(calendarDays: number): number {  
    if (calendarDays \<= 180) return 0.225;  
    if (calendarDays \<= 360) return 0.200;  
    if (calendarDays \<= 720) return 0.175;  
    return 0.150;  
  }

  public static getIOFRate(calendarDays: number): number {  
    if (calendarDays \< 1) return 0.96;  
    if (calendarDays \>= 30) return 0.0;  
    return this.IOF\_RATES\_BY\_DAY\[calendarDays \- 1\];  
  }

  public static computeTaxes(  
    principal: number,  
    grossAmount: number,  
    calendarDays: number,  
    isTaxExempt: boolean \= false  
  ): {  
    grossYield: number;  
    iofAmount: number;  
    irAmount: number;  
    netAmount: number;  
    effectiveNetReturnRate: number;  
  } {  
    const grossYield \= Math.max(0, Number((grossAmount \- principal).toFixed(2)));  
    if (grossYield \=== 0) {  
      return { grossYield: 0, iofAmount: 0, irAmount: 0, netAmount: principal, effectiveNetReturnRate: 0 };  
    }

    if (isTaxExempt) {  
      return {  
        grossYield,  
        iofAmount: 0,  
        irAmount: 0,  
        netAmount: grossAmount,  
        effectiveNetReturnRate: Number((((grossAmount \- principal) / principal) \* 100).toFixed(4))  
      };  
    }

    const iofRate \= this.getIOFRate(calendarDays);  
    const iofAmount \= Number((grossYield \* iofRate).toFixed(2));

    const taxableBase \= Math.max(0, grossYield \- iofAmount);  
    const irRate \= this.getIRRate(calendarDays);  
    const irAmount \= Number((taxableBase \* irRate).toFixed(2));

    const netAmount \= Number((grossAmount \- iofAmount \- irAmount).toFixed(2));  
    const effectiveNetReturnRate \= Number((((netAmount \- principal) / principal) \* 100).toFixed(4));

    return {  
      grossYield,  
      iofAmount,  
      irAmount,  
      netAmount,  
      effectiveNetReturnRate  
    };  
  }  
}

### **Rentabilidade Real e Equação de Irving Fisher**

No cenário macroeconômico brasileiro, no qual a inflação atinge patamares consideráveis, estimar o ganho real de uma carteira através da subtração direta entre a taxa nominal e o IPCA (![][image17]) produz distorções materiais45. O cálculo matematicamente correto fundamenta-se na Equação de Irving Fisher adaptada à dedução de alíquotas fiscais45:  
![][image18]  
Isolando a taxa de rendimento real líquido anualizado (![][image19])45:  
![][image20]  
Onde:

* ![][image21]: Taxa de juros nominal anualizada contratada (ex: Selic ou taxa prefixada)45.  
* ![][image22]: Alíquota de imposto de renda incidente sobre a operação (ex: 0,15 para prazo acima de 2 anos)2.  
* ![][image23]: Inflação oficial acumulada em 12 meses medida pelo IPCA ou projetada via Relatório Focus45.

TypeScript  
export class FisherRealReturnEngine {  
  /\*\*  
   \* Calcula a Taxa Real Líquida de juros utilizando a Equação de Fisher  
   \* @param nominalRatePercent Taxa de rentabilidade nominal ao ano (ex: 13.25 para 13,25% a.a.)  
   \* @param inflationRatePercent IPCA acumulado em 12 meses (ex: 4.80 para 4,80% a.a.)  
   \* @param irRatePercent Alíquota do imposto de renda (ex: 15 para 15% ou 0 para isentos)  
   \*/  
  public static calculateNetRealRate(  
    nominalRatePercent: number,  
    inflationRatePercent: number,  
    irRatePercent: number \= 0  
  ): number {  
    const iNominal \= nominalRatePercent / 100;  
    const iInflation \= inflationRatePercent / 100;  
    const ir \= irRatePercent / 100;

    const nominalNet \= iNominal \* (1 \- ir);  
    const realRate \= (1 \+ nominalNet) / (1 \+ iInflation) \- 1;

    return Number((realRate \* 100).toFixed(4));  
  }  
}

### **Detecção Matemática de Juros Rotativos e Custo Efetivo Total (CET)**

O Custo Efetivo Total (CET) expressa as condições financeiras reais de operações de crédito, financiamento e parcelamento de cartão de crédito no Brasil1. Regulamentado pela Resolução CMN nº 4.881/2020 do Banco Central do Brasil (que revogou expressamente a Resolução CMN nº 3.517/2007), o CET corresponde à taxa interna de desconto que iguala, na data da contratação, o valor liberado aos fluxos de desembolso futuro1:  
![][image24]  
Onde:

* ![][image13]: Montante financeiro total disponibilizado ou refinanciado no instante zero49.  
* ![][image25]: Valores desembolsados pelo consumidor em cada vencimento futuro ![][image26], compreendendo parcelas, juros de mora, IOF, seguros e tarifas de operação49.  
* ![][image27]: Quantidade de dias corridos transcorridos entre a data inicial da operação e a data do pagamento ![][image26]1.  
* ![][image28]: Taxa anual efetiva expressa em base percentual obtida através de resolução numérica (método de Newton-Raphson).

TypeScript  
export interface InstallmentPayment {  
  daysFromStart: number; // Intervalo de tempo tj em dias corridos  
  amount: number; // Valor da prestação Fj  
}

export class TotalEffectiveCostEngine {  
  /\*\*  
   \* Determina o CET Anualizado com convergência numérica via Newton-Raphson  
   \*/  
  public static calculateAnnualCET(  
    disbursedAmount: number,  
    payments: InstallmentPayment\[\],  
    precisionTolerance: number \= 1e-7,  
    maxIterations: number \= 100  
  ): number {  
    if (disbursedAmount \<= 0) throw new Error('O valor financiado deve ser estritamente positivo.');  
    if (payments.length \=== 0) throw new Error('O fluxo de desembolsos deve conter parcelas.');

    let rate \= 0.20; // Ponto inicial de iteração (chute de 20% a.a.)

    for (let iter \= 0; iter \< maxIterations; iter++) {  
      let npv \= \-disbursedAmount;  
      let derivativeNpv \= 0;

      for (const p of payments) {  
        const timeFraction \= p.daysFromStart / 365;  
        const discountFactor \= Math.pow(1 \+ rate, timeFraction);  
          
        npv \+= p.amount / discountFactor;  
        derivativeNpv \-= (timeFraction \* p.amount) / Math.pow(1 \+ rate, timeFraction \+ 1);  
      }

      if (Math.abs(derivativeNpv) \< 1e-12) {  
        throw new Error('Derivada numérica nula; não foi possível convergir o CET.');  
      }

      const step \= npv / derivativeNpv;  
      rate \= rate \- step;

      if (Math.abs(step) \< precisionTolerance) {  
        return Number((rate \* 100).toFixed(2));  
      }  
    }

    throw new Error('O algoritmo de Newton-Raphson atingiu o número máximo de iterações sem convergência.');  
  }

  /\*\*  
   \* Identifica cobranças automáticas de juros rotativos de faturas passadas  
   \*/  
  public static detectRevolvingInterest(  
    statementBalance: number,  
    previousStatementBalance: number,  
    previousPaymentMade: number  
  ): { enteredRevolving: boolean; rollOverAmount: number } {  
    const unpaidBalance \= previousStatementBalance \- previousPaymentMade;  
    const enteredRevolving \= unpaidBalance \> 0.01;  
    return {  
      enteredRevolving,  
      rollOverAmount: enteredRevolving ? Number(unpaidBalance.toFixed(2)) : 0  
    };  
  }  
}

### **Amortização Estruturada de Dívidas: Bola de Neve vs. Avalanche**

Para otimizar o fluxo de caixa de famílias endividadas, o módulo de passivos do Kitsune Finance integra um motor comparativo de amortização acelerada com suporte aos dois principais métodos comportamentais e matemáticos da literatura financeira50:

* **Método Bola de Neve (Debt Snowball):** As obrigações são ordenadas do menor para o maior saldo devedor (![][image29])51. Esse modelo prioriza a eliminação rápida do maior número de credores, gerando um ganho comportamental imediato para o usuário51.  
* **Método Avalanche (Debt Avalanche):** As dívidas são ordenadas da maior para a menor taxa de juros efetiva ou CET mensal (![][image30])51. Este método atinge a otimização matemática estrita, minimizando o volume absoluto de juros pagos ao longo do tempo51.

Em ambos os métodos, o usuário mantém o pagamento mínimo obrigatório em todas as contas e direciona a totalidade do orçamento excedente (*extra budget*) para o débito posicionado no topo da lista priorizada51.

TypeScript  
export interface DebtStructure {  
  id: string;  
  creditorName: string;  
  balance: number;  
  monthlyInterestRate: number; // Taxa mensal expressa em porcentagem (ex: 8.5 para rotativo)  
  minimumPayment: number;  
}

export interface AmortizationScheduleMonth {  
  month: number;  
  remainingTotalBalance: number;  
  monthlyInterestPaid: number;  
}

export interface PayoffSimulationOutput {  
  method: 'SNOWBALL' \| 'AVALANCHE';  
  totalMonthsToPayoff: number;  
  totalInterestPaid: number;  
  timeline: AmortizationScheduleMonth\[\];  
}

export class DebtAmortizationEngine {  
  public static runSimulation(  
    debts: DebtStructure\[\],  
    extraMonthlyBudget: number,  
    method: 'SNOWBALL' \| 'AVALANCHE'  
  ): PayoffSimulationOutput {  
    // Clonagem profunda dos objetos para cálculo imutável  
    let workingDebts \= debts.map(d \=\> ({ ...d }));  
    let totalInterestPaid \= 0;  
    let currentMonth \= 0;  
    const timeline: AmortizationScheduleMonth\[\] \= \[\];

    while (workingDebts.some(d \=\> d.balance \> 0) && currentMonth \< 360) {  
      currentMonth++;  
      let currentMonthInterest \= 0;

      // 1\. Apuração e aplicação de juros compostos sobre saldos abertos  
      for (const d of workingDebts) {  
        if (d.balance \> 0) {  
          const interest \= d.balance \* (d.monthlyInterestRate / 100);  
          d.balance \+= interest;  
          currentMonthInterest \+= interest;  
        }  
      }  
      totalInterestPaid \+= currentMonthInterest;

      // 2\. Liquidação das parcelas mínimas contratuais  
      let availableExtraCash \= extraMonthlyBudget;  
      for (const d of workingDebts) {  
        if (d.balance \> 0) {  
          const payment \= Math.min(d.balance, d.minimumPayment);  
          d.balance \-= payment;  
        }  
      }

      // 3\. Reordenação dinâmica com base no critério do método selecionado  
      if (method \=== 'SNOWBALL') {  
        // Menor saldo devedor primeiro  
        workingDebts.sort((a, b) \=\> a.balance \- b.balance);  
      } else {  
        // Maior taxa de juros primeiro  
        workingDebts.sort((a, b) \=\> b.monthlyInterestRate \- a.monthlyInterestRate);  
      }

      // 4\. Aplicação do capital extra concentrado no débito prioritário  
      for (const d of workingDebts) {  
        if (d.balance \> 0 && availableExtraCash \> 0) {  
          const payment \= Math.min(d.balance, availableExtraCash);  
          d.balance \-= payment;  
          availableExtraCash \-= payment;  
        }  
      }

      const totalRemaining \= workingDebts.reduce((sum, d) \=\> sum \+ Math.max(0, d.balance), 0);  
      timeline.push({  
        month: currentMonth,  
        remainingTotalBalance: Number(totalRemaining.toFixed(2)),  
        monthlyInterestPaid: Number(currentMonthInterest.toFixed(2))  
      });

      if (totalRemaining \=== 0) break;  
    }

    return {  
      method,  
      totalMonthsToPayoff: currentMonth,  
      totalInterestPaid: Number(totalInterestPaid.toFixed(2)),  
      timeline  
    };  
  }  
}

## **Benchmarks de Serviços e Aplicações SaaS: Transposição Arquitetural para Custo Zero**

O mercado comercial de soluções financeiras é dominado por aplicações SaaS por assinatura que cobram valores substanciais pelo acesso a painéis de controle, projeções patrimoniais e categorização automatizada22. A arquitetura do Kitsune Finance é projetada para entregar funcionalidades de nível enterprise replicando a lógica desses produtos sem custos de servidores7.

### **Pierre Finance**

A Pierre Finance consolidou-se como um assistente financeiro baseado em inteligência artificial via WhatsApp e aplicativo com Open Finance54. Em 2025/2026, a startup introduziu o conceito de *Pierre MCP* (Model Context Protocol), um protocolo que conecta assistentes autônomos aos dados bancários brutos do usuário para consultas em tempo real via agentes conversacionais56. No entanto, a operação do produto enfrenta queixas em canais de defesa do consumidor referentes a limites de mensagens na camada gratuita e inconsistências na categorização repetida de despesas idênticas53.

* *Estratégia de Transposição Gratuita:* O Kitsune Finance implementa um endpoint de Model Context Protocol interno hospedado nas Serverless Functions do Next.js App Router (/api/mcp)29. Diferente do Pierre, que repassa as mensagens do WhatsApp para serviços comerciais de LLM, o Kitsune processa as intenções sem custos adicionais através das chamadas de ferramentas (*Function Calling*) do SDK do Google Gemini (camada gratuita), garantindo categorização estável por meio de um catálogo local de regex e consulta pública de CNPJs59.

### **Copilot Money & Monarch Money**

O Copilot Money tornou-se a referência internacional em interface gráfica limpa, detecção automática de assinaturas recorrentes e categorização baseada em aprendizado de máquina adaptativo22. Paralelamente, o Monarch Money consolidou-se como a principal plataforma de orçamento colaborativo para casais e famílias, permitindo combinar contas conjuntas e individuais sem perda de autonomia pessoal22.

* *Estratégia de Transposição Gratuita:* O motor adaptativo do Copilot é viabilizado no cliente através de um classificador supervisionado em Naive Bayes ou árvores de decisão em JavaScript executado dentro do navegador via Web Worker, treinando com o próprio histórico de correções manuais do usuário armazenado no IndexedDB7. O modelo de casal do Monarch Money é implementado sem infraestrutura adicional via Supabase Row Level Security (RLS)7. Com a tabela de membros (household\_members) associada aos IDs de usuário, políticas de segurança concedem leitura e escrita granular entre parceiros, enquanto *views* SQL realizam a partilha proporcional de despesas calculadas a partir da renda líquida informada por cada indivíduo.

### **Kinvo & Gorila Invest**

O Kinvo e o Gorila representam os dois maiores players brasileiros de acompanhamento analítico de carteiras de investimento, destacando-se pelo agrupamento de ativos de Renda Fixa e cálculo da marcação na curva versus marcação a mercado dos papéis46. Essas plataformas cobram assinaturas recorrentes para liberar relatórios avançados de rentabilidade líquida, sensibilidade da curva DI e calendário unificado de proventos.

* *Estratégia de Transposição Gratuita:* Toda a infraestrutura analítica de precificação de títulos é executada no próprio navegador do usuário pelo CDICalculationEngine e FisherRealReturnEngine. As séries temporais históricas do CDI e do IPCA são obtidas de forma transparente e gratuita via API pública do Sistema Gerenciador de Séries Temporais do Banco Central (SGS/BCB), eliminando a contratação de intermediários pagos de dados de mercado45.

### **Wealthfront (Pathfinder)**

O motor *Pathfinder* da Wealthfront oferece simulações financeiras de longo prazo com base no método de Monte Carlo, projetando a data de aposentadoria e independência financeira a partir da taxa de poupança atual, volatilidade dos mercados e cenários macroeconômicos estressados64.

* *Estratégia de Transposição Gratuita:* Simulações de Monte Carlo executando 1.000 ou 5.000 iterações demandam uso intensivo de CPU, o que acarretaria estouro do tempo limite de 10 segundos nas funções serverless da Vercel Hobby. Essa carga computacional é transferida para um Web Worker no cliente, permitindo que o navegador calcule distribuições de probabilidade completas em frações de segundo e plote gráficos dinâmicos de área a 60 FPS, sem consumir cota de servidor.

### **Lunch Money & Empower**

O Lunch Money foca na transparência para desenvolvedores com APIs abertas e suporte multicambial, enquanto o Empower (antigo Personal Capital) oferece um consolidador patrimonial que integra contas correntes, cartões de crédito, carteiras de previdência e hipotecas22.

* *Estratégia de Transposição Gratuita:* O Kitsune Finance disponibiliza uma API interna leve acoplada a exportações locais completas em JSON e CSV, assegurando propriedade integral dos dados pelo usuário19. A visão holística de patrimônio líquido (Net Worth Tracker) é mantida em uma *Materialized View* no PostgreSQL do Supabase, que consolida ativos e passivos em tempo real por meio de gatilhos acionados nas movimentações transacionais19.

### **Comparativo de Replicação Arquitetural**

A tabela a seguir consolida os modelos de negócio e a engenharia de substituição gratuita aplicada a cada funcionalidade do ecossistema comercial.

| Funcionalidade Analisada | Plataforma de Referência | Custo Comercial Médio | Engenharia de Substituição Custo Zero no Kitsune Finance | Mitigação de Restrições Técnicas |
| :---- | :---- | :---- | :---- | :---- |
| **Protocolo MCP de Open Finance** | Pierre Finance56 | R\$ 39 a R\$ 199/mês53 | Route Handlers do Next.js expondo schemas de Model Context Protocol sob demanda29. | Elimina a necessidade de servidores ou daemons Node.js ativos permanentemente29. |
| **Categorização Adaptativa** | Copilot Money22 | US\$ 13/mês22 | Triagem local: Regex \-\> Cache CNPJ (BrasilAPI)59 \-\> Gemini Flash apenas para casos residuais. | Neutraliza custos de API paga (OpenAI/Plaid) e preserva cotas gratuitas do Gemini. |
| **Espaço de Casal / Família** | Monarch Money22 | US\$ 14,99/mês66 | Políticas de Row Level Security (RLS) no Supabase sobre chaves de household7. | Provê isolamento de dados por perfil sem exigir bancos independentes7. |
| **Marcação na Curva de Títulos** | Kinvo / Gorila | R\$ 20 a R\$ 45/mês | Motor determinístico TypeScript no cliente consumindo endpoints do SGS/BCB3. | Suprime dependência de servidores de cálculo batch em nuvem. |
| **Projeção de Longo Prazo** | Wealthfront (Pathfinder)64 | 0,25% a.a. sobre AUM | Motor estocástico de Monte Carlo executado dentro de Web Workers no navegador. | Contorna o limite de 10s das Serverless Functions da Vercel Hobby. |
| **Auditoria e Partidas Dobradas** | Firefly III23 | Gratuito / Self-hosted10 | Triggers em PL/pgSQL no PostgreSQL que garantem consistência contábil de débitos e créditos24. | Mantém integridade total sem rodar containers PHP/Laravel na nuvem. |

## **Orquestração Multi-Agente e RAG Financeiro Leve com Google Gemini**

O ecossistema multi-agente do Kitsune Finance é composto por sete personas autônomas especializadas: Sentinela Kitsune (monitoramento preventivo), Kuro (auditoria de consumo supérfluo), Kenji (investigador de extratos e descrições bancárias), Daiko (estrategista de Renda Fixa e multiplicação patrimonial), Kage (auditor de duplicidades e assinaturas ocultas), Ren (projetista de faturas futuras) e Takeshi (analista de tarifas e negociação).  
Para operar com sucesso sob as restrições da camada gratuita do Google Gemini (limites de chamadas por minuto e cotas de tokens), o sistema adota padrões estritos de invocação baseados em chamadas de função estruturadas (*Function Calling* com saídas JSON tipadas)28.

### **Padrão de Chamada de Função Determinística com Gemini Flash**

A arquitetura do agente proíbe terminantemente a estimativa direta de dados financeiros pelo modelo de linguagem. O LLM atua exclusivamente como roteador semântico de intenções, identificando parâmetros fornecidos pelo usuário e delegando o processamento matemático para as rotinas em TypeScript da aplicação.

TypeScript  
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';  
import { CDICalculationEngine } from './deterministic-math';

const genAI \= new GoogleGenerativeAI(process.env.GEMINI\_API\_KEY\!);

// Declaração do schema tipado da ferramenta matemática para o Gemini  
const cdiCalculatorDeclaration: FunctionDeclaration \= {  
  name: 'calculateCDIYield',  
  description: 'Executa a apuração matemática de rentabilidade de um investimento indexado ao CDI na base 252 dias úteis.',  
  parameters: {  
    type: SchemaType.OBJECT,  
    properties: {  
      principal: { type: SchemaType.NUMBER, description: 'Capital inicial aplicado em Reais' },  
      cdiPercentage: { type: SchemaType.NUMBER, description: 'Percentual do CDI contratado (ex: 110 para 110% do CDI)' },  
      annualRate: { type: SchemaType.NUMBER, description: 'Taxa CDI anual corrente em percentual (ex: 10.65)' },  
      businessDays: { type: SchemaType.INTEGER, description: 'Prazo decorrido em dias úteis bancários' }  
    },  
    required: \['principal', 'cdiPercentage', 'annualRate', 'businessDays'\]  
  }  
};

export async function executeDaikoAgent(userPrompt: string): Promise\<string\> {  
  const model \= genAI.getGenerativeModel({  
    model: 'gemini-1.5-flash',  
    tools: \[{ functionDeclarations: \[cdiCalculatorDeclaration\] }\],  
    systemInstruction: \`Você é Daiko, o estrategista de Renda Fixa do ecossistema Kitsune Finance.   
    Seu papel é oferecer aconselhamento estratégico sobre multiplicação patrimonial e preservação de capital.  
    Você NUNCA realiza contas matemáticas ou estimativas financeiras de cabeça.   
    Sempre que o usuário solicitar rendimentos, resgates ou projeções, você OBRIGATORIAMENTE invoca a função calculateCDIYield.  
    Após receber o resultado exato da ferramenta, interprete os dados sob a ótica macroeconômica brasileira.\`  
  });

  const session \= model.startChat();  
  const initialResponse \= await session.sendMessage(userPrompt);  
  const functionCall \= initialResponse.response.functionCalls()?.\[0\];

  if (functionCall && functionCall.name \=== 'calculateCDIYield') {  
    const { principal, cdiPercentage, annualRate, businessDays } \= functionCall.args as any;

    // Simulação do conjunto de taxas para o intervalo de dias úteis informado  
    const simulatedRates \= Array.from({ length: businessDays }, (\_, i) \=\> ({  
      date: \`day-\${i \+ 1}\`,  
      annualRate: Number(annualRate)  
    }));

    // Execução pelo motor determinístico livre de alucinações  
    const calculationOutput \= CDICalculationEngine.accumulateYield(  
      Number(principal),  
      Number(cdiPercentage),  
      simulatedRates  
    );

    // Injeção do dado exato de volta na sessão do modelo  
    const completionResponse \= await session.sendMessage(\[  
      {  
        functionResponse: {  
          name: 'calculateCDIYield',  
          response: { result: calculationOutput }  
        }  
      }  
    \]);

    return completionResponse.response.text();  
  }

  return initialResponse.response.text();  
}

### **Pipeline de Enriquecimento Semântico em Três Camadas**

A identificação precisa de estabelecimentos comerciais e categorias de consumo opera através de um pipeline em cascata projetado para minimizar o consumo de chamadas externas de rede e tokens de IA:

> 1. **Camada Local (Regex Heurístico no Navegador):** Uma coleção de expressões regulares pré-compiladas avalia a string da transação bancária localmente, identificando prefixos de credenciamento recorrentes (PAG\*, MP\*, CIELO\*, SUMUP\*, IFOOD\*, UBER\*) e atribuindo o nome fantasia e categoria correspondente em microssegundos, sem chamadas externas7.  
> 2. **Camada Pública Governamental (Consulta de CNPJ via BrasilAPI):** Se a descrição contiver a chave de 14 dígitos de um pagamento Pix ou boleto, a biblioteca brasilapi-sdk é consultada para resgatar a Razão Social oficial e o código CNAE da entidade receptora37. O resultado é armazenado em uma tabela de cache comunitário no Supabase, tornando a consulta definitiva para todos os usuários do Kitsune Finance59.  
> 3. **Camada de Inteligência Residual (Gemini Flash em Lote):** Transações que não obtiverem correspondência nas camadas anteriores são agrupadas em lotes de até 50 lançamentos e submetidas ao agente Kenji28. A chamada impõe um esquema de resposta tipado (responseMimeType: "application/json"), instruindo o modelo a fornecer exclusivamente campos normalizados de nome fantasia, categoria primária e indicativo de pagamento recorrente.

## **Engenharia Local-First, Caching Offline (IndexedDB) e Otimizações de Renderização**

Para manter estabilidade permanente dentro dos planos gratuitos da Vercel e do Supabase, o Kitsune Finance transfere o estado ativo de leitura e modificação para o navegador do cliente, reduzindo requisições ao PostgreSQL e consumo de banda7.

### **Persistência Local-First com Dexie.js (IndexedDB)**

O Dexie.js é utilizado como camada de persistência local no dispositivo do usuário7. O IndexedDB armazena as transações bancárias, contas conectadas, categorias orçamentárias e metas financeiras com indexação local, permitindo respostas de interface com latência de zero milissegundos7.

TypeScript  
import Dexie, { Table } from 'dexie';

export interface LocalTransactionRecord {  
  id: string;  
  accountId: string;  
  householdId: string;  
  amount: number;  
  date: string; // ISO String  
  descriptionRaw: string;  
  merchantCleaned: string;  
  category: string;  
  isPending: boolean;  
  syncStatus: 'SYNCED' \| 'MODIFIED\_LOCALLY' \| 'INSERTED\_LOCALLY';  
  updatedAt: string;  
}

export class KitsuneLocalDatabase extends Dexie {  
  transactions\!: Table\<LocalTransactionRecord, string\>;

  constructor() {  
    super('KitsuneFinanceLocalDB');  
    this.version(1).stores({  
      transactions: 'id, accountId, householdId, date, merchantCleaned, category, syncStatus'  
    });  
  }  
}

export const dbLocal \= new KitsuneLocalDatabase();

### **Protocolo de Sincronização Assíncrona via Fila Outbox**

As alterações manuais executadas pelo usuário — como recategorizações, criação de despesas em dinheiro ou anotações personalizadas — são gravadas atomicamente no IndexedDB marcadas com o status MODIFIED\_LOCALLY ou INSERTED\_LOCALLY9.  
Um sincronizador em segundo plano conectado ao Service Worker do PWA monitora a conexão de rede7. Ao detectar conexão estável, o sincronizador despacha o lote pendente para uma Serverless Function do Next.js através de uma única chamada HTTP POST7. A função grava os dados no PostgreSQL do Supabase utilizando a resolução de conflitos por *Last-Write-Wins* parametrizada pelo campo updatedAt, atualizando o status local para SYNCED7. Quando ocorrem divergências entre os saldos reportados pelas APIs do Open Finance e os lançamentos locais, o sistema cria um registro explícito de ajuste de conciliação (*Reconciliation Adjustment*), assegurando conformidade contábil estrita sem perda de histórico24.

### **Estratégias de Renderização de Baixa Sobrecarga na Thread Principal**

A interface do Kitsune Finance adota técnicas de renderização para garantir desempenho constante a 60 FPS, mesmo em dispositivos móveis sob uso contínuo:

* **Mapa de Calor e Séries Longas em HTML5 Canvas:** Gráficos de alta densidade de dados — como mapas de calor de despesas dos últimos 365 dias ou gráficos históricos de patrimônio — são desenhados diretamente em elementos \<canvas\> nativos, evitando a criação de centenas de nós SVG no DOM do navegador.  
* **Virtualização de Listas de Lançamentos:** Em telas de extrato consolidado com grandes históricos de compras, o sistema renderiza apenas as linhas atualmente visíveis na viewport por meio de janelas virtuais gerenciadas pelo @tanstack/react-virtual, mantendo o consumo de memória baixo e estável10.  
* **Web Workers Dedicados para Computação Financeira:** Todos os cálculos do TotalEffectiveCostEngine, DebtAmortizationEngine e simulações estocásticas de Monte Carlo operam em *threads* de segundo plano (*Web Workers*), isolando o processamento matemático pesado da renderização da interface gráfica do usuário.

## **Matriz de Priorização de Funcionalidades (Impacto vs. Complexidade)**

A priorização do backlog de engenharia do Kitsune Finance orienta-se pela relação entre o valor agregado entregue ao usuário e a complexidade técnica de desenvolvimento sob a premissa de custo zero de infraestrutura.

| Funcionalidade Proposta | Impacto no Usuário | Complexidade Técnica | Quadrante Estratégico | Racional de Implementação e Mitigação de Riscos |
| :---- | :---- | :---- | :---- | :---- |
| **Motores de Cálculo de IR, IOF e Juro Real** | Muito Alto | Baixa | *Quick Win* | Elimina alucinações de modelos de IA e estabelece conformidade fiscal rigorosa no cliente2. |
| **Deduplicação de Transações de Cartão de Crédito** | Muito Alto | Média | *Aposta Estratégica* | Trata a transição de faturas abertas para fechadas na API do Meu Pluggy, impedindo contagem dupla de despesas28. |
| **Persistência Local-First com Dexie.js** | Alto | Média | *Aposta Estratégica* | Provê tempo de inicialização de 0 ms em redes móveis e protege as cotas de conexão do Supabase7. |
| **Simulador de Quitação Bola de Neve vs. Avalanche** | Alto | Baixa | *Quick Win* | Implementa ferramenta de alto engajamento psicológico baseada em código TypeScript puro no cliente51. |
| **Enriquecimento Comunitário de CNPJs via BrasilAPI** | Alto | Baixa | *Quick Win* | Normaliza extratos bancários brutos sem custos de APIs pagas usando cache comunitário37. |
| **Simulações de Monte Carlo via Web Workers** | Alto | Média | *Aposta Estratégica* | Traz a inteligência do Pathfinder da Wealthfront sem consumir ciclos de CPU em instâncias de nuvem64. |
| **Gateway Local de Model Context Protocol (MCP)** | Médio | Alta | *Projeto Estrutural* | Cria paridade com a inovação do Pierre MCP utilizando Server Actions serverless sob demanda29. |
| **Espaço Compartilhado com RLS Multitenant** | Muito Alto | Média | *Aposta Estratégica* | Oferece a experiência de casais do Monarch Money garantindo isolamento total por linhas de banco de dados22. |
| **Diagrama de Sankey Nativo em Canvas** | Médio | Média | *Refinamento Visual* | Absorve a melhor visualização de fluxo de caixa do Maybe Finance sem sobrecarregar o DOM19. |
| **Auditoria Contábil por Partidas Dobradas** | Alto | Alta | *Transformação de Fundo* | Incorpora o rigor contábil do Firefly III em transferências entre contas bancárias do usuário23. |

## **Roadmap de Expansão Arquitetural**

O plano de evolução da engenharia do Kitsune Finance divide-se em quatro fases sucessivas de entrega estruturadas para transformar a aplicação no gerenciador financeiro gratuito mais robusto e completo do cenário nacional.

### **Fase 1: Blindagem Numérica e Conciliação Robusta (Semanas 1 a 3\)**

A fase inicial foca na eliminação de discrepâncias de dados e cálculos. O primeiro passo consiste em desacoplar qualquer operação de agregação financeira ou rentabilidade dos prompts de linguagem natural, integrando de forma compulsória os motores CDICalculationEngine, BrazilianTaxEngine e FisherRealReturnEngine em todos os módulos de renda fixa do sistema2. Em paralelo, implementa-se o algoritmo de deduplicação de cartões no conector Meu Pluggy para reconciliar o ciclo de vida de lançamentos pendentes quando a fatura é fechada, evitando saldos inflados no fechamento do mês28. Conclui-se essa fase com a implantação do cliente brasilapi-sdk com fallback para a base aberta MinhaReceita, alimentando a tabela known\_merchants no Supabase como catálogo compartilhado de CNPJs e classificações CNAE37.

### **Fase 2: Arquitetura Local-First e Resiliência Mobile (Semanas 4 a 6\)**

O foco desta etapa é transformar a experiência móvel através de padrões de computação no cliente. O esquema de dados local é inicializado via Dexie.js (IndexedDB), cacheando extratos, faturas e orçamentos diretamente no armazenamento persistente do navegador7. Desenvolve-se o protocolo de sincronização em segundo plano via Fila Outbox, gerenciado pelo Service Worker do PWA, garantindo que toda edição de despesa pelo usuário seja imediata e sincronizada de forma idempotente assim que a conectividade for restabelecida9. Por fim, aplica-se a virtualização de linhas no extrato consolidado com @tanstack/react-virtual, eliminando travamentos de rolagem em aparelhos celulares ao navegar por milhares de movimentações bancárias consolidadas10.

### **Fase 3: Planejamento Passivo e Projeções Estocásticas (Semanas 7 a 9\)**

A terceira etapa expande a inteligência financeira preventiva do sistema. Lança-se o módulo analítico de eliminação de passivos, integrando a interface visual do comparador entre as estratégias Bola de Neve e Avalanche a partir do DebtAmortizationEngine51. Desenvolve-se o motor estocástico de Monte Carlo dentro de um Web Worker dedicado no cliente, permitindo projetar cenários de independência financeira com base na taxa de retirada segura (SWR) sob múltiplos parâmetros de inflação e rendimento real líquido, replicando as capacidades analíticas do Pathfinder da Wealthfront a custo zero64. Finaliza-se a fase com o desenvolvimento de um componente nativo em HTML5 Canvas para desenhar o diagrama de Sankey do fluxo de caixa doméstico com zero impacto sobre a árvore de elementos do DOM19.

### **Fase 4: Orquestração Agêntica Avançada e Protocolo MCP (Semanas 10 a 12\)**

A fase final consolida o ecossistema autônomo e de conectividade aberta do sistema. Os sete agentes do ecossistema Kitsune Finance têm seus prompts de sistema reconfigurados para operação compulsória sob declaração de esquemas de ferramentas (tools), com respostas estruturadas e tipadas via SDK do Google Gemini. Em seguida, implementa-se um gateway de Model Context Protocol (MCP) local através de Route Handlers no Next.js App Router, permitindo que ferramentas externas de inteligência artificial autorizadas pelo usuário consultem dados bancários consolidados com segurança e privacidade, criando paridade com protocolos comerciais como o Pierre MCP29. Por fim, implanta-se a integridade contábil estrita de partidas dobradas via triggers em PL/pgSQL no Supabase, garantindo que toda movimentação entre contas do próprio usuário seja processada atomicamente como débito e crédito correspondentes, eliminando definitivamente distorções no fluxo de caixa patrimonial23.

#### **Referências citadas**

> 1. GitHub \- andrewmurphy353/curo: Powerful, modern Dart library for, [https\://github.com/andrewmurphy353/curo](https://github.com/andrewmurphy353/curo)  
> 2. Calculadora de juros compostos \- Grupo OTB, [https\://gotb.com.br/ferramentas/juros-compostos](https://gotb.com.br/ferramentas/juros-compostos)  
> 3. Manual de operações – B3CALC, [https\://www\.b3.com.br/lumis/portal/file/fileDownload.jsp?fileId=8AE490CA7861D39C0178B17E20392164](https://www.b3.com.br/lumis/portal/file/fileDownload.jsp?fileId=8AE490CA7861D39C0178B17E20392164)  
> 4. RESOLUÇÃO CMN Nº 4.881, DE 23 DE DEZEMBRO DE 2020, [https\://www\.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf](https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf)  
> 5. jefheee/kitsune-finance: Aplicativo mobile-first de gestão ... \- GitHub, [https\://github.com/jefheee/kitsune-finance](https://github.com/jefheee/kitsune-finance)  
> 6. GitHub \- pluggyai/meu-pluggy: An easy way to connect your account, [https\://github.com/pluggyai/meu-pluggy](https://github.com/pluggyai/meu-pluggy)  
> 7. Best Offline-First Tech Stack For 2026 \- CSS Author, [https\://cssauthor.com/offline-first-tech-stack/](https://cssauthor.com/offline-first-tech-stack/)  
> 8. IndexedDB in React \- Hooks, Libraries, and Live Queries \| RxDB, [https\://rxdb.info/articles/react-indexeddb.html](https://rxdb.info/articles/react-indexeddb.html)  
> 9. fareflow \- Mobile-first offline travel expense PWA · GitHub, [https\://github.com/iwannabewater/fareflow](https://github.com/iwannabewater/fareflow)  
> 10. \[Bug\]: A lag and value switching while modifying transactions on an, [https\://github.com/actualbudget/actual/issues/7763](https://github.com/actualbudget/actual/issues/7763)  
> 11. Financial-Tracker-App/STATUS.md at main \- EnmaSantos \- GitHub, [https\://github.com/EnmaSantos/Financial-Tracker-App/blob/main/STATUS.md](https://github.com/EnmaSantos/Financial-Tracker-App/blob/main/STATUS.md)  
> 12. \[Feature\] automatically merge modified-at-post-date bank sync, [https\://github.com/actualbudget/actual/issues/8757](https://github.com/actualbudget/actual/issues/8757)  
> 13. \[Feedback\]: Redesigned sidebar · Issue \#9007 · actualbudget/actual, [https\://github.com/actualbudget/actual/issues/9007](https://github.com/actualbudget/actual/issues/9007)  
> 14. GitHub \- ghostfolio/ghostfolio: Open Source Wealth Management, [https\://github.com/ghostfolio/ghostfolio](https://github.com/ghostfolio/ghostfolio)  
> 15. Display three performances: capital, dividend and currency gains, [https\://github.com/ghostfolio/ghostfolio/discussions/1166](https://github.com/ghostfolio/ghostfolio/discussions/1166)  
> 16. Ability to choose type of performance \#2960 \- GitHub, [https\://github.com/ghostfolio/ghostfolio/discussions/2960](https://github.com/ghostfolio/ghostfolio/discussions/2960)  
> 17. Fixed Interest \#3603 \- ghostfolio \- GitHub, [https\://github.com/ghostfolio/ghostfolio/discussions/3603](https://github.com/ghostfolio/ghostfolio/discussions/3603)  
> 18. Something strange with performance analysis \#4341 \- GitHub, [https\://github.com/ghostfolio/ghostfolio/discussions/4341](https://github.com/ghostfolio/ghostfolio/discussions/4341)  
> 19. maybe-finance/maybe: The personal finance app for everyone, [https\://github.com/maybe-finance/maybe](https://github.com/maybe-finance/maybe)  
> 20. GitHub \- maybe-finance/maybe-archive, [https\://github.com/maybe-finance/maybe-archive](https://github.com/maybe-finance/maybe-archive)  
> 21. Deploy Maybe Finance \| Easypanel, [https\://easypanel.io/templates/maybe-finance](https://easypanel.io/templates/maybe-finance)  
> 22. Copilot Money Budget App Review 2026: Pros, Cons And Verdict, [https\://www\.forbes.com/advisor/banking/copilot-budget-app-review/](https://www.forbes.com/advisor/banking/copilot-budget-app-review/)  
> 23. Reconciliation of accounts · Issue \#3571 · firefly-iii/firefly-iii \- GitHub, [https\://github.com/firefly-iii/firefly-iii/issues/3571](https://github.com/firefly-iii/firefly-iii/issues/3571)  
> 24. firefly-iii/config/firefly.php at main \- GitHub, [https\://github.com/firefly-iii/firefly-iii/blob/main/config/firefly.php](https://github.com/firefly-iii/firefly-iii/blob/main/config/firefly.php)  
> 25. Update dates after starting reconciliation \#12404 \- firefly-iii \- GitHub, [https\://github.com/orgs/firefly-iii/discussions/12404](https://github.com/orgs/firefly-iii/discussions/12404)  
> 26. Official Node SDK for Pluggy API \- GitHub, [https\://github.com/pluggyai/pluggy-node](https://github.com/pluggyai/pluggy-node)  
> 27. Official Java SDK for Pluggy API \- pluggyai \- GitHub, [https\://github.com/pluggyai/pluggy-java](https://github.com/pluggyai/pluggy-java)  
> 28. personal-finance \- icesnow10 \- GitHub, [https\://github.com/icesnow10/personal-finance](https://github.com/icesnow10/personal-finance)  
> 29. MCP server for Pluggy.ai Open Finance API — exposes ... \- GitHub, [https\://github.com/lefranchi/mcp-pluggy](https://github.com/lefranchi/mcp-pluggy)  
> 30. GitHub \- pluggyai/quickstart: Integrate Pluggy into your application in, [https\://github.com/pluggyai/quickstart](https://github.com/pluggyai/quickstart)  
> 31. pluggyai/agent-skills \- GitHub, [https\://github.com/pluggyai/agent-skills](https://github.com/pluggyai/agent-skills)  
> 32. Agent Skills \- Pluggy Docs, [https\://docs.pluggy.ai/en/docs/developer-tools/ai-skills](https://docs.pluggy.ai/en/docs/developer-tools/ai-skills)  
> 33. Update \| Pluggy Docs, [https\://docs.pluggy.ai/en/reference/items/items-update](https://docs.pluggy.ai/en/reference/items/items-update)  
> 34. Como receber um webhook toda vez que você compra algo, [https\://banco.mcp.ai/guias/webhook-quando-comprar-algo](https://banco.mcp.ai/guias/webhook-quando-comprar-algo)  
> 35. Criar \| Pluggy Docs, [https\://docs.pluggy.ai/pt/reference/webhook/webhooks-create](https://docs.pluggy.ai/pt/reference/webhook/webhooks-create)  
> 36. lenivene/minha-receita-api: Consulta de informações do CNPJ, [https\://github.com/lenivene/minha-receita-api](https://github.com/lenivene/minha-receita-api)  
> 37. guhcostan/brasilapi-sdk: TypeScript SDK for Brasil API \- GitHub, [https\://github.com/guhcostan/brasilapi-sdk](https://github.com/guhcostan/brasilapi-sdk)  
> 38. feryamaha/MapHunter · GitHub \- GitHub, [https\://github.com/feryamaha/MapHunter](https://github.com/feryamaha/MapHunter)  
> 39. GitHub \- luisbarcia/n8n-nodes-brasil-hub, [https\://github.com/luisbarcia/n8n-nodes-brasil-hub](https://github.com/luisbarcia/n8n-nodes-brasil-hub)  
> 40. README.md \- danielheringers/consulta-cnpj \- GitHub, [https\://github.com/danielheringers/consulta-cnpj/blob/main/README.md](https://github.com/danielheringers/consulta-cnpj/blob/main/README.md)  
> 41. Manual de Apreçamento \- BNY, [https\://www\.bny.com/content/dam/bnymellon/documents/pdf/brazil/manual-de-apre%C3%A7amento.pdf](https://www.bny.com/content/dam/bnymellon/documents/pdf/brazil/manual-de-apre%C3%A7amento.pdf)  
> 42. primeiro aditamento ao termo de securitização de créditos, [https\://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id=756975](https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id=756975)  
> 43. R\$ 2.000.000.000,00 \- Santander, [https\://cms.santander.com.br/sites/WPS/documentos/arq-CRIRedeDor-Prospecto/23-08-22\_165248\_rede\_dor\_emissao\_176\_prospecto\_preliminar.pdf](https://cms.santander.com.br/sites/WPS/documentos/arq-CRIRedeDor-Prospecto/23-08-22_165248_rede_dor_emissao_176_prospecto_preliminar.pdf)  
> 44. R\$ 402.255.000,00 \- XP Investimentos, [https\://downloads.xpi.com.br/BO/20161219\_PROSPECTO\_DEFINITIVO\_CRA\_CAMIL.pdf](https://downloads.xpi.com.br/BO/20161219_PROSPECTO_DEFINITIVO_CRA_CAMIL.pdf)  
> 45. Como Calcular o Juro Real do Brasil via API (Selic \- IPCA) \- brapi, [https\://brapi.dev/blog/como-calcular-juro-real-brasil-selic-ipca-api-2026](https://brapi.dev/blog/como-calcular-juro-real-brasil-selic-ipca-api-2026)  
> 46. Taxa de juros real: o que é, principais impactos e como calcular, [https\://www\.topinvest.com.br/blog/taxa-de-juros-real/](https://www.topinvest.com.br/blog/taxa-de-juros-real/)  
> 47. MSP4111: Matemática Financeira Aplicada à Medicina \- RPubs, [https\://rpubs.com/josiqueira/1393182](https://rpubs.com/josiqueira/1393182)  
> 48. Por que a Renda Fixa Brasileira é Atípica no Mundo \- Patrimo, [https\://www\.patrimo.app/blog/renda-fixa-brasileira-atipica-no-mundo](https://www.patrimo.app/blog/renda-fixa-brasileira-atipica-no-mundo)  
> 49. O que é Custo Efetivo Total (CET) e para que serve? \| 99Pay, [https\://99app.com/blog/99pay/o-que-e-custo-efetivo-total-cet-e-para-que-serve/](https://99app.com/blog/99pay/o-que-e-custo-efetivo-total-cet-e-para-que-serve/)  
> 50. financial-wellness · GitHub Topics, [https\://github.com/topics/financial-wellness?l=typescript\&o=asc\&s=updated](https://github.com/topics/financial-wellness?l=typescript&o=asc&s=updated)  
> 51. c-rw/billzzz: Personal finance management app for tracking bills, [https\://github.com/c-rw/billzzz](https://github.com/c-rw/billzzz)  
> 52. Node script to calculate debt repayment using the snowball method, [https\://github.com/nielse63/node-debt-snowball](https://github.com/nielse63/node-debt-snowball)  
> 53. Pierre \- Assistente Financeiro \- pierre.finance, [https\://lp.pierre.finance/](https://lp.pierre.finance/)  
> 54. Melhor App Financeiro com IA no Brasil 2026 \- Graniq, [https\://www\.graniq.com.br/melhores-apps/app-com-ia](https://www.graniq.com.br/melhores-apps/app-com-ia)  
> 55. Central de ajuda \- pierre.finance, [https\://lp.pierre.finance/ajuda](https://lp.pierre.finance/ajuda)  
> 56. Pierre MCP: a Alexa das finanças \- Let's Money, [https\://www\.letsmoney.com.br/destaque/pierre-mcp-alexa-financas/](https://www.letsmoney.com.br/destaque/pierre-mcp-alexa-financas/)  
> 57. Aplicativo de WhatsApp da Pierre Finance apresenta dados, [https\://www\.reclameaqui.com.br/pierre-finance/aplicativo-de-whatsapp-da-pierre-finance-apresenta-dados-incorretos-e-limita-o-uso-de-mensagens-em-plano-gratuito\_15gMVV5vpqzkU3Wt/](https://www.reclameaqui.com.br/pierre-finance/aplicativo-de-whatsapp-da-pierre-finance-apresenta-dados-incorretos-e-limita-o-uso-de-mensagens-em-plano-gratuito_15gMVV5vpqzkU3Wt/)  
> 58. I TESTED the Pierre Finance app. Watch this before ... \- YouTube, [https\://www\.youtube.com/watch?v=cj-yi6wpDjc](https://www.youtube.com/watch?v=cj-yi6wpDjc)  
> 59. Busca CNPJ \#235 \- BrasilAPI \- GitHub, [https\://github.com/BrasilAPI/BrasilAPI/discussions/235](https://github.com/BrasilAPI/BrasilAPI/discussions/235)  
> 60. Monarch Money vs Copilot Money: The Ultimate 2026 AI Budgeting, [https\://aiwithfintech.com/monarch-money-vs-copilot-money/](https://aiwithfintech.com/monarch-money-vs-copilot-money/)  
> 61. Best AI finance apps in 2026: which one to choose and why, [https\://spendlyai-app.com/en/blog/best-ai-finance-apps-2026/](https://spendlyai-app.com/en/blog/best-ai-finance-apps-2026/)  
> 62. 3 AI Budgeting Apps Tested \| Which One Actually Wins?, [https\://techcapitalhub.com/which-ai-budgeting-apps-wins-2026/](https://techcapitalhub.com/which-ai-budgeting-apps-wins-2026/)  
> 63. grafo-credito \- taxas ANBIMA, spread e risco de crédito \- GitHub, [https\://github.com/alissondpoliveira/grafo-credito](https://github.com/alissondpoliveira/grafo-credito)  
> 64. Ask HN: Who is hiring? (August 2016\) \- Hacker News, [https\://news.ycombinator.com/item?id=12202865](https://news.ycombinator.com/item?id=12202865)  
> 65. Copilot Money Review 2026: USD-Only, No Multi-Currency, [https\://borderlessbudget.com/blog/copilot-money-review-expats](https://borderlessbudget.com/blog/copilot-money-review-expats)  
> 66. Best AI Budgeting App 2026: Honest Reviews & Comparison, [https\://waypointbudget.com/blog/best-ai-budgeting-app-2026](https://waypointbudget.com/blog/best-ai-budgeting-app-2026)  
> 67. NafisianCastle/finance-os: Local-first, offline-capable ... \- GitHub, [https\://github.com/NafisianCastle/finance-os](https://github.com/NafisianCastle/finance-os)  
> 68. Dexie Cloud — Turn your App into a SaaS in minutes \| Offline-First, [https\://dexie.org/cloud](https://dexie.org/cloud)  
> 69. \[Feedback\]: Akahu bank sync provider · Issue \#8020 \- GitHub, [https\://github.com/actualbudget/actual/issues/8020](https://github.com/actualbudget/actual/issues/8020)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAWCAYAAAAM2IbtAAAAkUlEQVR4XmNgGOQgCYh3A7EwugQHEG+FYhAbBcgA8RMgbkUW5AFiSSAOBeLfQBwBxOJAzAqSjAfiWUB8H4h/AvFSIJ4ExMogSRDAax9eSayOgQEXIP4FpTFAFRA/B2IldAmYfXuAmJsB4oUuBohVDCJAfJUBYV8QEBcAMSOIAyIagfgOEK+EssEBgAwEoJjWAACCGBjPkcMDtgAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAVCAYAAADID4fUAAABpElEQVR4Xu2VTStFURSGX4V8ZqIolCSlTCSkGCgTE8kfMDQ3NjVUyEgmBooyURSl6JrLRIY+UkphgkI+3mXdXeesztlnd+syuU89dbvr3HPW3uu9+wAlSvgZpXf0O+Ijvc9/fqe7tMv9wNBJzxD//SfdorWR64JYox902HzfSnfoEx0wtSgT0AaWbSGUenpCz2mjqQlN9ILu02pTc8xDm5BmCqKbPtBtWm5qjnXoNXKtpY4eQ8faES+F47ZyxhYiSBOvtN8WoA+WBg5RQA4cMsekPDjkxvKAF9pnaoJbhIykINxWpuVBaKFXSN9ul4dxWwglJA9j9Ivu0SpT8+WhDIHjycqD3GgF2sSUqQm+PAxBG5dGvWTloRd6RqzSClMTfHmYRcC5kXU+NNMcdJUNpuZIOh/a6RK9hI5KmqmM1GP0QFdp8yArnoSGcRPpDfjyIIs6QvK58ssIvUb8rL+lN9B3xhv0fTEIzYRF3iOn0PeKu8cz3aA1+WtkvAfQ3f43JOiZeSgmMloZsfyb2uh0vPw3yAgX6QKdQ3qmio40InlIyhR+AFUDY1gphiZ5AAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAVCAYAAAAzWHILAAADqElEQVR4Xu2YWahNURzGP5kzDxkyjxluKPFgeJChZAhXxqKbDJmHjCkuCZHkgXgRhTImRChXCsWDBzyQQvIiL54Mhe/zP8teZ52DfW7HPZt7vvp1z1l7nb33/a//+q9vLSD5qkEmkVNkYHCtPplG6gTtTvptC9I09b0mqR1dLqqEHIYFZR85RGaQMnKLDI+6/pSCvpY8JJvIUlJO1pMhXr+V5BF5Rm6TCnKPHCTNo26oRbYhve9Q7/o/q9mwoEgjSX9YJg4gS2DZ6asNuU5WwDLVaQR5Qtp5bdIOchTRffR3HbkIGyRfB8hZWLD/C02BBUAaS3rDsngjbMr7Uvtpsh+ZQW8Ly8h6XlsDcpMs9NqkrrCB0EA6NSJ3kNk3tsIalQR1ISdIR9hUVzaVkmF+p5Q0EG9Ij/AC1RqWvb4UxKfIrOVqfwsbTCcN6nNk9o2l3eQz+UZWB9cKLWXdeNKSdIeVA015/aNzYBmoxND0voL07PydFLzHsPv6GkXeIT1zJyJ739jSyH9B9qxIgpS1W2GzazTZDMuyZaQhbEFyJSSUZkDdoC2st377fdLEa1O91QwK+8aWbvASmUU/KZpFBqc+610npD4rk5VRylq5g1AKkkqKvxC5wQhraAdYhipTnX7VN7Zcwc5lWlWl+pL5iDLnGKLgqow1I4tgQfAzTuWjjPTy2qRs9Vb26yTMuvkZqnr7ggzy2nKSbvAeke3RzXvCpl9oSapaer4y0g+avO5iWImQdVJWyi1o7ZBXlYUTu5C5wM0jV8lH2FQ/Qs6Ra6SP10/3XA6zdp/IcdLPux5bepGvsGKulywne2B+r9ALnDytv7hIescFMHvVPrimaaxFUIGvdI3Mp1y97Ua2wP4hBfVP7kGrt3ZCr3Ng5o9fVhOpXj2AFXJtNVUiJJWFVTCrUwhpYJNMLLl6+wGWvSoJjf0ORVVevr/VNNfhxAXEcw1ajVvBalxcVBOrjUJ/K5ujMqFyMY7MTbVnk0qG+kzNAVd28i0tXrJLY4J2LXjacGxHuhtQYkwmO2EOIu+uyBlk/7RHwdV3PWwvbHeTdGmDcRl24OLspKTAXiKdYVbuDMwzS2vIBtigTIe5o7y6i06wQwoZZycdjOgA5HyqPa8P/MtSYvjBlcVUm5OuaXurWXkD0SZC5eoubHORNylwepB/9ikpo5N0OhZXYXBV8sLgalaWIP2US8HVji2p5yqJUBhcfQ+DWwELojy3H9xXiLbURWVRYoL7HTWV0VYvD072AAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAVCAYAAAAOyhNtAAACj0lEQVR4Xu2YT4hOURjGH6GIwVAkU0akLJTCjrJASSL/ZUFpahYiFpSNLDWTwooVC7EQScpKykbRrGal5E/YoYQ0GjzPvPf2nXvcc7/zTd17v8X91a/mO+fce7/7nvO+53wDNDQ0dBlT6AI6z+9oyHKRjtG/9LTXVydT6X7a77XHMJMeRf7kr6b76ELYIplNN9LD7qAidtPfdIPfUTF6yR30Mv1If9C1mRFh5tMD9Ab9St/Rxe6AhIOwheH6nq5xBxVxhb6lS7z2qlGwttFN9Dw6D9ZOuo7eQThYmozXic/pSTonM6KAHvqMPqIzvL46OYvOguVyE8XB0r0nxSr6Ga0bKI9X0i2wma6LrgyWCtsfuplOpxfoEH2Aegt+mcFS/2NYKr6hA7ANpS1pvVoOqxMqdApSu91xBX0JK46xHpq4Mo4yg/UEVuOE3uMDPQPLqiC99AUdpddgKSmUhqforORzHZQVLNVltzYrQLdgAVvmtP9HWq++wVaXUjB6ZyiZsoKVh8Yrk7QTB3HPV1qOr+h9xO2KynEd7PSFYtUBMJYygqWM0fntIbKbVxospWgQ/3yli5SWSs/t9EjSnodSVGP2dmCa5jEUBSudqNCkhoKle+mebrDSNAw9awLN8lN6l05L2vQQfdaNhtEmh0tGwfpJ1/sd5BhsJdxG67u76D1Ug/q89rmwwPQ7bfpbu+J12Gkgl6X0Ez3utO2BPeRe0q6oV4lWq07fX5D9OaLveckZp3T5BXvJdPVopelw/R2t68Zh7zOYjBE64Y/Qc/QELLP0TAUyiAKhdPPPF1pxeT9Auw2l4FW6yO+IQJOyle6CrayqF0XlqESoVOSlYYODskGB0k+yhjaoTuk/DJWkzz/hvJYcbieoYgAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAVCAYAAADvoQY8AAACO0lEQVR4Xu2WMUgcQRSGnyRCEiNoEIwoCDYSCWgQu5QpDIKdEBGxEDV1Cm3TBBFSiSCoIBYWgXQiWEhMn8LKRghcRBQsDIpJoaD5f2efmXs7u3t3NndwH3xw7tvZcWf/N7siVapUSeMtvCnAP7A3GqOMw1PJP+/EO3YBl+FzHWAYlvh4jnnvn1QMa/AKvjbHH8BJeARfmBqpg9vwGHaYWhfchfuw3dSUGrgKr+EbUyuKRvgD/oTNpkaa4CZssQXQBg/F1R+ZGnkJf8MFcf+wRefOwdb8UnF0w3P4FT6MjnFCrjLhTSzCp9HfPlw9ruInW4jgmO9wT9x1LIwoo+rPXRIj4vL4wTvG6HwWdzMNcCj6bZmR9CjoTfBp8alZQnOXxIrk9wP7YBZO3Z0RhvFhjEL9oDCejOkvicdR+yHUi0WhmeRqsHm5O/D3X9jnnReCGc5Jcj8QjQvn4Fw+Wb1YMKFMMkrccUIZ9snqB8KnyUWZtwUJz60wDU/MsUQ0k8y24vdDGln98BhuSfgdQ9L64Z24qGWSlMla+b8zJVFIPwyKu/a0xBckaW6FfZrVk7fcJ5NZ7wc+TV53SdyiWJLeDz3ibo6LswHHvFqQtExm0S/hfuATnIBncE7CN0DS5uYC7EhGTzLD3ImYR5XfMMzvM++8EKPivo903CU8iOQ1uLtxJTt1gIHj7dy8Hr/DFPbKusQjWFFwJyuoH8oV9so3ce+oV3Agv1wZcFv+Aj+K23qTeqrs4Yuu3h70+QfZ/ZLDJuIQzAAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAVCAYAAACkCdXRAAABGklEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFBAPANX2MzT+rYnaAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAVCAYAAADvoQY8AAACTElEQVR4Xu2WTYhOYRTH/0IR8jW+okQRFqZGkmIjCzY2UoooC2SSWBhZKAtNSskCJZJEEaF8hSgsFCtZSNlaWsjYWPD/Oc91H3fmNWpm8aj3X7/e+97n455znnPOvVJbbbX1N603P/6BPrMsrSlWl8x3s6pxf6TZaT6ZxY2xojTZvDYfzYzGGOow98ys5kBJ6jRfzA0zKt0bYcala5w4a8an/0VqiyLvD2T3SJ0TCmcmmU3pulid15/1QB30ml2/ZxSuqh44CYr3a7r+ZpZn84oWbZP2mdcDqfREUQv/hap66Mnu5fVQvDDyovq/H0ar7kzFa7D3Q1NLFE4fNWvMlHSfYKwzl9P4QtNl7ii+CNBERaOgTU8zp8xes1TRWK6Y+WaHeWC6FcEcVAPVQyttMDcVRlDw7xUPxYGD5rDi9G6ZI2a32WiuKbrd2jQ2xmw1q82HNIc9SOd3Zq6Zap4q3l8txYZ0ovzb6LN5qDq6uYjic0W0EeuJFkavNG/NbIUxrJ9uZipOhZpDOAlogWKvR4qgVGldzSU4LxR7Dps4MQydk/4TtWPZ9UAniQEYgkFEn1PA+Ur5HqT1Y9UfmJvNVfXfc0hi89uKqI019xXptcccMqfrqb9ObZFizV0zQeH8K7PCbFcYd12xB2LuS0VLr8ZwhLSbl+YMWRh/zuw3JxXGnVE8iBwmytsUxXhckVI4gzH7FG//N+mXPKeJPFNtIPuQTqQVTlxQtHiKfNjbPFGlSPOPQ1TVQrObMJdUYTxv2831GJ6nDut4Vkv9BD+/apMbkJ9rAAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABOCAYAAACdbkoxAAAFhUlEQVR4Xu3dT6imVR0H8DOU0Yya+Qdl1CBEoX/qohKUwlFcCYlIkBG0aOPGNoFI0cLN7EQxWrmZGUVQTFxpi1xcdCMoLqJIpKAigooKggKtSc/X85x5n/t0n+tI8773ve/9fODHfZ9zzr3z8szmyznPc04pAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAK/DNWqdr/WG4vm34/Fat430QAAB769Vab4+uj9a6YHQNAMAe+2Kte2vdM1x/Z9QHAMAeu7rWoeFzZtkuq/XwohsAgL12x+jz32t9qdZ3R20AAOyhj5fts2k3l/bCQWbdAABYA9fVemR0fbjWC6UFOQAAAAAAAAAAAAAAAAAA1sFjtZ6p9e6oTtR6fKaer/Xf0dhf13qgeIMUAGDpXiqLELbbeaE5ruqfZTG2n4YAAMCSJYh92MC2tb0LAIBlEtgAgH3tU7X+WFpIeafW74fqbf+u9ZUzo/enZQW23Ke/lTY+P/u9622vLYa+7xujvj+Xxfj+3c5fDD3jjdKOzkp/fr65vRsAOCguq/XLWg9O2hMgEmASZPazZQW2yEHyO92jt8rOf+Nbpd3r3PPuE7WeqvXiqG0sY/OdAIADLCEigWAcIrqf1bp42rjPLCuwfbTWT2r9aNpRWvg9Pm2sXql137RxMDfLlvEJeQDAAZalu/EMTpZA+1YW05mj/WhZgS33KUvGnx219ZB2fa2rRu3dXDCO9N04aeuzn3MhDwA4IBJSEjzicK2Ti66NsKzAllm0jO0zkNeV9szZbjJ+bruQ9F09aevfab8/RwgA/B8SHhIUXq719Vq/KO3h9nVw9Czq8lof6b8wY1mB7beljc19S+V38yzanMzE/WvaOOjPqU3D3ImhPcuvAMAB1YPC94brr9V6YdG9EZYV2HIqwj9G16fK7kuXd5X5Z9Hy8kL+3lTG5/uMHRvaAYADoj/Q3p+rSqBZl6OYprNpO9VezbDlHmXc+IWDLI3OfZcLy/wLB5+v9ZdaN007Svs3fjNpS6B+aNIGAGyoLL9lCS9vOs4tuSWA3F/amZxP1rp0aP9cact1P611Xmkh4umh7/bStqq4qLQw+MPSfvfHQ98TtV4fxu6m71O2WyXMfLX/woxlBLY8a5ZxecP2bGQ59K+1vjztKO3orNPTxrJYrs7/Txwp7XzUjP1VrSuHdgBgQ2WGKMufedng3tJmq3aaHfpTaUt5CXR9NinPuT1UWqC4pdY9pYW3VALR1jAu7QkjXULGFWXx5uOqnOvA9slaj5Z2OPwXhus5uUcJuc+V9nezUXGfHcz9zGbFt54ZvZD+O2v9p9bdZfv3Tjhel1lQAGANJHBlb7C8pZiluxtq/a60QDGWtsw6Jdxl1ivjEvLSHlku7MuBCSqZNcqYVTjXgW0vXVPa826RN3oBAM4slz5e6zOlzawlkPXtJ66t9bHS9nJLKMuyZ2aAfjD053Nkf7G+HJjZtSwlfnu4XrZNCmwJawltue/TN0oBgAMqy6TjFxK6fM6za93cuL7MOh3bn4VbhU0KbHFJEdYAgA2zaYENAGDjCGwAAGsuL0z0wJb90ObkGbucRJBxeSYPAIAly55l2T+uh7Veb9Z6oCy2xpgbl207xuMAADjHfl7+d6PdXtnkN9uVfJhxAAAAAAAAAAAAsGyfLu18VQAAVuRYaYfOf5C8Dfr90g5cPzXpAwBgifp5pmdrqwhsAAArcaS0PdZO13q21pXbu2dtFYENAGClzLABAKyxa2rdUeuGWodLC2M71cmykGuBDQBgRRLWEtoerHVo0jdnqwhsAAArdcm0AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANbNewVCTFUg+28CAAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAVCAYAAAD8dkbIAAAC0ElEQVR4Xu2XS6iNURiGX7nkmuSWXDpkQG5JkjBjYMDAiDAmmVCIUlsyMHMrAwYkRGLqHOKUMjAyMzIglwwkhUIu73u+vc5Z69v/XnvtI4Nd+6l3sNe3/u//11rfZW2gS5cu/4HF1AFqrDeUMI16Qv2J9IPaGM0ZQ910cw5HduH9fKKWJjPsmdjHG2pZMqOa0dRtmP9JztYWW2AvvuoNdUZSN6hjsJc2Yyv1GearlpoGmEM9pRZ5Q4Zt1G/qFTXL2dpiFfWVukONcjaxhrpGjfMGR43aAzulF9TMxAqsoC6h+h1VzKAeUR+o99SC1NweelhO+qmJqWlgYVeolW7cM4G6DDutC7DT3J7MAHZSB91YjkPUXliE6RB0GMNGO/4S1SGxizpBjXDjHm2UTknFYS31nbqP9PRPU+uj3zmWULdgm65F/kT5s5XIUT/1EVbJAj3UPVjYtGIzbOeFFqYFaqFasJgC+2gfwlUonM9SG+q/j8AiQ7Vj2Mip8vEbtbo+ppPTzquYlFBDWpUVqvowha58afMuoiwfN1FnMDQ3LFLh/k8on+Ld0i7qA3PVNBDycXY0phNT8VERmo/yfJwMa1kLozE9q2/TYj3jYdW/iLBb+pCqF+WI8zGmBvO5H+X5qEIT99NY56J5Qt+ptCguSOpHcnQKtlC1glIU0kf9IGyT3sFaQC/s0pCjB7a5U914aHG+j6sl6ZLQyu8gyic1XYWYeqJvJTlqSPMxoFwM7aRZDw7IpjxUPnrCIh/CUkMRoyLXR72GFam5g7MzBEeSmn8p02GntNwb6oR2kosM5dQOWIVXCHrmUW/R2McVvjm/Dag/qk+eROueKNRWniHNmfNoLAJqJ3fRPB93w+7LwcdzDIWfTk1t51dk/0Idh7Uk3YZCNyhCVXQdzHEnoJb0GG3kYyeitnIddjj7UB3mHY8K1APYP6NW9+qORqmVvaz8BQnIlG9g5mK2AAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAVCAYAAABG1c6oAAABXElEQVR4Xu2UvS8EURTFj/hIZH0mYqMiopFoRESCVVFSqPV6CRKdiEIrCoWCSChIdKJ8idIfoFKoVEoKBc7ZN2Peuzu7jCid5Nfcc3Nn5rz7BvjXX6iP3JKPgDcyH/S0kXPTsxH4uVqEbzyxRqJmcka2SKvxcjVBXsglaTGeNEVOSbs16mmYPBFHOmKrOuSYjJt6Q5XJA3kkA8ZbIdukydQbSm/lyDMZDepD5Ir0B7UfSbkpv1cymdT0RntkKW0qqiP4k9aJSxVygPhUu8g62SFz+CaGTfiBa6QbfvdGAl+xXMCfuB5ySBYCv0bL8AN34YeuxjZmyTWyLdCX1FuzqnQ73sk9/M7Z9dEDXFDXwDvSmzZYpcst9FlWisQhHpi3Zl+SoQYFnhd24YEKeoaUrJFIGTvEA/Vj6UwbimqM3CDLTJnuZ3ZxKQbtoK7hNPwNGow6fqke+Ltf8xv7BLLIO+BfwEadAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,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>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,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>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAAAVCAYAAADVcblPAAACgUlEQVR4Xu2XO2hUQRSGf0kEg28SDIISHxARiwgWQTBgEVFBLKxE04sQJLHQxsem1kB8gI/GRLBQQQQLBVOINoIWWhjBSiSNhYiCKbTQ//fcm7s7O3d2L+gVl/ngI5v72rlnzjkzC0QikUjkf2QxHaW97olIMY7Tn/SIeyJSjC66ky50jrc0bXQVXeSecGhPbFmW0b10bfK//u6jq+evyEf3fYGVobxD19RckTFIt7kHHTQpumZH8rlsVsDe22c3AhWyhF6jY3SWXqRX6Ek6Q9dnl9axhd5Fdo2+5DDsOSdoR3JcLKeTCD9P90/Q0/QFHa89/VfRd59HlhB5KnG87IE19D76ld6gK+k0/UQ3Z5fWsR/+DFOGX4I97zadoh/oMF1QdZ3LLnoKdv8T2L1lZKXGVIGNuYcepOdgWahju5PPal+54zkKC+IB+gNWUnqwSltBDr24WoAyOg+d1yTJtG2ESMeync7BXiiEskjl5pagz1AQNLYhZO+qzFQb0hZMiZXXqryopN/AVssipPu9l7DS7Ud+8BWkje5BDxVYewi1AbGVXm/SC3Td77vCaGIe0w2wAD6FTURTLKXP6C3kB8GHsvEhvQnLnmP0Hb0H/yymLSSEJlITehnFxvKn0Hs8gO1A1LZeoUAg1QfVD4tuflX6WlyqUfkcoh/pGVjPkWdhAc9d9RL0zO+w0toEy86y0OL4CLbQCgXyPRpP/jzV/bEICphKwIdmUavuZ1hgtBprEWnEVdiK3Qn7daMFqCwGYAmVxkGB/AZbJJuiQl/DBv+v0U5A/fE+HUG55a1JfA7bqgn1y7cosA1TPwitvmWjsWhjXDa+OCiojdpRJBJpTX4BvuxnsyEu4D8AAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,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>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAVCAYAAAAuJkyQAAABrElEQVR4Xu2UvStFcRjHv/ISecvLQEKYTAaLsFEob7EomQyyyUImLwmDxSIWSUoSA2FQkr/AwCA2q8Vq8f32nOMcv3svNy83w/nWp3vP8/s95/ec5/meA0SKFCnS/1AB6SKV3rV+u0n5+44UKo9skDnyRNbIOpkid6Qm2JoadZIx0kBeyBYpIhfkmdQHW1OjcVgxA+SVtJI02MhUrP7/pnTWPbkm+c7aB2lUt6TUXfgDaSI6L6FUqSrexe93xFUGOSDD7kJY8on8osrjqYfskxayTBZIjrem3yHYIaukMBTX/ZQnOzR6cU3gEl94M+wfVxVklMzAbt5BHkk17PAjMujt7Yd9PvTmniDwoDq/6O3RGVewFyehZskNKXHiUjGpIsekl2Qi6II68EBGYJ8Jv0Pq2CmsS9mwXBXq53zqH0lJeqpEUpfksVonvk1WEOs7xdVRKZyblH+SUTs5I7lOXE+qzvgqg41SBcl3ksam3DbSB/NPM8wG39YkbKyudPge7IlV2DRsTPLZDpkgm+ScLJE6ckjmSRN+oCyYd+IpHfbmuOu69jsazg/HY/QG39hA4Sf+FagAAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,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>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAVCAYAAAAeql2xAAACwUlEQVR4Xu2X26tNURTGP7nkfs8lIuROklJElHvhgZI60SlyKcmlKLdO5IVEcktKHhBJSm6RSyTxzJs3f4MHKb5fY8322rN9cDp1yj77q1977TXmWHPOMccYe22poYYa6kzqY/aaSbmh3rXP/DLbc0O9a6hZbLpn9xuqN3U1c8yC4rpTiLQ+Z46aT+ZMtbl+tcwcMf3Na3NHneTUd5pZZp75bjZWmztMSwrao27mtPlp1mW2VtVivplx2f2OEAs+qci+9opfpldmam6oJQZ/NhdMl8z2v4kG/cYMyg21tNL8MEvNZMXpozXmrplutponplnVwZlgzpoHZrOiP7TmxxvhNUUfSW+HI8wlc1zRaDn9beaKmWgOKfyXF+MRc6w3980mM1/hh3j5Ol9c/1VMQkcfonh7I+VGmS2KiZ+ZwWakogHyieYqNoyNYFw3Tart99XsL8Y1KwKQrukx781YM9usNjfNZdNL8VPLPH0VG7xodin8medecR+4Zg3/pLWK+ubhexQPZMFjzMPCjljAO0VpDFAsNtnQDUW21PJ7rkr6Uc8HFQvlVBlHhvB9mCIbmAc/hJ3n9VQ04Y9meGHjdDks1Kb6TiKaA7N7nPpbM774TpRTGrGoLyUbm2JBLDL34wTIBgJKwAgCG0Bs9paqf03KgcKH3pP+PxAwsoH7rPmxoq5Rm+r7T+JBPJgJ0iQLzW6zyLxUlAeiPB4pNlb2SyWQFo4Nv2mKkuB0PpgZitpmfDlQKYjYKZXDis0j7uFLEAlcqu9VauOp5yKFWoprNnFb8Ya3QpU3PtKW8qBmaVSo7EcgnqqStiySZnVCUdM0UwJBc5tSjLmqSgaMVjSxY4peMFNRxzsUvemFOaXY6AZF9hxQO/9o9VD1A+imvUvfUcqGsnI/arMs/vfn9vIY5mCuJMbyzCRs/Vqxcb/sW1O/AdlQdSC4rzSIAAAAAElFTkSuQmCC>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGMAAAAVCAYAAABSQFBJAAAE3UlEQVR4Xu2YacimUxjHr8mSsRuyNLakyRbJlobxfkB8IKFmig9To4RI9pR6kSJLwlD2JaGokeGDpMdShIRsWbI0RkwoRcM0+P/e61w9133mPK+ZwbzPq+df/577Pue+z7nOtd+P2QgjjDDC/wK7iFeK29YTBZuIO4mb1RMj/LuYIV4rLhN3reY2Fx8X/xT/EI/tTk+8e0oh1yP8Qxwi/lLIdQvXWdtYB4k/i8/a1EcNzoCcD9rUy7JemCk+In4trhKP6k5PgIOh7JbCSV9j4g7V+FQAGT4Qb6snpgtOFW8UrzBPRSd1pyewl/itudcNMw4TfxXPqCemA3YUnxJ3Ey83N0brINSJ38tvBu+dKG5djQeImkPFeeV6C+unOe4ZJ83lWsP1duJGaSzA3J7m9SnWBDQdNCCXmqfMMfOz1WvU8gwVEP7Mck1EYAyMUoOIIDKIkAAR9ZC4WHxX3D7NgWPE98SLC18VPzM39jbio+Il4ofiovIOGBN/Eo9MY2CO+Jp4j3i6eTS/Le4tXiQ+IK4o5PoG68qU5TnPfC32wZmmHPub14oty30Yo05FrXqB191vfliMt1zco8yBw8XvxPnlHo9GOdEgnG1uFKKEpmC8PAfY/3PzNjqAN38vXmb9KNpKfEW8o4xNVi9qeQD7TNawbDAQohzi6DRG4aaA4+0ZrXqBcs4y9/DXxcfEjcscxu2VceYBysJbURZKvso8rSwwz/ERBaSxF8Qnbc313rCup8c45HpQvWjJA+41lyc3Hux5jfiO+In4kji3zLH3E2Wc+Z65Mywxj9r1xnHiavNIqFl3TIPqBUCJKAClBniO75FsPGrAm+YGCc/m4BgxKykMn1Nlaz0QkdAzVzjR9oO4b3oGtN5vyZNBdGWHCPAeTnFyGlsovm+eLdYZHBwlkGsz8NSvrH+4QKteBBD6I+umFBRZfxzGdwwKC8wWv7SuklqGb60HIpLHzRVKDULBKCyj9X58G2V5ApH+WnO8R2RkgxOJg/Tzt6DYtTYKY+R8nesFHcv11g9rnsEQGITnKKh4B4fnoAgeQOA6P4eBciuNYZaZ1xKKLCkCeet3Uf6t5sWa2hdRQuoBpJRbzJ1qkDxENKmNOnJamkPRn1q7lvBez/rOOqvc0xS0ImwgeBhvIt/tXs0BIoYOA4NgGIDCMQ5KOsC8c4rQPUFcab7mEeLV5nsw/qP1D0Nhx5vq/BzeSVcG4rmeuVFRNs+zDuuxbuB4c2+Md1EgKQplIcOFaW6QPJyT1vx263o6KYi0k2UNYGw6uHHxefMOcZ/8wNqAQk0bF3WBg+yX5vEi0kPMc32fuKl4s3lLutS8KwngvbS0jNOVRd6nObjJXFCaAQzM3nV+5rm7zKOLvUidRAFKfdG8QQC8c655xLDe0+LL1pWffxEeFt8yz/XnWH+vWp5nzCOBfxyeMzdclotIJ+XVnl7XC6KPtJjrx38OhGLjXEcCHBQPqj+uAGmN9w62wfkZ8Fz+QGOf1j/HpEIitiUHmExOEPKEklkv34PovFqyElmkr4iiaAJazw4tcn4edqBo0nJL1rpeRJql5uGQO5fxoQSeRyrj75ZvzIXPLfMwgTp4gXkd+M085R1Y5qJx+Vj8wvxfizgbKfb8Qu6HFnzL3J14p635DTDdEalzrZ3sL8rDFzKMwuVlAAAAAElFTkSuQmCC>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAWCAYAAAD0OH0aAAAAs0lEQVR4XmNgGAWDDbACsTgQS+LAAgilDAwGQPwIiP/jwXuAmBukWAWIDwCxBxArAvEKIDYDYgcgnsWAsIEHpBgESNYQAcTKULYmEM8HYg4g9gTiSpgiXCAHiFuh7CogLkeSwwD8QHwIiF2g/IUMBDSA/HALiKWhfJCGOQhpVACKg1VAvAaIWaBiIA3XGSBxgwF0gfgdAyQAYADkn5dArI4kBgeMQCwIxMxIYiBbQf4a7AAApuset2lMAgYAAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,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>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAABKUlEQVR4XmNgGAW0Bp5A/J8I/BWIjaF6iAYLgfg3ENugiTMDcRoQPwNiTTQ5vEAQiE8D8V0gFkeTAwERIN4KxJLoEviAPhB/AuI1QMwCFWMEYm4oG2TodCDmgfKJAtEMkHArQhIDebWHAWK4ABCHQtlEgzkMqOEJCsd2IE6HqyARwMIT5FJQZHyBsr8BsSmSOpIAKJmAkgtyeIK8vocBEpbYgC8Q26ELIgNYeJYjiSGHJzoAWdwKxK7oEjAA0jSfATN9sjIgYp5kQCh9ogNVIJ4NxFUMEIuxAmzhiQvIAHEelD4DxLqo0gwMLgyQmEbO2++AeAcQCyGpQwYSDJCIA6WIfQwQX1INgNIuKB6wRSJZABaxoBRDNQDy/hEGMopAfABk2G4GLOEJACPXOMMXJloVAAAAAElFTkSuQmCC>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAUCAYAAAC07qxWAAAAq0lEQVR4XmNgGLqAFYgTgdgaXQIdeALxfyCehC6BDriB2BWI+dAlSAbMQGwMxHYMEHdiBfxAvAyIi4B4IxBvBmJOFBVAIALE1UDMwgBx3x4g3grEHMiK0IESED8H4ip0CXTgAsS/oDRe0MoAMRFkMk4AchPIbdRzHyjq/jLgcF8qEEczQAJ7ChBfB2JxFBVQ8BWI1wOxEwPE2mBUaQRYCMTngXgDEGuhycEBALpcGMcGeMTkAAAAAElFTkSuQmCC>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAVCAYAAACZm7S3AAAA6klEQVR4XmNgGAUUgSQg3g3EwugShAAHEG+FYhCbJCADxE+AuBVdAh/gAWJJIA4F4t9AHAHE4kDMiqwIF4gH4llAfB+IfwLxUiCeBMTKyIrwAZr7VxSIsxkg3kQBLkD8C0rjAvpAPIUBi+YqIH4OxEroEoQAzL97gJibARLKXQwQr4AAiA9KPGuAWA8qBgciQHyVAeHfICAuAGJGKD+OAaKpHIhnQMXgAKSoEYjvAPFKKBsWxyxArA7EzAyQKIyGimMAASjGBkCuOwLExugSxACQJlCGEUSXIAakA/F8BkQ4EA1AGkAaMfwLAJZcIMYYEV8oAAAAAElFTkSuQmCC>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAVCAYAAADWxrdnAAACW0lEQVR4Xu2WTYhOURjH/0IRQgrTkNdHCgsiCxqRLNjJRynKTrJjg0nTbCwtfJTUhBkrsp1GVqJYKFtFComiLKZh4fv/7znPe+89zrlzRxbS+6tf773n3HPveZ/7nOdcoEOHv85Muo3uo6vo5NA+gy4Kx/8cq+kjOkZv0hN0iN6la+gI3dG+2thFfzZU9xPb6Qv6uqHxMytMpWfoF3qKTq92YwsdpW+Qj/wg/Up7ovZJdD19RfeE80uw4LTCuRigP+jOcK63vZW+pBtD229o4pdhD94b9TnT6HBQxzFz6WPYg7qrXW00OUVwAb1F55f6cuOVvjeQDxiOwl7paRRRSKHI9saNgbWwN3ObTglt+l0HC444H67THzge2pzUeKE/dYHOKrW1WUHf0ud0cdQX45FLcRAWgJOlNkVQY7TIhVJmDt1PV/pFgdR4MY8eQSao/bBBZ6P2FLNRRDFGk/xGd9MuuoReQbP7Co1PrZcsyqd7sEWSi2gTPF+/wxa0qsP7cN7kvrl8r0URUgV4R5dFfRNhA/2Ear4qR7Uo/b6qHMm8RXr8uPjkpY7r0KLeHDcGPF+9hgtVlIsoKtMBeqzorpDL91r8dY03eS2aq6iWNkcL6Rrq89XL3dK4A83GZzmH6sYQo5srorn67wHQbqlopzgEewupivFH+e6oKjyj9+nCqE+7bB+sJqceLOryVSVSu/UHuinqc+rGN6JFH9LP9Do9DNtQHsC+QVITVxXR/uDfLOVKI/WZ4X13UP3cUI1/Qj+WrpH6nnoK+0MTQhNsweq0XI7iS7JDh/+BX62IjtExJPyjAAAAAElFTkSuQmCC>

[image29]: <data:image/png;base64,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>

[image30]: <data:image/png;base64,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>