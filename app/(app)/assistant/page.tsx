'use client';
import ChatTab from '../../components/ChatTab';
import RoleGate from '../../components/RoleGate';
import { useApp } from '../../providers/AppProvider';

export default function AssistantPage() {
  const app = useApp();
  return (
    <RoleGate role="customer">
      <ChatTab
        dashboard={app.dashboard!}
        people={app.people}
        onTransferSubmit={app.submitChatTransfer}
        onConfirm={app.confirm}
        onDismiss={app.dismiss}
        onOverview={() => app.setTab('overview')}
        conversations={app.conversations}
        conversationId={app.conversationId}
        messages={app.messages}
        busy={app.busy}
        text={app.text}
        messagesEnd={app.messagesEnd}
        onNew={app.newConversation}
        onOpen={app.openConversation}
        onSend={app.send}
        onText={app.setText}
        docs={app.docs}
        onOpenSource={app.openSource}
      />
    </RoleGate>
  );
}
