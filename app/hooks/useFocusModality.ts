'use client';
import { useEffect } from 'react';

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'CapsLock',
  'Dead',
  'Fn',
]);

export function useFocusModality() {
  useEffect(() => {
    const onPointer = () => {
      document.documentElement.dataset.focus = 'pointer';
    };
    const onKey = (e: KeyboardEvent) => {
      if (MODIFIER_KEYS.has(e.key)) return;
      document.documentElement.dataset.focus = 'keyboard';
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);
}
