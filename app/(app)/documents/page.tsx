'use client';
import { useEffect } from 'react';
import DocumentsTab from '../../components/DocumentsTab';
import { useApp } from '../../providers/AppProvider';

export default function DocumentsPage() {
  const app = useApp();
  useEffect(() => {
    app.openLibrary({ navigate: false });
  }, []);
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
