'use client';
import TransferTab from '../../components/TransferTab';
import RoleGate from '../../components/RoleGate';
import { useApp } from '../../providers/AppProvider';

export default function TransfersPage() {
  const app = useApp();
  return (
    <RoleGate role="customer">
      <TransferTab
        dashboard={app.dashboard!}
        people={app.people}
        from={app.from}
        to={app.to}
        amount={app.amount}
        concept={app.concept}
        busy={app.busy}
        setFrom={app.setFrom}
        setTo={app.setTo}
        setAmount={app.setAmount}
        setConcept={app.setConcept}
        onSubmit={app.submitTransfer}
        onOverview={() => app.setTab('overview')}
        approval={app.manualApproval}
        outcome={app.transferOutcome}
        onConfirm={app.confirm}
        onDismiss={app.dismiss}
        onReset={app.resetTransfer}
      />
    </RoleGate>
  );
}
