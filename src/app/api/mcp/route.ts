/**
 * Kitsune Finance — Servidor MCP Nativo (Model Context Protocol • JSON-RPC 2.0)
 *
 * Inspirado na arquitetura MCP do Ghostfolio (`apps/api/src/app/endpoints/mcp/`)
 * e no Pierre Finance. Expõe as 5 Macro-Tools Determinísticas em TypeScript
 * com isolamento multi-tenant via Supabase RLS e autenticação obrigatória.
 */

import { NextResponse } from 'next/server';
import { createClient as createSupabaseJsClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createClient as createServerCookieClient } from '@/utils/supabase/server';
import { loadUserFinancialDataFromSupabase } from '@/utils/ai/dossier';
import {
    toolGetBalanceSheetAndXRay,
    toolGetIncomeStatement,
    toolSimulateDebtAndCards,
    toolAnalyzeFixedIncomeAndGoals,
    toolAuditAnomaliesAndLeaks,
} from '@/utils/ai/deterministic-tools';

const MCP_SERVER_INFO = {
    name: 'kitsune-finance-mcp',
    version: '2.0.0',
} as const;

const MCP_PROTOCOL_VERSION = '2024-11-05';

export interface McpToolAnnotations {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
}

export interface McpToolDefinition {
    name:
        | 'get_balance_sheet_xray'
        | 'get_income_statement'
        | 'simulate_debt_payoff'
        | 'compare_fixed_income_br'
        | 'audit_anomalies_and_subscriptions';
    description: string;
    annotations: McpToolAnnotations;
    inputSchema: {
        type: 'object';
        properties: Record<string, Record<string, unknown>>;
        required?: string[];
        additionalProperties?: boolean;
    };
}

class CallerFacingMcpError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CallerFacingMcpError';
    }
}

const READ_ONLY_ANNOTATIONS_BASE = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
} as const;

const WITH_VALUES_PROPERTY_SCHEMA = {
    type: 'boolean',
    default: true,
    description:
        'Se false (Modo Zen / Privacy Mode inspirado no Ghostfolio), oculta valores monetários absolutos (R$ ••••••) preservando percentuais, scores e prazos.',
} as const;

const PRESERVED_METRIC_KEY_REGEX =
    /(Pct|Percent|Score|Months|Days|Count|Rate|Index|Sigma|ZScore|Year|Month|Day|Priority|Severity)$/i;

function redactMonetaryValuesDeep(value: unknown, parentKey = ''): unknown {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
        return value.map((item) => redactMonetaryValuesDeep(item, parentKey));
    }
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = redactMonetaryValuesDeep(v, k);
        }
        return out;
    }
    if (typeof value === 'number') {
        if (PRESERVED_METRIC_KEY_REGEX.test(parentKey)) {
            return value;
        }
        return 'R$ ••••••';
    }
    if (typeof value === 'string') {
        return value.replace(/R\$\s*-?[\d.,]+/g, 'R$ ••••••');
    }
    return value;
}

