'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ChatTab from '../../../components/ChatTab';
import RoleGate from '../../../components/RoleGate';
import { useApp } from '../../../providers/AppProvider';

export default function ConversationPage() {
  const app = useApp();
  const router = useRouter();
  const { conversationId } = useParams<{ conversationId: string }>();
  useEffect(() => {
    if (!conversationId || app.conversationId === conversationId) return;
    let cancelled = false;
    (async () => {
      const ok = await app.openConversation(conversationId, { navigate: false });
      if (!ok && !cancelled) router.replace('/assistant');
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);
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
