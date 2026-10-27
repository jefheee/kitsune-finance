"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Spinner from '@/components/Spinner';
import CustomDropdown from '@/components/ui/CustomDropdown';

const PluggyConnect = dynamic(
  () => import('react-pluggy-connect').then((mod) => mod.PluggyConnect),
  { ssr: false }
);

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
}

interface PluggyConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  familyMembers: FamilyMember[];
  onMemberCreated?: (newMember: FamilyMember) => void;
  onConnectionSuccess: (result: { itemId: string; familyMemberId: string | null }) => void;
}

export default function PluggyConnectModal({
  isOpen,
  onClose,
  familyMembers,
  onMemberCreated,
  onConnectionSuccess,
}: PluggyConnectModalProps) {
  // Por padrão, '' vincula diretamente à conta individual do usuário autenticado (sem exigir membro familiar)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado opcional para vincular a um membro familiar
  const [showFamilySelect, setShowFamilySelect] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Cônjuge');
  const [isSavingMember, setIsSavingMember] = useState(false);

  if (!isOpen) return null;

  const effectiveFamilyMemberId = showFamilySelect && selectedMemberId ? selectedMemberId : null;

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
        setShowFamilySelect(true);
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
    setIsLoadingToken(true);
    setError(null);

    try {
      const res = await fetch('/api/pluggy/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyMemberId: effectiveFamilyMemberId,
        }),
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
    const providerName = data?.item?.connector?.name || 'Instituição Conectada';

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
          familyMemberId: effectiveFamilyMemberId,
          providerName,
        }),
      });

      const syncResult = await syncRes.json();
      if (!syncRes.ok) {
        throw new Error(syncResult.error || 'Erro ao sincronizar contas');
      }

      onConnectionSuccess({
        itemId,
        familyMemberId: effectiveFamilyMemberId,
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
                Conectar Instituição Bancária
              </h3>
              <p className="text-xs text-gray-500 dark:text-white/50 font-sans">
                Open Finance Brasil • Vinculado com isolamento total à sua conta
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setConnectToken(null);
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-sans">
            {error}
          </div>
        )}

        {isSyncing && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Spinner size={32} className="text-kitsune" />
            <p className="font-sans font-semibold text-gray-900 dark:text-white">
              Sincronizando contas e lançamentos...
            </p>
            <p className="text-xs text-gray-500 font-sans text-center">
              Processando idempotência SHA-256 e descartando dados cadastrais sensíveis.
            </p>
          </div>
        )}

        {!isSyncing && (
          <div className="flex flex-col gap-5">
            {/* Escopo Padrão: Conta Pessoal do Usuário Logado */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-bold uppercase tracking-wider text-gray-400 dark:text-white/40">
                  Titularidade da Conexão
                </span>
                <button
                  type="button"
                  onClick={() => setShowFamilySelect((prev) => !prev)}
                  className="text-xs font-sans font-semibold text-kitsune hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {showFamilySelect ? 'person' : 'group_add'}
                  </span>
                  {showFamilySelect
                    ? 'Usar apenas minha conta pessoal'
                    : 'Vincular a membro familiar (opcional)'}
                </button>
              </div>

              {!showFamilySelect ? (
                <div className="p-3.5 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-kitsune text-lg">verified_user</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-sans font-semibold text-gray-900 dark:text-white">
                        Patrimônio Pessoal (Conta Principal)
                      </span>
                      <span className="text-[11px] font-sans text-gray-500 dark:text-white/50">
                        Vinculada diretamente ao seu ID de usuário autenticado
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-sans font-bold bg-kitsune/10 text-kitsune">
                    Padrão
                  </span>
                </div>
              ) : !isAddingMember ? (
                <div className="flex flex-col gap-2.5">
                  <CustomDropdown
                    value={selectedMemberId}
                    onChange={(val) => setSelectedMemberId(val)}
                    options={[
                      {
                        value: '',
                        label: 'Minha Conta Pessoal (Sem vínculo familiar)',
                        description: 'Vinculada diretamente ao seu usuário',
                        icon: 'person',
                      },
                      ...familyMembers.map((member) => ({
                        value: member.id,
                        label: `${member.name} (${member.role || 'Membro'})`,
                        icon: 'group',
                      })),
                    ]}
                  />

                  <button
                    type="button"
                    onClick={() => setIsAddingMember(true)}
                    className="text-xs font-sans font-medium text-kitsune hover:underline self-start flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Adicionar novo membro ao espaço compartilhado
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleCreateMember}
                  className="p-4 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl flex flex-col gap-3"
                >
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 font-sans">
                    Novo Membro Familiar (Opcional)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nome ou apelido"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      required
                      className="p-2.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs font-sans text-zinc-100 focus:outline-none focus:border-kitsune"
                    />
                    <CustomDropdown
                      value={newMemberRole}
                      onChange={(val) => setNewMemberRole(val)}
                      options={[
                        { value: 'Cônjuge', label: 'Cônjuge' },
                        { value: 'Sócio(a)', label: 'Sócio(a)' },
                        { value: 'Filho(a)', label: 'Filho(a)' },
                        { value: 'Dependente', label: 'Dependente' },
                        { value: 'Familiar', label: 'Familiar' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingMember(false)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white font-sans cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingMember || !newMemberName.trim()}
                      className="px-4 py-1.5 bg-kitsune text-white rounded-xl text-xs font-sans font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingMember ? 'Salvando...' : 'Salvar Membro'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Aviso de Blindagem e Higiene de Dados */}
            <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex items-start gap-3">
              <span className="material-symbols-outlined text-kitsune text-xl mt-0.5">shield_lock</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-900 dark:text-white font-sans">
                  Privacidade & Blindagem RLS Ativa
                </span>
                <span className="text-[11px] text-gray-500 dark:text-white/60 font-sans leading-relaxed">
                  Seus dados financeiros pertencem exclusivamente ao seu usuário autenticado. Dados cadastrais (CPF, endereço, telefone) são descartados automaticamente.
                </span>
              </div>
            </div>

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
