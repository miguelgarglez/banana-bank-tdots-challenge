'use client';
import { useEffect, useRef, useState } from 'react';
import type { Person } from '../../src/types';
import { api, type AnyRecord } from '../lib/api';

export function useBananaApp() {
  const [people, setPeople] = useState<Person[]>([]),
    [current, setCurrent] = useState<Person | null>(null),
    [tab, setTab] = useState('overview');
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
  const activeConversation = useRef<string | null>(null),
    manualIntentId = useRef<string | null>(null);
  const generation = useRef(0),
    messagesEnd = useRef<HTMLDivElement>(null);
  async function refresh(g = generation.current) {
    const data = await api('dashboard');
    if (g !== generation.current) return;
    setDashboard(data);
    if (
      manualIntentId.current &&
      !data.approvals?.some((a: AnyRecord) => a.intent_id === manualIntentId.current)
    )
      manualIntentId.current = null;
    if (data.accounts?.length)
      setFrom((v) => (data.accounts.some((a: AnyRecord) => a.id === v) ? v : data.accounts[0].id));
  }
  async function selectPerson(id: string) {
    const g = ++generation.current;
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
    setError('');
    setNotice('');
    setBusy(false);
    setText('');
    setFrom('');
    setTo('');
    setAmount('');
    setConcept('');
    setTab('overview');
    try {
      const result = await api('session', { userId: id });
      if (g !== generation.current) return;
      setCurrent(result.person);
      await refresh(g);
      if (result.person.role === 'customer') {
        const cs = await api('conversations');
        if (g === generation.current) setConversations(cs);
      }
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    api('people').then(setPeople);
    api('session')
      .then((x) => selectPerson(x.person.id))
      .catch(() => selectPerson('lucia'));
  }, []);
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);
  async function openConversation(id: string) {
    const g = generation.current;
    activeConversation.current = id;
    setConversationId(id);
    setTab('chat');
    setMessages([]);
    setError('');
    try {
      const c = await api(`conversations/${id}`);
      if (g === generation.current && activeConversation.current === id) setMessages(c.messages);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    }
  }
  async function newConversation() {
    const g = generation.current;
    try {
      const c = await api('conversations', {});
      if (g !== generation.current) return;
      const cs = await api('conversations');
      if (g !== generation.current) return;
      setConversations(cs);
      activeConversation.current = c.id;
      setConversationId(c.id);
      setMessages([]);
      setTab('chat');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
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
      }
      setTab('chat');
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
  async function openLibrary() {
    const g = generation.current;
    setTab('documents');
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
    try {
      if (!manualIntentId.current) manualIntentId.current = crypto.randomUUID();
      const result = await api('actions', {
        name: 'transfer_money',
        intentId: manualIntentId.current,
        arguments: {
          fromAccountId: from,
          toAccountId: to,
          amountCents: Math.round(Number(amount.replace(',', '.')) * 100),
          concept,
        },
        conversationId,
      });
      if (g !== generation.current) return;
      if (['completed', 'failed', 'blocked'].includes(result.status)) manualIntentId.current = null;
      setNotice(
        result.status === 'completed'
          ? 'Transfer completed. You can check it in your activity.'
          : result.status === 'requires_confirmation'
            ? 'Review the proposal to confirm the transfer.'
            : result.error || 'The operation is still pending.',
      );
      if (result.status === 'requires_confirmation') setTab('overview');
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
      const result = await api(`approvals/${id}/confirm`, {});
      if (g !== generation.current) return;
      manualIntentId.current = null;
      setNotice(
        result.status === 'completed'
          ? 'Transfer confirmed and completed.'
          : result.error || result.status,
      );
      await refresh(g);
    } catch (e) {
      if (g === generation.current) setError((e as Error).message);
    }
  }
  async function openCase(id: string) {
    const g = generation.current;
    try {
      const d = await api(`incidents/${id}`);
      if (g === generation.current) {
        if (selectedCase?.incident.id !== id) setBrief(null);
        setSelectedCase(d);
      }
    } catch (e) {
      setError((e as Error).message);
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
      if (g === generation.current) setBrief({ ...d.brief, caseId });
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function searchDocs() {
    const g = generation.current;
    setBusy(true);
    try {
      const result = await api('search', { query });
      if (g === generation.current) setSources(result.sources);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openDocument(id: string) {
    const g = generation.current;
    try {
      const result = await api(`documents/${id}`);
      if (g === generation.current) setDocument(result);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const resetManual = (fn: (v: string) => void) => (v: string) => {
    manualIntentId.current = null;
    fn(v);
  };
  const accountLabel = (id: string) =>
    dashboard?.accounts?.find((x: AnyRecord) => x.id === id)?.label || id;
  const contactLabel = (id: string) => {
    const c = dashboard?.contacts?.find((x: AnyRecord) => x.id === id);
    return c ? `${c.name} · ${c.label}` : id;
  };
  const operator = current?.role === 'operator';
  const nav = operator
    ? [
        ['overview', 'overview', 'Cases'],
        ['documents', 'document', 'Documents'],
      ]
    : [
        ['overview', 'overview', 'Overview'],
        ['chat', 'chat', 'Assistant'],
        ['transfer', 'transfer', 'Transfers'],
        ['documents', 'document', 'Documents'],
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
    confirm,
    openCase,
    closeCase,
    reconcileCase,
    draftBrief,
    updateIndex,
    searchDocs,
    openDocument,
  };
}
