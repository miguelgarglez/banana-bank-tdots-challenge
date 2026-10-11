'use client';
import { TextMorph } from 'torph/react';
import { money } from '../../lib/format';

export default function AmountHero({ cents, size = 'lg' }: { cents: number; size?: 'lg' | 'md' }) {
  return (
    <div className={`amount-hero${size === 'md' ? ' md' : ''}`}>
      <TextMorph>{money(cents)}</TextMorph>
    </div>
  );
}