export const MCP_TOOLS_CATALOG: readonly McpToolDefinition[] = [
    {
        name: 'get_balance_sheet_xray',
        description:
            'Calcula deterministicamente o Balanço Patrimonial consolidado (Ativos de Liquidez + Investimentos - Faturas/Empréstimos) e executa o diagnóstico X-Ray completo (Kitsune Score 0..100, cobertura de reserva de emergência em meses, exposição ao teto de R$ 250k do FGC por instituição e custo de oportunidade anual em R$).',
        annotations: {
            title: 'Get Consolidated Balance Sheet & Financial X-Ray',
            ...READ_ONLY_ANNOTATIONS_BASE,
        },
        inputSchema: {
            type: 'object',
            properties: {
                annualCDIPct: {
                    type: 'number',
                    description: 'Taxa anual do CDI em percentual para cálculo de custo de oportunidade (ex: 10.65).',
                },
                annualIPCAPct: {
                    type: 'number',
                    description: 'Taxa anual do IPCA em percentual para juro real de referência (ex: 4.42).',
                },
                withValues: WITH_VALUES_PROPERTY_SCHEMA,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'get_income_statement',
        description:
            'Gera o DRE Pessoal / Fluxo de Caixa Operacional puro em janela de N meses, auditando o padrão de renda (CLT/INSS/Variável), ignorando estritamente transferências internas (funds_movement) e pagamentos de fatura (cc_payment), abatendo estornos (is_refund) das saídas e ranqueando as 8 maiores categorias e estabelecimentos.',
        annotations: {
            title: 'Get Operational Cash Flow & Income Statement',
            ...READ_ONLY_ANNOTATIONS_BASE,
        },
        inputSchema: {
            type: 'object',
            properties: {
                periodMonths: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 24,
                    default: 1,
                    description: 'Quantidade de meses para consolidação do fluxo operacional (default: 1 = mês atual).',
                },
                withValues: WITH_VALUES_PROPERTY_SCHEMA,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'simulate_debt_payoff',
        description:
            'Mapeia empréstimos ativos, faturas de cartão e parcelamentos, calcula CET via Newton-Raphson, simula o plano exato de quitação Avalanche vs. Bola de Neve com Snowball Rollover (juros economizados e cronograma) e avalia matematicamente se vale antecipar parcelas de cartão com desconto frente ao rendimento líquido do CDI.',
        annotations: {
            title: 'Simulate Debt Payoff (Avalanche vs Snowball) & Installment Advance',
            ...READ_ONLY_ANNOTATIONS_BASE,
        },
        inputSchema: {
            type: 'object',
            properties: {
                extraMonthlyBudget: {
                    type: 'number',
                    minimum: 0,
                    default: 0,
                    description: 'Orçamento mensal extra em R$ dedicado para acelerar a amortização das dívidas.',
                },
                annualAdvanceDiscountPct: {
                    type: 'number',
                    minimum: 0,
                    default: 9.85,
                    description: 'Taxa anual de desconto oferecida pelo emissor do cartão na antecipação de parcelas (% a.a.).',
                },
                withValues: WITH_VALUES_PROPERTY_SCHEMA,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'compare_fixed_income_br',
        description:
            'Audita cada posição de investimento pela regra DU/252 B3/CETIP com feriados ANBIMA, calcula rendimento líquido após tabela regressiva de IOF (0..29d) e IR (22,5% a 15%), compara equivalência tributária CDB vs LCI/LCA isenta e projeta o poder de compra real descontando o IPCA composto pela Equação de Fisher exata.',
        annotations: {
            title: 'Compare Brazilian Fixed Income (B3 DU/252, IR/IOF, LCI/CDB & Fisher)',
            ...READ_ONLY_ANNOTATIONS_BASE,
        },
        inputSchema: {
            type: 'object',
            properties: {
                annualCDIPct: {
                    type: 'number',
                    description: 'Taxa anual do CDI em percentual (ex: 10.65).',
                },
                annualIPCAPct: {
                    type: 'number',
                    description: 'Inflação anual IPCA projetada em percentual (ex: 4.42).',
                },
                cdbPercentCDI: {
                    type: 'number',
                    description: 'Taxa do CDB em % do CDI para comparação de equivalência tributária (default: 105).',
                },
                lciPercentCDI: {
                    type: 'number',
                    description: 'Taxa da LCI/LCA isenta em % do CDI para comparação de equivalência (default: 90).',
                },
                comparisonCalendarDays: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Prazo em dias corridos para comparação customizada CDB vs LCI/LCA (default: 365).',
                },
                projectionMonths: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 360,
                    default: 60,
                    description: 'Horizonte em meses para projeção patrimonial em poder de compra real de Fisher.',
                },
                monthlyContribution: {
                    type: 'number',
                    minimum: 0,
                    description: 'Aporte mensal em R$ para simulação patrimonial (se omitido, usa a poupança líquida real).',
                },
                withValues: WITH_VALUES_PROPERTY_SCHEMA,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'audit_anomalies_and_subscriptions',
        description:
            'Executa auditoria forense determinística sobre o histórico operacional para detectar assinaturas recorrentes (com custo anualizado), cobranças duplicadas suspeitas no mesmo mês, tarifas bancárias/anuidades evitáveis e compras por impulso acima de 2 desvios-padrão (2σ) da média histórica.',
        annotations: {
            title: 'Audit Financial Anomalies, Bank Fees & Subscriptions',
            ...READ_ONLY_ANNOTATIONS_BASE,
        },
        inputSchema: {
            type: 'object',
            properties: {
                withValues: WITH_VALUES_PROPERTY_SCHEMA,
            },
            additionalProperties: false,
        },
    },
];

interface JsonRpcRequest {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, any>;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

function jsonRpcSuccess(id: string | number | null, result: unknown): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        result,
    };
}

function jsonRpcError(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        error: data !== undefined ? { code, message, data } : { code, message },
    };
}

/**
 * Autentica a requisição via sessão de cookies SSR ou Bearer JWT explícito,
 * rejeitando rigorosamente qualquer acesso não autenticado ou `anon`.
 */
async function authenticateMcpRequest(req: Request): Promise<{
    supabase: SupabaseClient;
    user: User;
} | null> {
    const authHeader = req.headers.get('authorization') || '';
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

    if (bearerMatch?.[1]) {
        const accessToken = bearerMatch[1].trim();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) return null;

        const scopedClient = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        });

        const {
            data: { user },
            error,
        } = await scopedClient.auth.getUser(accessToken);

        if (error || !user || user.role === 'anon' || user.is_anonymous) {
            return null;
        }

        return { supabase: scopedClient, user };
    }

    const cookieSupabase = await createServerCookieClient();
    const {
        data: { user },
        error,
    } = await cookieSupabase.auth.getUser();

    if (error || !user || user.role === 'anon' || user.is_anonymous) {
        return null;
    }

    return { supabase: cookieSupabase, user };
}

