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
      {notice && (
        <div className="alert notice" role="status">
          {notice}
          <button onClick={onDismissNotice} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      )}
    </>
  );
}
