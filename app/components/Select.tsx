import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  group?: string;
  disabled?: boolean;
};

type Row =
  { type: 'group'; label: string } | { type: 'option'; option: SelectOption; index: number };

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  variant = 'field',
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel: string;
  variant?: 'field' | 'chrome';
  disabled?: boolean;
  id?: string;
}) {
  const uid = useId();
  const listId = `${id ?? uid}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);
  const buffer = useRef('');
  const bufferTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const rows: Row[] = [];
  let lastGroup: string | undefined;
  options.forEach((option, index) => {
    if (option.group !== lastGroup) {
      lastGroup = option.group;
      if (option.group) rows.push({ type: 'group', label: option.group });
    }
    rows.push({ type: 'option', option, index });
  });
  const enabled = options.filter((o) => !o.disabled);
  const selected = options.find((o) => o.value === value);

  const close = (focus = false) => {
    if (!open) return;
    setLeaving(true);
    setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 120);
    if (focus) triggerRef.current?.focus();
  };
  const openList = () => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    setUp(!!rect && window.innerHeight - rect.bottom < 320 && rect.top > 320);
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
    setLeaving(false);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (open)
      rootRef.current?.querySelector('.select-option.active')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const move = (next: number) => {
    const count = options.length;
    let i = next;
    while (options[i]?.disabled && i >= 0 && i < count) i += next > active ? 1 : -1;
    if (options[i] && !options[i].disabled) setActive(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        openList();
        if (e.key === 'ArrowUp') setActive(options.length - 1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(Math.min(active + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(Math.max(active - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key.length === 1) {
      buffer.current += e.key.toLowerCase();
      if (bufferTimer.current) clearTimeout(bufferTimer.current);
      bufferTimer.current = setTimeout(() => (buffer.current = ''), 500);
      const hit = options.findIndex(
        (o, i) => i > active && !o.disabled && o.label.toLowerCase().startsWith(buffer.current),
      );
      const wrap = enabled.findIndex((o) => o.label.toLowerCase().startsWith(buffer.current));
      if (hit >= 0) setActive(hit);
      else if (wrap >= 0) setActive(options.indexOf(enabled[wrap]));
    }
  };

  return (
    <div className={`select select-${variant}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className="select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close(true) : openList())}
        onKeyDown={onKeyDown}
      >
        {selected?.leading}
        <span className="select-value">
          <span className="select-label">{selected?.label ?? placeholder}</span>
          {selected?.description && (
            <span className="select-description">{selected.description}</span>
          )}
        </span>
        <span className={`select-chevron${open ? ' open' : ''}`}>
          <Icon name="chevron" />
        </span>
      </button>
      {open && (
        <ul
          className={`select-popover${up ? ' up' : ''}${leaving ? ' leaving' : ''}`}
          role="listbox"
          id={listId}
          aria-label={ariaLabel}
        >
          {rows.map((row, i) =>
            row.type === 'group' ? (
              <li className="select-group" role="presentation" key={`g-${row.label}-${i}`}>
                {row.label}
              </li>
            ) : (
              <li
                key={row.option.value || `empty-${row.index}`}
                id={`${listId}-opt-${row.index}`}
                className={`select-option${row.index === active ? ' active' : ''}${row.option.value === value ? ' selected' : ''}`}
                role="option"
                aria-selected={row.option.value === value}
                aria-disabled={row.option.disabled || undefined}
                onMouseEnter={() => !row.option.disabled && setActive(row.index)}
                onClick={() => choose(row.index)}
              >
                {row.option.leading}
                <span className="select-value">
                  <span className="select-label">{row.option.label}</span>
                  {row.option.description && (
                    <span className="select-description">{row.option.description}</span>
                  )}
                </span>
                {row.option.value === value && (
                  <span className="select-check">
                    <Icon name="check" />
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
