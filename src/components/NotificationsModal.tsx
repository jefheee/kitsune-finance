'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Spinner from '@/components/Spinner';

export interface UserNotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export function NotificationsModal({ isOpen, onClose, onRefreshData }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (res.ok && data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleAcceptInvite = async (notif: UserNotificationItem) => {
    const connectionId = notif.data?.connection_id;
    const inviteCode = notif.data?.invite_code;

    try {
      setActionLoadingId(notif.id);
      setStatusMessage(null);

      const res = await fetch('/api/shared-space', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, code: inviteCode, action: 'accept' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage({ type: 'error', text: data.error || 'Erro ao aceitar convite.' });
        return;
      }

      setStatusMessage({
        type: 'success',
        text: 'Espaço Compartilhado ativado com sucesso! As contas de ambos foram unificadas.',
      });

      // Marcar notificação como lida
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id }),
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id
            ? { ...n, is_read: true, data: { ...n.data, status: 'accepted' } }
            : n
        )
      );
      if (onRefreshData) onRefreshData();

      // Fechar modal automaticamente após feedback positivo
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Falha na conexão.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectInvite = async (notif: UserNotificationItem) => {
    const connectionId = notif.data?.connection_id;
    try {
      setActionLoadingId(notif.id);
      await fetch('/api/shared-space', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, action: 'reject' }),
      });

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id }),
      });

      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#27272A] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-100 dark:border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF8216]/10 text-[#FF8216] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
                Notificações & Convites
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-[#94A3B8]">
                Alertas da IA e convites do Espaço Compartilhado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {notifications.some((n) => !n.is_read) && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-[#FF8216] hover:underline px-2 py-1 cursor-pointer"
              >
                Ler todas
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-3 mx-4 mt-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {statusMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Content List */}
        <div className="p-4 overflow-y-auto flex flex-col gap-3">
          {isLoading ? (
            <div className="p-10 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Spinner size={22} className="text-[#FF8216]" />
              <span className="text-xs">Carregando notificações...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#18181B] border border-slate-200 dark:border-[#27272A] flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-2xl">notifications_off</span>
              </div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nenhuma notificação nova
              </h3>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Quando você receber convites de cônjuges/sócios ou alertas do Sentinela Kitsune, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isInvite = notif.type === 'invite_received';
              const isAccepted = notif.type === 'invite_accepted';
              const isLoadingThis = actionLoadingId === notif.id;

              return (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    !notif.is_read
                      ? 'bg-slate-50 dark:bg-[#18181B] border-[#FF8216]/40 shadow-xs'
                      : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-[#27272A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${
                          isInvite
                            ? 'bg-[#FF8216]/10 text-[#FF8216]'
                            : isAccepted
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-slate-100 dark:bg-[#27272A] text-slate-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          {isInvite ? 'group_add' : isAccepted ? 'verified' : 'notifications'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            {notif.title}
                          </span>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-[#FF8216] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-[#CBD5E1] mt-0.5 leading-relaxed">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(notif.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteNotification(notif.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer transition-colors"
                      title="Excluir notificação"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </div>

                  {/* Ações interativas para convites */}
                  {isInvite && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-[#27272A] flex items-center gap-2">
                      {notif.data?.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          Conexão aceita
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleAcceptInvite(notif)}
                            className="px-3 py-1.5 rounded-xl bg-[#FF8216] hover:bg-[#FFA047] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isLoadingThis ? (
                              <Spinner size={12} className="text-white" />
                            ) : (
                              <span className="material-symbols-outlined text-[15px]">check_circle</span>
                            )}
                            <span>Aceitar Conexão</span>
                          </button>

                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleRejectInvite(notif)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#27272A] dark:hover:bg-[#3F3F46] text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
