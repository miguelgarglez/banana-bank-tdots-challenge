import { useEffect, useRef, useState } from 'react';

export default function Notice({
  error,
  notice,
  onDismissError,
  onDismissNotice,
}: {
  error: string;
  notice: string;
  onDismissError: () => void;
  onDismissNotice: () => void;
}) {
  const [shownNotice, setShownNotice] = useState(notice);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (notice) {
      if (timer.current) clearTimeout(timer.current);
      setShownNotice(notice);
      setLeaving(false);
      return;
    }
    if (shownNotice) {
      setLeaving(true);
      timer.current = setTimeout(() => {
        setShownNotice('');
        setLeaving(false);
      }, 160);
      return () => {
        if (timer.current) clearTimeout(timer.current);
      };
    }
  }, [notice]);

  return (
    <>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button onClick={onDismissError} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {shownNotice && (
        <div className={`alert notice${leaving ? ' leaving' : ''}`} role="status">
          {shownNotice}
          <button
            onClick={() => {
              setLeaving(true);
              onDismissNotice();
            }}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
