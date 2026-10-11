'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Person } from '../../src/types';
import { api, type AnyRecord } from '../lib/api';
import { parseAmount } from '../lib/transfer';

export function useBananaApp() {
  const router = useRouter();
  const pathname = usePathname();
  const [people, setPeople] = useState<Person[]>([]),
    [current, setCurrent] = useState<Person | null>(null);
  const [dashboard, setDashboard] = useState<AnyRecord | null>(null),
    [conversations, setConversations] = useState<AnyRecord[]>([]),
    [conversationId, setConversationId] = useState<string | null>(null),
    [messages, setMessages] = useState<AnyRecord[]>([]);
  const [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [docs, setDocs] = useState<AnyRecord[]>([]),
    [document, setDocument] = useState<AnyRecord | null>(null),
    [query, setQuery] = useState(''),
    [sources, setSources] = useState<AnyRecord[] | null>(null);
  const [selectedCase, setSelectedCase] = useState<AnyRecord | null>(null),
    [brief, setBrief] = useState<AnyRecord | null>(null),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [amount, setAmount] = useState(''),
    [concept, setConcept] = useState('');
  const [manualIntentId, setManualIntentId] = useState<string | null>(null),
    [transferOutcome, setTransferOutcome] = useState<AnyRecord | null>(null);
  const activeConversation = useRef<string | null>(null);
  const generation = useRef(0),
    messagesEnd = useRef<HTMLDivElement>(null);
  async function refresh(g = generation.current) {
    const data = await api('dashboard');
    if (g !== generation.current) return;
    setDashboard(data);
    if (manualIntentId && !data.approvals?.some((a: AnyRecord) => a.intent_id === manualIntentId))
      setManualIntentId(null);
    if (data.accounts?.length)
      setFrom((v) => (data.accounts.some((a: AnyRecord) => a.id === v) ? v : data.accounts[0].id));
  }
  async function selectPerson(id: string, { navigate = true }: { navigate?: boolean } = {}) {
    const g = ++generation.current;
    const startPath = window.location.pathname;
    setCurrent(null);
    setDashboard(null);
    setConversations([]);
    activeConversation.current = null;
    setConversationId(null);
    setMessages([]);
    setSelectedCase(null);
    setBrief(null);
    setDocument(null);
    setDocs([]);
    setSources(null);
    setQuery('');
    setError('');
    setNotice('');
    setBusy(false);
    setText('');
    setFrom('');
    setTo('');
    setAmount('');
    setConcept('');
    setManualIntentId(null);
    setTransferOutcome(null);
    try {
      const result = await api('session', { userId: id });
      if (g !== generation.current) return;
      setCurrent(result.person);
      await refresh(g);
      api('documents')
        .then((r) => {
          if (g === generation.current) setDocs(r.documents);
        })
        .catch(() => {});
      if (result.person.role === 'customer') {
        const cs = await api('conversations');
        if (g === generation.current) setConversations(cs);
      }
      if (navigate && g === generation.current && window.location.pathname === startPath)
        router.replace(result.person.role === 'operator' ? '/cases' : '/overview');
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    api('people').then(setPeople);
    api('session')
      .then((x) => selectPerson(x.person.id, { navigate: false }))
      .catch(() => selectPerson('lucia', { navigate: false }));
  }, []);
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  async function openConversation(
    id: string,
    { navigate = true }: { navigate?: boolean } = {},
  ): Promise<boolean> {
    const g = generation.current;
    activeConversation.current = id;
    setConversationId(id);
    setMessages([]);
    setError('');
    try {
      const c = await api(`conversations/${id}`);
      if (g === generation.current && activeConversation.current === id) setMessages(c.messages);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
      return false;
    }
    if (navigate && g === generation.current) router.push(`/assistant/${id}`);
    return true;
  }
  function newConversation() {
    activeConversation.current = null;
    setConversationId(null);
    setMessages([]);
    setError('');
    router.push('/assistant');
  }
  async function send(value = text) {
    if (!value.trim() || busy || !current) return;
    const g = generation.current;
    setBusy(true);
    setError('');
    setText('');
    let id = conversationId;
    try {
      if (!id) {
        const c = await api('conversations', {});
        if (g !== generation.current) return;
        id = c.id;
        activeConversation.current = id;
        setConversationId(id);
        router.replace(`/assistant/${id}`);
      }
      setMessages((m) => [
        ...m,
        { id: 'pending-user', role: 'user', content: value, created_at: new Date().toISOString() },
      ]);
      await api(`conversations/${id}/messages`, { content: value });
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) {
        try {
          if (id) {
            const c = await api(`conversations/${id}`);
            if (g === generation.current && activeConversation.current === id)
              setMessages(c.messages);
          }
          const cs = await api('conversations');
          if (g === generation.current) setConversations(cs);
          await refresh(g);
        } catch {}
        if (g === generation.current) setBusy(false);
      }
    }
  }
  async function reloadMessages() {
    const g = generation.current;
    const id = conversationId;
    if (!id) return;
    try {
      const c = await api(`conversations/${id}`);
      if (g === generation.current && activeConversation.current === id) setMessages(c.messages);
    } catch {}
  }
  async function submitChatTransfer(
    intentId: string,
    args: {
      fromAccountId: string;
      toAccountId: string;
      amountCents: number;
      concept: string;
    },
  ) {
    const g = generation.current;
    setBusy(true);
    setError('');
    try {
      await api('actions', {
        name: 'transfer_money',
        intentId,
        arguments: args,
        conversationId,
      });
      if (g !== generation.current) return;
      await reloadMessages();
      await refresh(g);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function openLibrary({ navigate = true }: { navigate?: boolean } = {}) {
    const g = generation.current;
    if (navigate && pathname !== '/documents') router.push('/documents');
    setDocument(null);
    try {
      const result = await api('documents');
      if (g === generation.current) setDocs(result.documents);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    }
  }
  async function submitTransfer() {
    const g = generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    const amountCents = parseAmount(amount);
    if (amountCents === null) {
      setError('Enter a valid amount.');
      setBusy(false);
      return;
    }
    if (!to) {
      setError('Choose a recipient.');
      setBusy(false);
      return;
    }
    try {
      const intentId = manualIntentId ?? crypto.randomUUID();
      if (!manualIntentId) setManualIntentId(intentId);
      const args = { fromAccountId: from, toAccountId: to, amountCents, concept };
      const result = await api('actions', {
        name: 'transfer_money',
        intentId,
        arguments: args,
        conversationId,
      });
      if (g !== generation.current) return;
      if (['completed', 'unknown', 'failed', 'blocked'].includes(result.status)) {
        setTransferOutcome({ ...result, payload: args });
        setManualIntentId(null);
      }
      await refresh(g);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function confirm(id: string) {
    const g = generation.current;
    try {
      const approval = dashboard?.approvals?.find((a: AnyRecord) => a.id === id);
      const isManual = approval?.intent_id === manualIntentId;
      const result = await api(`approvals/${id}/confirm`, {});
      if (g !== generation.current) return;
      if (isManual) {
        setTransferOutcome({ ...result, payload: approval.payload });
        setManualIntentId(null);
      } else {
        setNotice(
          result.status === 'completed'
            ? 'Transfer confirmed and completed.'
            : result.error || result.status,
        );
      }
      await refresh(g);
      await reloadMessages();
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    }
  }
  async function dismiss(id: string) {
    const g = generation.current;
    try {
      await api(`approvals/${id}/dismiss`, {});
      if (g !== generation.current) return;
      if (dashboard?.approvals?.find((a: AnyRecord) => a.id === id)?.intent_id === manualIntentId)
        setManualIntentId(null);
      else setNotice('Proposal dismissed.');
      await refresh(g);
      await reloadMessages();
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    }
  }
  function resetTransfer() {
    setTransferOutcome(null);
    setManualIntentId(null);
    setTo('');
    setAmount('');
    setConcept('');
  }
  async function openCase(
    id: string,
    { navigate = true }: { navigate?: boolean } = {},
  ): Promise<boolean> {
    const g = generation.current;
    try {
      const d = await api(`incidents/${id}`);
      if (g === generation.current) {
        if (selectedCase?.incident.id !== id) setBrief(null);
        setSelectedCase(d);
        if (navigate) router.push(`/cases/${id}`);
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function closeCase() {
    if (!selectedCase) return;
    const g = generation.current;
    try {
      const d = await api(`incidents/${selectedCase.incident.id}/close`, {});
      if (g === generation.current) {
        setBrief(null);
        setSelectedCase(d);
        await refresh(g);
        router.push('/cases');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reconcileCase(intentId: string) {
    if (!selectedCase) return;
    const g = generation.current;
    try {
      const d = await api(`incidents/${selectedCase.incident.id}/reconcile`, { intentId });
      if (g === generation.current) {
        setBrief(null);
        setSelectedCase(d);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function draftBrief() {
    if (!selectedCase) return;
    const g = generation.current,
      caseId = selectedCase.incident.id;
    setBusy(true);
    try {
      const d = await api(`incidents/${caseId}/brief`, {});
      if (g === generation.current) setBrief({ ...d.brief, caseId, model: d.model });
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function updateIndex() {
    const g = generation.current;
    setBusy(true);
    try {
      const r = await api('ingestion', {});
      if (g !== generation.current) return;
      setNotice(`Index updated: ${r.documents} documents, ${r.chunks} excerpts.`);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function searchDocs() {
    const g = generation.current;
    setBusy(true);
    try {
      const result = await api('search', { query });
      if (g === generation.current) setSources(result.sources);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    } finally {
      if (g === generation.current) setBusy(false);
    }
  }
  async function openSource(id: string) {
    await openDocument(id);
  }
  async function openDocument(id: string): Promise<boolean> {
    const g = generation.current;
    try {
      const result = await api(`documents/${id}`);
      if (g === generation.current) {
        setDocument(result);
        if (pathname !== `/documents/${id}`) router.push(`/documents/${id}`);
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  const resetManual = (fn: (v: string) => void) => (v: string) => {
    setManualIntentId(null);
    fn(v);
  };
  const manualApproval =
    dashboard?.approvals?.find((a: AnyRecord) => a.intent_id === manualIntentId) ?? null;
  const accountLabel = (id: string) =>
    dashboard?.accounts?.find((x: AnyRecord) => x.id === id)?.label || id;
  const contactLabel = (id: string) => {
    const c = dashboard?.contacts?.find((x: AnyRecord) => x.id === id);
    return c ? `${c.name} · ${c.label}` : id;
  };
  const operator = current?.role === 'operator';
  const tab =
    pathname === '/transfers'
      ? 'transfer'
      : pathname.startsWith('/assistant')
        ? 'chat'
        : pathname.startsWith('/documents')
          ? 'documents'
          : 'overview';
  function setTab(id: string) {
    const targets: Record<string, string> = operator
      ? { overview: '/cases', chat: '/assistant', transfer: '/transfers', documents: '/documents' }
      : {
          overview: '/overview',
          chat: '/assistant',
          transfer: '/transfers',
          documents: '/documents',
        };
    if (targets[id]) router.push(targets[id]);
  }
  const nav = operator
    ? [
        ['overview', 'overview', 'Cases', '/cases'],
        ['documents', 'document', 'Documents', '/documents'],
      ]
    : [
        ['overview', 'overview', 'Overview', '/overview'],
        ['chat', 'chat', 'Assistant', '/assistant'],
        ['transfer', 'transfer', 'Transfers', '/transfers'],
        ['documents', 'document', 'Documents', '/documents'],
      ];
  return {
    people,
    current,
    tab,
    setTab,
    dashboard,
    conversations,
    conversationId,
    messages,
    text,
    setText,
    busy,
    error,
    setError,
    notice,
    setNotice,
    docs,
    document,
    query,
    setQuery,
    sources,
    setSources,
    selectedCase,
    brief,
    from,
    setFrom: resetManual(setFrom),
    to,
    setTo: resetManual(setTo),
    amount,
    setAmount: resetManual(setAmount),
    concept,
    setConcept: resetManual(setConcept),
    manualApproval,
    transferOutcome,
    resetTransfer,
    messagesEnd,
    nav,
    operator,
    accountLabel,
    contactLabel,
    refresh,
    selectPerson,
    openConversation,
    newConversation,
    send,
    openLibrary,
    submitTransfer,
    submitChatTransfer,
    confirm,
    dismiss,
    openCase,
    closeCase,
    reconcileCase,
    draftBrief,
    updateIndex,
    searchDocs,
    openDocument,
    openSource,
  };
}
