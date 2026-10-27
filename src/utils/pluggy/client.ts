import { createHash } from 'crypto';

export interface PluggyAccount {
  id: string;
  type: string;
  subtype?: string;
  name: string;
  balance: number;
  currencyCode: string;
  itemId: string;
  bankData?: {
    transferNumber?: string;
    closingBalance?: number;
  };
}

export interface PluggyTransaction {
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
}

export interface PluggyConnector {
  id: number;
  name: string;
  institutionUrl?: string;
  imageUrl?: string;
  primaryColor?: string;
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

  /**
   * Obtém a apiKey autenticando em POST /auth com cache de até 2 horas.
   */
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

  /**
   * Gera um connectToken para inicialização do widget no frontend
   * vinculando clientUserId estritamente ao user.id autenticado.
   */
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

  /**
   * Coleta e higieniza as contas bancárias e cartões diretamente pelo itemId
   * Descarta dados sensíveis cadastrais (CPF, endereço, telefone, owner).
   */
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

    // Higiene de dados: extrai apenas campos financeiros normalizados, descartando owner/taxNumber/CPF
    return rawResults.map((acc) => ({
      id: String(acc.id),
      type: String(acc.type || 'BANK'),
      subtype: acc.subtype ? String(acc.subtype) : undefined,
      name: String(acc.name || acc.marketingName || 'Conta Bancária'),
      balance: Number(acc.balance) || 0,
      currencyCode: String(acc.currencyCode || 'BRL'),
      itemId: String(acc.itemId || itemId),
    }));
  }

  /**
   * Coleta e higieniza transações diretamente pela rota da Pluggy com accountId
   * Descarta payloads cadastrais (CPF/CNPJ de pagador/recebedor, localização física, etc.).
   */
  async fetchTransactions(accountId: string): Promise<PluggyTransaction[]> {
    const apiKey = await this.getApiKey();

    const response = await fetch(`${this.baseUrl}/transactions?accountId=${encodeURIComponent(accountId)}`, {
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

    // Higiene de dados: persiste estritamente dados financeiros normalizados
    return rawResults.map((tx) => ({
      id: String(tx.id),
      description: String(tx.description || tx.descriptionRaw || 'Transação'),
      descriptionRaw: tx.descriptionRaw ? String(tx.descriptionRaw) : undefined,
      currencyCode: String(tx.currencyCode || 'BRL'),
      amount: Number(tx.amount) || 0,
      date: String(tx.date),
      category: tx.category ? String(tx.category) : 'Outros',
      type: tx.type ? String(tx.type) : undefined,
      accountId: String(tx.accountId || accountId),
      providerCode: tx.providerCode ? String(tx.providerCode) : undefined,
      status: tx.status ? String(tx.status) : undefined,
    }));
  }

  /**
   * Remove um Item diretamente na API da Pluggy:
   * DELETE https://api.pluggy.ai/items/{id}
   */
  async deleteItem(itemId: string): Promise<{ deleted: boolean; status: number }> {
    const apiKey = await this.getApiKey();

    const response = await fetch(`${this.baseUrl}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: {
        'X-API-KEY': apiKey,
      },
      cache: 'no-store',
    });

    // 200, 204 ou 404 (já removido no provedor) são considerados limpos
    if (response.ok || response.status === 404) {
      return { deleted: true, status: response.status };
    }

    const errorText = await response.text();
    throw new Error(`Erro ao deletar item ${itemId} na Pluggy: ${response.status} - ${errorText}`);
  }

  /**
   * Coleta detalhes de um conector específico
   */
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

/**
 * Idempotency Hash Generator:
 * Hash SHA-256 combinando accountId + externalTransactionId/fitid + amount + date
 */
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