async function handleSingleJsonRpc(
    rpcReq: JsonRpcRequest,
    supabase: SupabaseClient,
    user: User
): Promise<JsonRpcResponse | null> {
    const isNotification = rpcReq.id === undefined;
    const reqId = rpcReq.id ?? null;

    if (!rpcReq || rpcReq.jsonrpc !== '2.0' || typeof rpcReq.method !== 'string') {
        return jsonRpcError(reqId, -32600, 'Invalid Request: esperado protocolo JSON-RPC 2.0.');
    }

    const method = rpcReq.method;
    const params = (rpcReq.params && typeof rpcReq.params === 'object' ? rpcReq.params : {}) as Record<
        string,
        any
    >;

    if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
        return isNotification ? null : jsonRpcSuccess(reqId, {});
    }

    if (method === 'ping') {
        return jsonRpcSuccess(reqId, {});
    }

    if (method === 'initialize') {
        return jsonRpcSuccess(reqId, {
            protocolVersion: MCP_PROTOCOL_VERSION,
            serverInfo: MCP_SERVER_INFO,
            capabilities: {
                tools: {},
            },
        });
    }

    if (method === 'tools/list') {
        return jsonRpcSuccess(reqId, {
            tools: MCP_TOOLS_CATALOG,
        });
    }

    if (method === 'tools/call') {
        const toolName = typeof params.name === 'string' ? params.name : '';
        const args =
            params.arguments && typeof params.arguments === 'object'
                ? (params.arguments as Record<string, any>)
                : {};

        const validTool = MCP_TOOLS_CATALOG.find((t) => t.name === toolName);
        if (!validTool) {
            return jsonRpcError(
                reqId,
                -32602,
                `Invalid params: tool '${toolName}' não encontrada no catálogo kitsune-finance-mcp.`
            );
        }

        try {
            const { userData } = await loadUserFinancialDataFromSupabase(
                supabase,
                user.id,
                user.email,
                800
            );

            let result: unknown;

            switch (validTool.name) {
                case 'get_balance_sheet_xray': {
                    const customMacro = {
                        ...userData.macroRates,
                        ...(typeof args.annualCDIPct === 'number' ? { annualCDIPct: args.annualCDIPct } : {}),
                        ...(typeof args.annualIPCAPct === 'number'
                            ? { annualIPCAPct: args.annualIPCAPct }
                            : {}),
                    };
                    result = toolGetBalanceSheetAndXRay({
                        ...userData,
                        macroRates: customMacro,
                    });
                    break;
                }

                case 'get_income_statement': {
                    const periodMonths =
                        typeof args.periodMonths === 'number' ? args.periodMonths : 1;
                    result = toolGetIncomeStatement(userData, periodMonths);
                    break;
                }

                case 'simulate_debt_payoff': {
                    const extraMonthlyBudget =
                        typeof args.extraMonthlyBudget === 'number' ? args.extraMonthlyBudget : 0;
                    const annualAdvanceDiscountPct =
                        typeof args.annualAdvanceDiscountPct === 'number'
                            ? args.annualAdvanceDiscountPct
                            : 9.85;
                    result = toolSimulateDebtAndCards(
                        userData,
                        extraMonthlyBudget,
                        annualAdvanceDiscountPct
                    );
                    break;
                }

                case 'compare_fixed_income_br': {
                    result = toolAnalyzeFixedIncomeAndGoals(userData, {
                        annualCDIPct:
                            typeof args.annualCDIPct === 'number' ? args.annualCDIPct : undefined,
                        annualIPCAPct:
                            typeof args.annualIPCAPct === 'number' ? args.annualIPCAPct : undefined,
                        cdbPercentCDI:
                            typeof args.cdbPercentCDI === 'number' ? args.cdbPercentCDI : undefined,
                        lciPercentCDI:
                            typeof args.lciPercentCDI === 'number' ? args.lciPercentCDI : undefined,
                        comparisonCalendarDays:
                            typeof args.comparisonCalendarDays === 'number'
                                ? args.comparisonCalendarDays
                                : undefined,
                        projectionMonths:
                            typeof args.projectionMonths === 'number'
                                ? args.projectionMonths
                                : undefined,
                        monthlyContribution:
                            typeof args.monthlyContribution === 'number'
                                ? args.monthlyContribution
                                : undefined,
                    });
                    break;
                }

                case 'audit_anomalies_and_subscriptions': {
                    result = toolAuditAnomaliesAndLeaks(userData);
                    break;
                }
            }

            const withValues = args.withValues !== false;
            const finalPayload = withValues ? result : redactMonetaryValuesDeep(result);

            return jsonRpcSuccess(reqId, {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(finalPayload),
                    },
                ],
                isError: false,
            });
        } catch (toolError: unknown) {
            const safeMessage =
                toolError instanceof CallerFacingMcpError || toolError instanceof RangeError
                    ? toolError.message
                    : 'Erro interno ao executar Macro-Tool determinística no servidor MCP.';
            return jsonRpcSuccess(reqId, {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            error: safeMessage,
                        }),
                    },
                ],
                isError: true,
            });
        }
    }

    return jsonRpcError(reqId, -32601, `Method not found: '${method}'.`);
}

