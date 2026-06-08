import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TransactionService } from '../../services/transaction.service';
import { AuthService } from '../../services/auth.service';
import { NotifBell } from '../../components/notif-bell/notif-bell';
import { UserAvatar } from '../../components/user-avatar/user-avatar';
import { TPipe } from '../../pipes/t.pipe';
import { Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, NotifBell, UserAvatar, TPipe],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
})
export class Transactions implements OnInit {

  transactions: Transaction[] = [];
  visibleTransactions: Transaction[] = [];
  loading = true;
  error = '';
  sidebarOpen = false;

  activeFilter       = 'ALL';
  activeStatusFilter = 'ALL';
  activeRange        = '30';
  searchTerm         = '';

  filters       = ['ALL', 'TRANSFER', 'DEPOSIT', 'BILL_PAYMENT', 'AIRTIME', 'WITHDRAWAL'];
  statusFilters = ['ALL', 'COMPLETED', 'PENDING', 'FAILED'];
  rangeOptions  = [
    { value: '7',   label: 'Last 7 days'  },
    { value: '30',  label: 'Last 30 days' },
    { value: '90',  label: 'Last 3 months'},
    { value: '365', label: 'Last year'    },
    { value: 'all', label: 'All time'     },
  ];

  /** Stats derived from the loaded transactions (filtered by range). */
  monthlyInflow  = 0;
  monthlyOutflow = 0;
  txCount        = 0;

  // Statement download modal
  statementOpen = false;
  statementFrom = '';
  statementTo   = '';
  statementFormat: 'pdf' | 'csv' = 'pdf';
  downloadingStatement = false;
  statementError = '';

  constructor(
    private txService: TransactionService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading = true;
    this.error   = '';

    const type   = this.activeFilter       !== 'ALL' ? this.activeFilter       : undefined;
    const status = this.activeStatusFilter !== 'ALL' ? this.activeStatusFilter : undefined;

    this.txService.getAll({ type, status }).subscribe({
      next: (data) => {
        this.transactions = data;
        this.recomputeView();
        this.loading = false;
      },
      error: () => {
        this.error   = 'Failed to load transactions. Please try again.';
        this.loading = false;
      },
    });
  }

  applyFilter(type: string): void {
    this.activeFilter = type;
    this.loadTransactions();
  }

  applyStatusFilter(status: string): void {
    this.activeStatusFilter = status;
    this.loadTransactions();
  }

  applyRange(value: string): void {
    this.activeRange = value;
    this.recomputeView();
  }

  applySearch(value: string): void {
    this.searchTerm = (value || '').trim().toLowerCase();
    this.recomputeView();
  }

  /** Apply range + search filtering client-side, then refresh the stats. */
  private recomputeView(): void {
    const now = Date.now();
    const rangeDays = this.activeRange === 'all' ? Infinity : Number(this.activeRange);
    const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;
    const term   = this.searchTerm;

    const inRange = this.transactions.filter(tx => {
      if (this.activeRange === 'all') return true;
      const t = new Date(tx.created_at).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    this.visibleTransactions = !term ? inRange : inRange.filter(tx => {
      const sender    = (tx.sender_name    || '').toLowerCase();
      const recipient = (tx.recipient_name || '').toLowerCase();
      const ref       = (tx.reference      || '').toLowerCase();
      const desc      = (tx.description    || '').toLowerCase();
      const amount    = String(tx.amount   || '');
      return sender.includes(term) || recipient.includes(term) ||
             ref.includes(term)    || desc.includes(term)      ||
             amount.includes(term);
    });

    this.computeStats(inRange);
  }

  private computeStats(scope: Transaction[]): void {
    let inflow  = 0;
    let outflow = 0;
    for (const tx of scope) {
      if (tx.status !== 'COMPLETED') continue;
      const amt = Number(tx.amount || 0);
      if (this.isCredit(tx)) inflow  += amt;
      else                   outflow += amt;
    }
    this.monthlyInflow  = inflow;
    this.monthlyOutflow = outflow;
    this.txCount        = scope.length;
  }

  isCredit(tx: Transaction): boolean {
    if (tx.transaction_type === 'DEPOSIT') return true;
    const userId = this.auth.getCurrentUserId();
    return tx.recipient === userId;
  }

  formatAmount(tx: Transaction): string {
    const sign = this.isCredit(tx) ? '+' : '-';
    return `${sign}${Number(tx.amount).toLocaleString('fr-CM')} XAF`;
  }

  txIcon(tx: Transaction): string {
    switch (tx.transaction_type) {
      case 'DEPOSIT':       return 'add_circle';
      case 'WITHDRAWAL':    return 'remove_circle';
      case 'BILL_PAYMENT':  return 'electric_bolt';
      case 'AIRTIME':       return 'smartphone';
      case 'TRANSFER':      return this.isCredit(tx) ? 'south_west' : 'north_east';
      default:              return 'swap_horiz';
    }
  }

  txTypeLabel(tx: Transaction): string {
    return this.isCredit(tx) ? 'Credit' : 'Debit';
  }

  // ── Statement download ────────────────────────────────────────────────────
  openStatement(): void {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    this.statementFrom = monthAgo.toISOString().slice(0, 10);
    this.statementTo   = today.toISOString().slice(0, 10);
    this.statementFormat = 'pdf';
    this.statementError = '';
    this.statementOpen = true;
  }

  closeStatement(): void {
    this.statementOpen = false;
    this.statementError = '';
  }

  downloadStatement(): void {
    if (this.downloadingStatement) return;
    if (!this.statementFrom || !this.statementTo) {
      this.statementError = 'Choose a from and to date.';
      return;
    }
    if (this.statementFrom > this.statementTo) {
      this.statementError = '`From` must be before `to`.';
      return;
    }
    this.downloadingStatement = true;
    this.statementError = '';
    this.txService.downloadStatement(
      this.statementFrom, this.statementTo, this.statementFormat,
    ).subscribe({
      next: (blob) => {
        this.downloadingStatement = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `elite-statement-${this.statementFrom}_${this.statementTo}.${this.statementFormat}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.statementOpen = false;
      },
      error: () => {
        this.downloadingStatement = false;
        this.statementError = 'Could not generate statement. Please try again.';
      },
    });
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  closeSidebar():  void { this.sidebarOpen = false; }
  logout():        void { this.auth.logout(); }
}
