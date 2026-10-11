import type { Person } from '../../src/types';
import Avatar from './Avatar';
import Select from './Select';

export default function TopBar({
  operator,
  current,
  people,
  onSelect,
}: {
  operator: boolean;
  current: Person | null;
  people: Person[];
  onSelect: (id: string) => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        Banana Bank <span>/</span> {operator ? 'Customer support' : 'Personal banking'}
      </div>
      <div className="persona-control">
        <span className="demo-label">VIEW AS</span>
        <Select
          ariaLabel="Switch person"
          variant="chrome"
          value={current?.id || ''}
          disabled={!people.length}
          placeholder="Loading…"
          onChange={onSelect}
          options={[
            ...people
              .filter((p) => p.role === 'customer')
              .map((p) => ({
                value: p.id,
                label: p.name,
                group: 'Customers',
                leading: <Avatar initials={p.initials} color={p.color} size={24} />,
              })),
            ...people
              .filter((p) => p.role === 'operator')
              .map((p) => ({
                value: p.id,
                label: p.name,
                description: 'Operator',
                group: 'Operators',
                leading: <Avatar initials={p.initials} color={p.color} size={24} />,
              })),
          ]}
        />
      </div>
    </header>
  );
}
