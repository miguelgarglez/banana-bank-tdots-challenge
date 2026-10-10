import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { openai } from '../retrieval/embeddings';
import { searchDocuments } from '../retrieval/search';
import { caseDetail } from './view';
import { appDb } from '../db';
import { config } from '../config';
const briefSchema = z.object({
  summary: z.string(),
  verifiedFacts: z.array(z.string()),
  pendingChecks: z.array(z.string()),
  discrepancies: z.array(z.string()),
  suggestedActions: z.array(z.string()),
  draftReply: z.string(),
  sources: z.array(z.string()),
});
const jsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    verifiedFacts: { type: 'array', items: { type: 'string' } },
    pendingChecks: { type: 'array', items: { type: 'string' } },
    discrepancies: { type: 'array', items: { type: 'string' } },
    suggestedActions: { type: 'array', items: { type: 'string' } },
    draftReply: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'summary',
    'verifiedFacts',
    'pendingChecks',
    'discrepancies',
    'suggestedActions',
    'draftReply',
    'sources',
  ],
  additionalProperties: false,
};
const INSTRUCTIONS = `You are the support copilot for Banana Bank operators. You help a human operator understand a support case. Rules: Use only the evidence provided below (conversation, agent activity, app intents, bank ledger, reconciliation, documents). Never invent checks, amounts, dates or references that are not in the evidence. Separate verified facts (present in the bank ledger or app records) from pending checks (things nobody has verified yet). The bank ledger is the source of truth for money; a transport error or an app 'failed' status does not prove that no money moved. Operators cannot move customer money and must never execute another transfer to check a previous one. Cite document ids from the DOCUMENTS section when a policy matters. Write draftReply in clear, concise English addressed to the customer by first name, stating only verified facts and the concrete next step; do not promise actions the operator has not taken. Respond in the required JSON format.`;
export async function caseBrief(operatorId: string, caseId: string) {
  const detail = await caseDetail(operatorId, caseId);
  const sources = await searchDocuments(
    detail.lastMessage?.content || detail.incident.summary,
    'operator',
    5,
  );
  const input = [
    'CASE',
    JSON.stringify({ incident: detail.incident, customer: detail.customer }),
    'CONVERSATION',
    detail.history.map((m) => `${m.role}: ${m.content}`).join('\n') || '(none)',
    'AGENT ACTIVITY',
    detail.events
      .slice(-40)
      .map((e) => `${e.kind} ${JSON.stringify(e.data)}`)
      .join('\n') || '(none)',
    'APP INTENTS',
    JSON.stringify(detail.intents),
    'BANK LEDGER',
    detail.bank
      ? JSON.stringify({ accounts: detail.bank.accounts, operations: detail.bank.operations })
      : `unavailable: ${detail.bankError}`,
    'RECONCILIATION',
    JSON.stringify(detail.reconciliation),
    'GAPS',
    detail.gaps.join('\n') || '(none)',
    'DOCUMENTS',
    sources
      .map((s) => `${s.documentId} "${s.title}" v${s.version ?? '?'}: ${s.text.slice(0, 700)}`)
      .join('\n\n') || '(none)',
  ].join('\n');
  const response = await openai().responses.create({
    model: config.chatModel,
    instructions: INSTRUCTIONS,
    input,
    reasoning: { effort: 'low' },
    max_output_tokens: 1500,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'case_brief',
        strict: true,
        schema: jsonSchema,
      },
    },
  });
  let brief: z.infer<typeof briefSchema>;
  try {
    brief = briefSchema.parse(JSON.parse(response.output_text));
  } catch {
    brief = {
      summary: response.output_text,
      verifiedFacts: [],
      pendingChecks: [],
      discrepancies: [],
      suggestedActions: [],
      draftReply: '',
      sources: [],
    };
  }
  appDb()
    .prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?)')
    .run(
      randomUUID(),
      randomUUID(),
      operatorId,
      detail.incident.conversation_id,
      'copilot.brief',
      JSON.stringify({
        by: operatorId,
        model: response.model,
        verifiedFacts: brief.verifiedFacts.length,
        discrepancies: brief.discrepancies.length,
      }),
      new Date().toISOString(),
    );
  return { brief, model: response.model, usage: response.usage };
}
