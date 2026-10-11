'use client';
import { useRef, useState } from 'react';
import { TextMorph } from 'torph/react';
import { sanitizeAmountInput } from '../../lib/transfer';

export default function AmountInput({
  value,
  onChange,
  compact,
  ariaLabel = 'Amount in euros',
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(value.length);
  const trackCaret = () => setCaret(inputRef.current?.selectionStart ?? value.length);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = sanitizeAmountInput(e.target.value);
    if (v === null) return;
    onChange(v);
    setCaret(e.target.selectionStart ?? v.length);
  };
  return (
    <div className={`amount-hero-input${compact ? ' compact' : ''}`}>
      <span className="amount-currency">€</span>
      <div className="amount-field">
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className="amount-native"
          value={value}
          onChange={handleChange}
          onSelect={trackCaret}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          required
        />
        <span className="amount-morph" aria-hidden="true" data-empty={!value || undefined}>
          <TextMorph cursorIndex={caret}>{value || '0.00'}</TextMorph>
        </span>
      </div>
    </div>
  );
}
