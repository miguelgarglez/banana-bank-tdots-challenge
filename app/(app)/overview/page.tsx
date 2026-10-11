'use client';
import OverviewTab from '../../components/OverviewTab';
import RoleGate from '../../components/RoleGate';
import { useApp } from '../../providers/AppProvider';

export default function OverviewPage() {
  const app = useApp();
  return (
    <RoleGate role="customer">
      <OverviewTab
        name={app.current!.name}
        dashboard={app.dashboard!}
        onChat={() => app.setTab('chat')}
        onTransfer={() => app.setTab('transfer')}
      />
    </RoleGate>
  );
}
