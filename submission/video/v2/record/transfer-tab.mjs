import { scenario } from './lib.mjs';
import { runTransfer } from './transfer-flow.mjs';

console.log(scenario('normal'));
await runTransfer({
  name: 'transfer-tab',
  recipient: 'Carla',
  amount: '25',
  description: 'Team lunch',
});