export async function GET(req: Request) {
    const authContext = await authenticateMcpRequest(req);
    if (!authContext) {
        return NextResponse.json(
            { error: 'Unauthorized: sessão Supabase autenticada obrigatória (anon bloqueado).' },
            { status: 401 }
        );
    }

    const acceptHeader = req.headers.get('accept') || '';
    if (acceptHeader.includes('text/event-stream')) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                const endpointEvent = `event: endpoint\ndata: /api/mcp\n\n`;
                controller.enqueue(encoder.encode(endpointEvent));
                controller.close();
            },
        });

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
            },
        });
    }

    return NextResponse.json({
        jsonrpc: '2.0',
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: MCP_SERVER_INFO,
        capabilities: {
            tools: {},
        },
        tools: MCP_TOOLS_CATALOG.map((t) => ({
            name: t.name,
            description: t.description,
        })),
    });
}

export async function POST(req: Request) {
    const authContext = await authenticateMcpRequest(req);
    if (!authContext) {
        return NextResponse.json(
            {
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32001,
                    message: 'Unauthorized: sessão Supabase autenticada obrigatória (anon bloqueado).',
                },
            },
            { status: 401 }
        );
    }

    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        return NextResponse.json(
            jsonRpcError(null, -32700, 'Parse error: JSON inválido no corpo da requisição.'),
            { status: 400 }
        );
    }

    const { supabase, user } = authContext;

    if (Array.isArray(rawBody)) {
        if (rawBody.length === 0) {
            return NextResponse.json(
                jsonRpcError(null, -32600, 'Invalid Request: batch JSON-RPC vazio.'),
                { status: 400 }
            );
        }

        const responses = (
            await Promise.all(
                rawBody.map((item) =>
                    handleSingleJsonRpc(item as JsonRpcRequest, supabase, user)
                )
            )
        ).filter((r): r is JsonRpcResponse => r !== null);

        if (responses.length === 0) {
            return new Response(null, { status: 202 });
        }

        return NextResponse.json(responses);
    }

    const singleResponse = await handleSingleJsonRpc(
        rawBody as JsonRpcRequest,
        supabase,
        user
    );

    if (singleResponse === null) {
        return new Response(null, { status: 202 });
    }

    return NextResponse.json(singleResponse);
}
