import { createHash } from 'crypto';
import type { PluggyAccountRaw } from './bank-resolver';
import type { PluggyTransactionRaw } from './transaction-enricher';
import type { PluggyIdentityRaw } from './identity-consolidator';

export interface PluggyAccount extends PluggyAccountRaw {
    id: string;
    type: string;
    subtype?: string;
    name: string;
    balance: number;
    currencyCode: string;
    itemId: string;
}

export interface PluggyTransaction extends PluggyTransactionRaw {
    id: string;
    description: string;
    descriptionRaw?: string;
    currencyCode: string;
    amount: number;
    date: string;
    category?: string;
    categoryId?: string;
    type?: 'DEBIT' | 'CREDIT' | string;
    accountId: string;
    providerCode?: string;
    status?: string;
    rawPayload?: Record<string, any>;
}

export interface PluggyConnector {
    id: number;
    name: string;
    institutionUrl?: string;
    imageUrl?: string;
    primaryColor?: string;
}

export interface PluggyItemDetail {
    id: string;
    status?: string;
    executionStatus?: string;
    consentExpiresAt?: string | null;
    connector?: PluggyConnector | null;
}

export interface PluggyInvestmentRaw {
    id: string;
    itemId?: string;
    name: string;
    type: string;
    subtype?: string | null;
    balance: number;
    currencyCode?: string;
    issuer?: string | null;
    rate?: number | null;
    rateType?: string | null;
    annualRate?: number | null;
    amountOriginal?: number | null;
    amountProfit?: number | null;
    taxes?: number | null;
    dueDate?: string | null;
    issueDate?: string | null;
    status?: string | null;
    rawPayload?: Record<string, any>;
}

export interface PluggyLoanRaw {
    id: string;
    itemId?: string;
    productName: string;
    type?: string | null;
    contractAmount?: number | null;
    outstandingBalance?: number | null;
    paidInstallments?: number | null;
    totalInstallments?: number | null;
    interestRate?: number | null;
    currencyCode?: string | null;
    date?: string | null;
    dueDate?: string | null;
    rawPayload?: Record<string, any>;
}

class PluggyService {
    private cachedApiKey: string | null = null;
    private tokenExpiresAt: number = 0;
    private baseUrl = 'https://api.pluggy.ai';

    private getCredentials() {
        const clientId = process.env.PLUGGY_CLIENT_ID;
        const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET precisam estar configurados nas variáveis de ambiente.');
        }

