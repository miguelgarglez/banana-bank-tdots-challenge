'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DocumentsTab from '../../../components/DocumentsTab';
import { useApp } from '../../../providers/AppProvider';

export default function DocumentPage() {
  const app = useApp();
  const router = useRouter();
  const { docId } = useParams<{ docId: string }>();
  useEffect(() => {
    if (!docId || app.document?.id === docId) return;
    let cancelled = false;
    (async () => {
      const ok = await app.openDocument(docId);
      if (!ok && !cancelled) router.replace('/documents');
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);
  return (
    <DocumentsTab
      operator={app.operator}
      busy={app.busy}
      docs={app.docs}
      document={app.document}
      query={app.query}
      sources={app.sources}
      onIngest={app.updateIndex}
      onSearch={app.searchDocs}
      onQuery={app.setQuery}
      onCloseSources={() => app.setSources(null)}
      onOpenDoc={app.openDocument}
    />
  );
}
