import { randomUUID } from 'node:crypto';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { toResponseInputItems } from 'openai/lib/responses/ResponseInputItems';
import { openai } from '../retrieval/embeddings';
import { searchDocuments } from '../retrieval/search';
import { knowledgeInstructions } from './prompt';
import { toolDefinitions, runTool } from './tools';
import { appDb } from '../db';
import { config } from '../config';
import { HttpError } from '../auth';
import type { SearchResult } from '../types';
const locks = new Set<string>();
export async function answerWithEvidence(question: string, sources: SearchResult[]) {
  const response = await openai().responses.create({
    model: config.chatModel,
    instructions: knowledgeInstructions(sources),
    input: question,
    reasoning: { effort: 'low' },
    max_output_tokens: 1200,
    store: false,
  });
  return { answer: response.output_text, model: response.model, usage: response.usage };
}
export async function sendMessage(userId: string, conversationId: string, content: string) {
  if (locks.has(conversationId))
    throw new HttpError(409, 'Wait for the previous response to finish.');
  locks.add(conversationId);
  const db = appDb(),
    runId = randomUUID(),
    now = new Date().toISOString();
  db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?)').run(
    runId,
    userId,
    conversationId,
    now,
    'running',
    null,
  );
  db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(
    randomUUID(),
    conversationId,
    'user',
    content,
    now,
    runId,
  );
  const { resolveIntent } = await import('../banking/actions');
  for (const i of db
    .prepare("SELECT id FROM intents WHERE user_id=? AND conversation_id IS ? AND status='unknown'")
    .all(userId, conversationId) as { id: string }[])
    await resolveIntent(userId, i.id);
  const unconfirmed = db
    .prepare(
      "SELECT id,bank_reference,payload FROM intents WHERE user_id=? AND conversation_id IS ? AND status='unknown'",
    )
    .all(userId, conversationId) as {
    id: string;
    bank_reference: string | null;
    payload: string;
  }[];
  try {
    const sources = await searchDocuments(content);
    const history = db
      .prepare(
        'SELECT role,content FROM messages WHERE conversation_id=? ORDER BY created_at,rowid',
      )
      .all(conversationId) as { role: 'user' | 'assistant'; content: string }[];
    const input: ResponseInputItem[] = history
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content }));
    let instructions =
      knowledgeInstructions(sources) +
      `\nYou may use tools to inspect accounts, transfer money, or request human support. The server determines the customer\'s identity. Do not invent balances or operation results: use tool results. Explain tool errors to the customer. Money never moves without confirmation. When transfer_money returns requires_confirmation, show the customer the exact summary (source account, recipient, amount in euros, concept) and ask for an explicit yes. Call confirm_transfer only after the customer explicitly confirms that exact summary in a later message. If any detail changes, propose again with transfer_money. If a tool returns status unknown, tell the customer the bank has not confirmed yet and that it must not be retried.`;
    const pending = db
      .prepare(
        `SELECT a.id,a.payload,a.expires_at FROM approvals a JOIN intents i ON i.id=a.intent_id
         WHERE a.user_id=? AND a.consumed_at IS NULL AND a.expires_at>? AND i.conversation_id IS ?`,
      )
      .all(userId, new Date().toISOString(), conversationId) as {
      id: string;
      payload: string;
      expires_at: string;
    }[];
    if (pending.length)
      instructions +=
        "\nPENDING TRANSFER PROPOSALS (awaiting the customer's explicit confirmation; confirm with confirm_transfer only when the customer clearly says yes to this exact summary):\n" +
        pending
          .map((a) =>
            JSON.stringify({ approvalId: a.id, ...JSON.parse(a.payload), expiresAt: a.expires_at }),
          )
          .join('\n');
    if (unconfirmed.length)
      instructions +=
        '\nUNCONFIRMED OPERATIONS (the bank has not confirmed these yet; never propose the same transfer again while listed; tell the customer it is being verified):\n' +
        unconfirmed
          .map((i) => {
            const p = JSON.parse(i.payload);
            return JSON.stringify({
              intentId: i.id,
              reference: i.bank_reference,
              amountCents: p.amountCents,
              toAccountId: p.toAccountId,
              concept: p.concept,
            });
          })
          .join('\n');
    let answer = 'I could not finish this request. Try again or ask for human support.';
    for (let round = 0; round < 7; round++) {
      const response = await openai().responses.create({
        model: config.chatModel,
        instructions,
        input,
        tools: toolDefinitions,
        parallel_tool_calls: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 2000,
        store: false,
        include: ['reasoning.encrypted_content'],
      });
      input.push(...toResponseInputItems(response.output));
      const calls = response.output.filter((x) => x.type === 'function_call');
      if (!calls.length) {
        answer = response.output_text || answer;
        break;
      }
      for (const call of calls) {
        let args: unknown;
        try {
          args = JSON.parse(call.arguments);
        } catch {
          args = {};
        }
        const result = await runTool(call.name, args, {
          userId,
          conversationId,
          runId,
          intentId: `${runId}:${call.call_id}`,
        });
        input.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      }
    }
    db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(
      randomUUID(),
      conversationId,
      'assistant',
      answer,
      new Date().toISOString(),
      runId,
    );
    db.prepare('UPDATE runs SET status=? WHERE id=?').run('completed', runId);
    return { runId, answer };
  } catch (e) {
    const api = e as { status?: number };
    const error = api.status
      ? `The AI provider returned ${api.status}. Check permissions and quota.`
      : e instanceof Error
        ? e.message
        : 'The response could not be completed.';
    db.prepare('UPDATE runs SET status=?,error=? WHERE id=?').run('failed', error, runId);
    db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?)').run(
      randomUUID(),
      conversationId,
      'assistant',
      `I could not complete the request: ${error}`,
      new Date().toISOString(),
      runId,
    );
    throw new HttpError(502, error);
  } finally {
    locks.delete(conversationId);
  }
}