        return { clientId, clientSecret };
    }

    async getApiKey(): Promise<string> {
        const now = Date.now();
        if (this.cachedApiKey && now < this.tokenExpiresAt - 5 * 60 * 1000) {
            return this.cachedApiKey;
        }

        const { clientId, clientSecret } = this.getCredentials();

        const response = await fetch(`${this.baseUrl}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clientId,
                clientSecret,
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Falha ao autenticar na Pluggy: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.apiKey) {
            throw new Error('A resposta de autenticação da Pluggy não retornou apiKey.');
        }

        this.cachedApiKey = data.apiKey;
        this.tokenExpiresAt = now + 2 * 60 * 60 * 1000;
        return this.cachedApiKey!;
    }

    async createConnectToken(params: {
        clientUserId: string;
        connectorId?: number;
        itemId?: string;
    }): Promise<{ accessToken: string }> {
        const apiKey = await this.getApiKey();

        const body: Record<string, any> = {
            clientUserId: params.clientUserId,
            options: {
                clientUserId: params.clientUserId,
                connectorId: params.connectorId ?? 200,
            },
        };

        if (params.itemId) {
            body.itemId = params.itemId;
        }

        const response = await fetch(`${this.baseUrl}/connect_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey,
            },
            body: JSON.stringify(body),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao gerar Connect Token na Pluggy: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return { accessToken: data.accessToken };
    }

    async fetchItem(itemId: string): Promise<PluggyItemDetail | null> {
        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.baseUrl}/items/${encodeURIComponent(itemId)}`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': apiKey,
                },
                cache: 'no-store',
            });

            if (!response.ok) return null;
            const raw = await response.json();
            return {
                id: String(raw.id || itemId),
                status: raw.status ? String(raw.status) : undefined,
                executionStatus: raw.executionStatus ? String(raw.executionStatus) : undefined,
                consentExpiresAt: raw.consentExpiresAt ? String(raw.consentExpiresAt) : null,
                connector: raw.connector || null,
            };
        } catch {
            return null;
        }
    }

    async fetchAccounts(itemId: string): Promise<PluggyAccount[]> {
        const apiKey = await this.getApiKey();

        const response = await fetch(`${this.baseUrl}/accounts?itemId=${encodeURIComponent(itemId)}`, {
            method: 'GET',
            headers: {
                'X-API-KEY': apiKey,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao buscar contas do item ${itemId}: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const rawResults: any[] = data.results || [];

        return rawResults.map((acc) => ({
            id: String(acc.id),
            type: String(acc.type || 'BANK'),
            subtype: acc.subtype ? String(acc.subtype) : undefined,
            name: String(acc.name || acc.marketingName || 'Conta Bancária'),
            marketingName: acc.marketingName ? String(acc.marketingName) : null,
            number: acc.number ? String(acc.number) : null,
            balance: Number(acc.balance) || 0,
            currencyCode: String(acc.currencyCode || 'BRL'),
            itemId: String(acc.itemId || itemId),
            bankData: acc.bankData
                ? {
                      transferNumber: acc.bankData.transferNumber || null,
                      closingBalance: acc.bankData.closingBalance ?? null,
                      automaticallyInvestedBalance: acc.bankData.automaticallyInvestedBalance ?? null,
                  }
                : null,
            creditData: acc.creditData
                ? {
                      level: acc.creditData.level || null,
                      brand: acc.creditData.brand || null,
                      balanceCloseDate: acc.creditData.balanceCloseDate ? String(acc.creditData.balanceCloseDate).split('T')[0] : null,
                      balanceDueDate: acc.creditData.balanceDueDate ? String(acc.creditData.balanceDueDate).split('T')[0] : null,
                      availableCreditLimit: acc.creditData.availableCreditLimit ?? null,
                      creditLimit: acc.creditData.creditLimit ?? null,
                      minimumPayment: acc.creditData.minimumPayment ?? null,
                  }
                : null,
        }));
    }

    async fetchTransactions(accountId: string): Promise<PluggyTransaction[]> {
        const apiKey = await this.getApiKey();

        const response = await fetch(`${this.baseUrl}/transactions?accountId=${encodeURIComponent(accountId)}&pageSize=500`, {
            method: 'GET',
            headers: {
                'X-API-KEY': apiKey,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao buscar transações da conta ${accountId}: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const rawResults: any[] = data.results || [];

        return rawResults.map((tx) => ({
            id: String(tx.id),
            description: String(tx.description || tx.descriptionRaw || 'Transação'),
            descriptionRaw: tx.descriptionRaw ? String(tx.descriptionRaw) : undefined,
            currencyCode: String(tx.currencyCode || 'BRL'),
            amount: Number(tx.amount) || 0,
            date: String(tx.date),
            category: tx.category ? String(tx.category) : undefined,
            categoryId: tx.categoryId ? String(tx.categoryId) : undefined,
            type: tx.type ? String(tx.type) : undefined,
            operationType: tx.operationType ? String(tx.operationType) : null,
            accountId: String(tx.accountId || accountId),
            providerCode: tx.providerCode ? String(tx.providerCode) : undefined,
            status: tx.status ? String(tx.status) : undefined,
            paymentData: tx.paymentData
                ? {
                      payer: tx.paymentData.payer
                          ? {
                                name: tx.paymentData.payer.name || null,
                                documentNumber: tx.paymentData.payer.documentNumber || null,
                            }
                          : null,
                      receiver: tx.paymentData.receiver
                          ? {
                                name: tx.paymentData.receiver.name || null,
                                documentNumber: tx.paymentData.receiver.documentNumber || null,
                            }
                          : null,
                      reason: tx.paymentData.reason || null,
                      paymentMethod: tx.paymentData.paymentMethod || null,
                      referenceNumber: tx.paymentData.referenceNumber || null,
                  }
                : null,
            creditCardMetadata: tx.creditCardMetadata
                ? {
                      installmentNumber: tx.creditCardMetadata.installmentNumber ?? null,
                      totalInstallments: tx.creditCardMetadata.totalInstallments ?? null,
                      totalAmount: tx.creditCardMetadata.totalAmount ?? null,
                      billId: tx.creditCardMetadata.billId || null,
                      purchaseDate: tx.creditCardMetadata.purchaseDate || null,
                      cardNumber: tx.creditCardMetadata.cardNumber || null,
                  }
                : null,
            merchant: tx.merchant
                ? {
                      name: tx.merchant.name || null,
                      businessName: tx.merchant.businessName || null,
                      cnpj: tx.merchant.cnpj || null,
                      cnae: tx.merchant.cnae || null,
                      category: tx.merchant.category || null,
                  }
                : null,
            rawPayload: {
                id: tx.id,
                description: tx.description,
                descriptionRaw: tx.descriptionRaw,
                amount: tx.amount,
                date: tx.date,
                type: tx.type,
                category: tx.category,
                operationType: tx.operationType,
                paymentData: tx.paymentData
                    ? {
                          payerName: tx.paymentData.payer?.name || null,
                          receiverName: tx.paymentData.receiver?.name || null,
                          reason: tx.paymentData.reason || null,
                          paymentMethod: tx.paymentData.paymentMethod || null,
                      }
                    : null,
                creditCardMetadata: tx.creditCardMetadata || null,
                merchant: tx.merchant || null,
            },
        }));
    }

    async fetchIdentity(itemId: string): Promise<PluggyIdentityRaw | null> {
        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.baseUrl}/identity?itemId=${encodeURIComponent(itemId)}`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': apiKey,
                },
                cache: 'no-store',
            });

            if (!response.ok) return null;
            const raw = await response.json();
            if (!raw || (!raw.id && !raw.fullName && !raw.document)) return null;
            return raw as PluggyIdentityRaw;
        } catch {
            return null;
        }
    }

    async fetchInvestments(itemId: string): Promise<PluggyInvestmentRaw[]> {
        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.baseUrl}/investments?itemId=${encodeURIComponent(itemId)}`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': apiKey,
                },
                cache: 'no-store',
            });

            if (!response.ok) return [];
            const data = await response.json();
            const results: any[] = data.results || [];

            return results.map((inv) => ({
                id: String(inv.id),
                itemId: String(inv.itemId || itemId),
                name: String(inv.name || 'Investimento'),
                type: String(inv.type || 'FIXED_INCOME'),
                subtype: inv.subtype ? String(inv.subtype) : null,
                balance: Number(inv.balance ?? inv.amount ?? 0),
                currencyCode: String(inv.currencyCode || 'BRL'),
                issuer: inv.issuer ? String(inv.issuer) : null,
                rate: inv.rate != null ? Number(inv.rate) : null,
                rateType: inv.rateType ? String(inv.rateType) : null,
                annualRate: inv.annualRate != null ? Number(inv.annualRate) : null,
                amountOriginal: inv.amountOriginal != null ? Number(inv.amountOriginal) : null,
                amountProfit: inv.amountProfit != null ? Number(inv.amountProfit) : null,
                taxes: inv.taxes != null ? Number(inv.taxes) : null,
                dueDate: inv.dueDate ? String(inv.dueDate).split('T')[0] : null,
                issueDate: inv.issueDate ? String(inv.issueDate).split('T')[0] : null,
                status: inv.status ? String(inv.status) : 'ACTIVE',
                rawPayload: inv,
            }));
        } catch {
            return [];
        }
    }

    async fetchLoans(itemId: string): Promise<PluggyLoanRaw[]> {
        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.baseUrl}/loans?itemId=${encodeURIComponent(itemId)}`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': apiKey,
                },
                cache: 'no-store',
            });

            if (!response.ok) return [];
            const data = await response.json();
            const results: any[] = data.results || [];

            return results.map((loan) => ({
                id: String(loan.id),
                itemId: String(loan.itemId || itemId),
                productName: String(loan.productName || loan.type || 'Empréstimo / Financiamento'),
                type: loan.type ? String(loan.type) : null,
                contractAmount: loan.contractAmount != null ? Number(loan.contractAmount) : 0,
                outstandingBalance:
                    loan.payments?.contractOutstandingBalance != null
                        ? Number(loan.payments.contractOutstandingBalance)
                        : loan.contractAmount != null
                          ? Number(loan.contractAmount)
                          : 0,
                paidInstallments: loan.installments?.paidNumberOfInstallments ?? null,
                totalInstallments: loan.installments?.totalNumberOfInstallments ?? null,
                interestRate: loan.interestRates?.[0]?.preFixedRate ?? null,
                currencyCode: String(loan.currencyCode || 'BRL'),
                date: loan.date ? String(loan.date).split('T')[0] : null,
                dueDate: loan.dueDate ? String(loan.dueDate).split('T')[0] : null,
                rawPayload: loan,
            }));
        } catch {
            return [];
        }
    }

    async deleteItem(itemId: string): Promise<{ deleted: boolean; status: number }> {
        const apiKey = await this.getApiKey();

        const response = await fetch(`${this.baseUrl}/items/${encodeURIComponent(itemId)}`, {
            method: 'DELETE',
            headers: {
                'X-API-KEY': apiKey,
            },
            cache: 'no-store',
        });

        if (response.ok || response.status === 404) {
            return { deleted: true, status: response.status };
        }

        const errorText = await response.text();
        throw new Error(`Erro ao deletar item ${itemId} na Pluggy: ${response.status} - ${errorText}`);
    }

    async fetchConnector(connectorId: number): Promise<PluggyConnector | null> {
        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.baseUrl}/connectors/${connectorId}`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': apiKey,
                },
                cache: 'no-store',
            });

            if (!response.ok) return null;
            return (await response.json()) as PluggyConnector;
        } catch {
            return null;
        }
    }
}

export const pluggyClient = new PluggyService();

export function generateTransactionIdempotencyHash(
    accountId: string,
    externalTransactionId: string,
    amount: number | string,
    date: string
): string {
    const normalizedAmount = Number(amount).toFixed(2);
    const normalizedDate = date.split('T')[0];
    const payload = `${accountId}_${externalTransactionId}_${normalizedAmount}_${normalizedDate}`;
    return createHash('sha256').update(payload).digest('hex');
}
