"use client";

import React from "react";
import {
  TransactionsDataTable,
  type TransactionRowInput,
} from "@/components/wealthfolio/TransactionsDataTable";

interface PaginatedTransactionsViewProps {
  transactions: TransactionRowInput[];
  accounts: any[];
  formatCurrency: (val: number) => string;
  formatDate: (val?: string | null) => string;
}

export function PaginatedTransactionsView({
  transactions,
  accounts,
  formatCurrency,
  formatDate,
}: PaginatedTransactionsViewProps) {
  return (
    <TransactionsDataTable
      transactions={transactions}
      accounts={accounts}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
    />
  );
}
