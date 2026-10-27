"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Spinner from '@/components/Spinner';

// Carregamento dinâmico do widget PluggyConnect desativando SSR
const PluggyConnect = dynamic(
  () => import('react-pluggy-connect').then((mod) => mod.PluggyConnect),
  { ssr: false }
);

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatar_url?: string;
}

interface PluggyConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyMembers: FamilyMember[];
  onMemberCreated?: (newMember: FamilyMember) => void;
  onConnectionSuccess: (result: { itemId: string; familyMemberId: string }) => void;
}

export default function PluggyConnectModal({
  isOpen,
  onClose,
  familyMembers,
  onMemberCreated,
  onConnectionSuccess,
}: PluggyConnectModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    familyMembers[0]?.id || ''
  );
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para cadastro rápido de novo membro
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Cônjuge');
  const [isSavingMember, setIsSavingMember] = useState(false);

  if (!isOpen) return null;

  const currentMemberId = selectedMemberId || familyMembers[0]?.id || '';

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    setIsSavingMember(true);
    setError(null);
    try {
      const res = await fetch('/api/family-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName.trim(), role: newMemberRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar membro');

      if (data.member) {
        if (onMemberCreated) onMemberCreated(data.member);
        setSelectedMemberId(data.member.id);
        setIsAddingMember(false);
        setNewMemberName('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleStartConnection = async () => {
    if (!currentMemberId) {
      setError('Por favor, selecione ou adicione um membro da família.');
      return;
    }

    setIsLoadingToken(true);
    setError(null);

    try {
      const res = await fetch('/api/pluggy/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyMemberId: currentMemberId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar o token de conexão');
      }

      const token = data.connectToken || data.accessToken;
      if (!token) {
        throw new Error('Connect token não retornado pelo servidor');
      }

      setConnectToken(token);
    } catch (err: any) {
      setError(err.message || 'Falha ao iniciar o conector');
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleWidgetSuccess = async (data: { item: any }) => {
    const itemId = data?.item?.id;
    const providerName = data?.item?.connector?.name || 'Meu Pluggy';

    if (!itemId) {
      setError('Item ID não recebido da Pluggy.');
      return;
    }

    setIsSyncing(true);
    try {
      const syncRes = await fetch('/api/pluggy/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          familyMemberId: currentMemberId,
          providerName,
        }),
      });

      const syncResult = await syncRes.json();
      if (!syncRes.ok) {
        throw new Error(syncResult.error || 'Erro ao sincronizar contas');
      }

      onConnectionSuccess({
        itemId,
        familyMemberId: currentMemberId,
      });

      setConnectToken(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao sincronizar contas com o banco');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl relative flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-kitsune/10 flex items-center justify-center text-kitsune">
              <span className="material-symbols-outlined text-2xl">account_balance</span>
            </div>
            <div>
              <h3 className="text-xl font-bold font-sans text-gray-900 dark:text-white">
                Conectar Nova Instituição
              </h3>
              <p className="text-xs text-gray-500 dark:text-white/50 font-sans">
                Proxy Meu Pluggy (conector 200 - sem necessidade de CNPJ)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setConnectToken(null);
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-sans">
            {error}
          </div>
        )}

        {/* Sincronização em andamento */}
        {isSyncing && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Spinner size={32} className="text-kitsune" />
            <p className="font-sans font-semibold text-gray-900 dark:text-white">
              Sincronizando contas e lançamentos...
            </p>
            <p className="text-xs text-gray-500 font-sans text-center">
              Processando idempotência SHA-256 e gravando no painel familiar.
            </p>
          </div>
        )}

        {/* Formulário de Seleção do Membro */}
        {!isSyncing && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-sans font-semibold text-gray-700 dark:text-gray-300">
                A qual membro da família pertence esta conta?
              </label>

              {!isAddingMember ? (
                <div className="flex flex-col gap-3">
                  <select
                    value={currentMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full p-3.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl font-sans text-sm text-gray-900 dark:text-white focus:outline-none focus:border-kitsune transition-colors"
                  >
                    {familyMembers.map((member) => (
                      <option key={member.id} value={member.id} className="dark:bg-[#1a1a1a]">
                        {member.name} ({member.role || 'Membro'})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsAddingMember(true)}
                    className="text-xs font-sans font-medium text-kitsune hover:underline self-start flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Cadastrar novo membro familiar
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleCreateMember}
                  className="p-4 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col gap-3"
                >
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 font-sans">
                    Novo Membro Familiar
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nome completo ou apelido"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      required
                      className="p-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-sans text-gray-900 dark:text-white focus:outline-none focus:border-kitsune"
                    />
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="p-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-sans text-gray-900 dark:text-white focus:outline-none focus:border-kitsune"
                    >
                      <option value="Titular" className="dark:bg-[#1a1a1a]">Titular</option>
                      <option value="Cônjuge" className="dark:bg-[#1a1a1a]">Cônjuge</option>
                      <option value="Filho(a)" className="dark:bg-[#1a1a1a]">Filho(a)</option>
                      <option value="Dependente" className="dark:bg-[#1a1a1a]">Dependente</option>
                      <option value="Outro" className="dark:bg-[#1a1a1a]">Outro</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingMember(false)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white font-sans"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingMember || !newMemberName.trim()}
                      className="px-4 py-1.5 bg-kitsune text-white rounded-xl text-xs font-sans font-semibold disabled:opacity-50"
                    >
                      {isSavingMember ? 'Salvando...' : 'Salvar Membro'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Explicação do Conector */}
            <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex items-start gap-3">
              <span className="material-symbols-outlined text-kitsune text-xl mt-0.5">verified_user</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-900 dark:text-white font-sans">
                  Modo Meu Pluggy Ativo
                </span>
                <span className="text-[11px] text-gray-500 dark:text-white/60 font-sans leading-relaxed">
                  Permite agregação segura e real de contas sem burocracia bancária corporativa. Dados sensíveis (CPF, endereços) são descartados na origem.
                </span>
              </div>
            </div>

            {/* Ação de Início */}
            <button
              onClick={handleStartConnection}
              disabled={isLoadingToken || isSyncing}
              className="w-full py-4 bg-kitsune hover:bg-kitsune/90 text-white rounded-2xl font-sans font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-kitsune/20 disabled:opacity-50 cursor-pointer"
            >
              {isLoadingToken ? (
                <>
                  <Spinner size={18} className="text-white" />
                  <span>Gerando token seguro...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">link</span>
                  <span>Conectar Banco ou Cartão</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Instância do Widget Pluggy Connect */}
        {connectToken && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
            <PluggyConnect
              connectToken={connectToken}
              selectedConnectorId={200}
              connectorIds={[200]}
              includeSandbox={false}
              onSuccess={handleWidgetSuccess}
              onError={(err) => {
                console.error('[Pluggy Connect Error]', err);
                setError(err.message || 'Erro no widget da Pluggy.');
                setConnectToken(null);
              }}
              onClose={() => {
                setConnectToken(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
