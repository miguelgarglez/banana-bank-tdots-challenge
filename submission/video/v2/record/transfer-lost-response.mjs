import { scenario, sql, BANK_DB } from './lib.mjs';
import { runTransfer } from './transfer-flow.mjs';

console.log(scenario('lost-response'));
try {
  await runTransfer({
    name: 'transfer-lost-response',
    recipient: 'Bruno',
    amount: '10',
    description: 'Lost response check',
  });
  const ops = sql(
    BANK_DB,
    'SELECT reference, amountCents, status, createdAt FROM operations ORDER BY createdAt DESC LIMIT 3;',
  );
  console.log('LEDGER latest operations:\n' + ops);
} finally {
  console.log('restore scenario:', scenario('intermittent', 17));
}
