export type Person = {
  id: string;
  name: string;
  role: 'customer' | 'operator';
  initials: string;
  color: string;
};
export type Account = {
  id: string;
  userId: string;
  label: string;
  iban: string;
  balanceCents: number;
};
export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  concept: string;
};
export type Operation = TransferInput & {
  id: string;
  userId: string;
  reference: string;
  createdAt: string;
  status: 'completed';
};
export type TransferProposal = {
  fromAccountId: string;
  fromLabel: string;
  toAccountId: string;
  toName: string | null;
  toLabel: string | null;
  amountCents: number;
  concept: string;
};
export type DispatchResult =
  | { status: 'completed'; operation: Operation }
  | { status: 'unknown'; reference: string; error: string };
export type ToolContext = {
  userId: string;
  conversationId: string | null;
  runId: string;
  intentId: string;
  approvalId?: string;
};
export type ActionResult = { status: string; [key: string]: unknown };
export type DocumentRecord = {
  id: string;
  title: string;
  file: string;
  version: number;
  validFrom: string;
  validTo: string | null;
  audience: 'public' | 'internal';
  family: string;
};
export type Chunk = {
  id: string;
  documentId: string;
  text: string;
  title: string | null;
  version: number | null;
  validFrom: string | null;
  validTo: string | null;
  audience: string;
  vector?: number[];
};
export type SearchResult = Omit<Chunk, 'vector'> & { score: number };
export type IntentRecord = {
  id: string;
  status: string;
  payload: TransferInput;
  bankReference: string | null;
  operationId: string | null;
  error: string | null;
  createdAt: string;
  conversationId: string | null;
  runId: string | null;
};
export type Reconciliation = {
  intentId: string;
  reference: string | null;
  amountCents: number;
  appStatus: string;
  bankStatus: 'completed' | 'not_found' | 'unverified';
  operation: Operation | null;
  finding: string | null;
  fixable: boolean;
};
export type CaseDetail = {
  incident: {
    id: string;
    user_id: string;
    conversation_id: string;
    summary: string;
    status: string;
    created_at: string;
  };
  customer: Person | undefined;
  lastMessage: { id: string; role: string; content: string; created_at: string } | undefined;
  history: { id: string; role: string; content: string; created_at: string }[];
  events: { id: string; kind: string; data: unknown; created_at: string }[];
  intents: IntentRecord[];
  bank: { accounts: Account[]; operations: Operation[] } | null;
  bankError: string | null;
  reconciliation: Reconciliation[];
  gaps: string[];
};
