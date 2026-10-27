import { createHash } from 'crypto';

export interface PluggyAccount {
  id: string;
  type: string;
  subtype?: string;
  name: string;
  balance: number;
  currencyCode: string;
  itemId: string;
  number?: string;
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
    // Reutiliza o token se ainda tiver mais de 5 minutos de validade (2 horas = 7200s)
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
    // O token expira em 2 horas
    this.tokenExpiresAt = now + 2 * 60 * 60 * 1000;
    return this.cachedApiKey!;
  }

  /**
   * Gera um connectToken para inicialização do widget no frontend
   * com clientUserId vinculado ao membro familiar e conector Meu Pluggy (id: 200).
   */
  async createConnectToken(params?: {
    clientUserId?: string;
    connectorId?: number;
  }): Promise<{ accessToken: string }> {
    const apiKey = await this.getApiKey();

    const body: Record<string, any> = {
      options: {
        connectorId: params?.connectorId ?? 200,
      },
    };

    if (params?.clientUserId) {
      body.clientUserId = params.clientUserId;
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
   * Coleta as contas bancárias e cartões diretamente pelo itemId
   * Rota: GET https://api.pluggy.ai/accounts?itemId={id}
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
    return (data.results || []) as PluggyAccount[];
  }

  /**
   * Coleta transações diretamente pela rota da Pluggy com accountId
   * Rota: GET https://api.pluggy.ai/transactions?accountId={id}
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
    return (data.results || []) as PluggyTransaction[];
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
 * Idempotency Hash Generator (Regra 6):
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
