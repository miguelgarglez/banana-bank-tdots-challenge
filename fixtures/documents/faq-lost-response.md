# Does a timeout mean it did not happen?

Document faq-lost-response. Version 2. Effective from 2026-09-01. Audience: customers. Banana Bank is a simulated bank: this document describes only the policies of the test environment, in euros. Balances and movements come from the customer's bank ledger, never from this document.

## Answer

No. A communication error can occur after the bank has recorded the debit and credit. Support queries the operation by its reference before repeating the attempt; until it is verified, the operation is reported as pending verification, not as failed.
