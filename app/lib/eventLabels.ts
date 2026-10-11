import { money } from './format';

export function eventLabel(e: {
  kind: string;
  data: any;
}): { label: string; tone: 'neutral' | 'positive' | 'warning' | 'danger' } | null {
  const d = e.data ?? {};
  switch (e.kind) {
    case 'tool.started':
      return null;
    case 'tool.completed': {
      if (d.tool === 'transfer_money') {
        const status = d.output?.status ?? d.result?.status;
        return {
          label: status === 'requires_confirmation' ? 'Proposed a transfer' : 'Executed a transfer',
          tone: 'neutral',
        };
      }
      const labels: Record<string, string> = {
        list_accounts: 'Checked accounts and recipients',
        search_documents: 'Searched documentation',
        draft_transfer: 'Opened a transfer card',
        confirm_transfer: 'Confirmed a transfer',
        operation_status: 'Checked an operation with the bank',
        request_human: 'Escalated to human support',
      };
      return { label: labels[d.tool] ?? `Ran ${d.tool ?? 'a tool'}`, tone: 'neutral' };
    }
    case 'tool.failed':
      return { label: `Tool failed: ${d.tool ?? 'unknown'}`, tone: 'danger' };
    case 'transfer.proposed': {
      const cents = d.input?.amountCents;
      return {
        label: `Transfer proposed${cents != null ? ` · ${money(cents)}` : ''}`,
        tone: 'neutral',
      };
    }
    case 'transfer.started':
      return { label: 'Transfer sent to the bank', tone: 'neutral' };
    case 'transfer.completed': {
      const ref = d.operation?.reference ?? d.reference;
      return {
        label: `Bank confirmed the transfer${ref ? ` · ref ${String(ref).slice(0, 8)}` : ''}`,
        tone: 'positive',
      };
    }
    case 'transfer.unknown': {
      const ref = d.reference;
      return {
        label: `Bank did not answer${ref ? ` · ref ${String(ref).slice(0, 8)}` : ''}`,
        tone: 'warning',
      };
    }
    case 'transfer.failed':
      return { label: `Transfer failed${d.error ? `: ${d.error}` : ''}`, tone: 'danger' };
    case 'transfer.resolved':
      return { label: `Operation resolved as ${d.status ?? 'unknown'}`, tone: 'neutral' };
    case 'transfer.cancelled':
      return { label: 'Proposal dismissed by the customer', tone: 'neutral' };
    case 'transfer.drafted':
      return { label: 'Transfer card opened', tone: 'neutral' };
    case 'intent.reconciled':
      return { label: 'Reconciled by operator', tone: 'positive' };
    case 'copilot.brief':
      return { label: 'Drafted a copilot brief', tone: 'neutral' };
    case 'case.closed':
      return { label: 'Case closed', tone: 'neutral' };
    default:
      return { label: e.kind, tone: 'neutral' };
  }
}
