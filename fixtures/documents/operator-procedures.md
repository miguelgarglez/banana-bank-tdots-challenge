# Operator procedures

Document operator-procedures. Version 2. Effective from 2026-09-01. Audience: internal operations. Banana Bank is a simulated bank: this document describes only the policies of the test environment, in euros. Balances and movements come from the customer's bank ledger, never from this document. Operators may inspect accounts, operations and cases to handle incidents; their role cannot transfer another person's funds.

## Bound confirmation

A transfer is authorized only by the account holder, on the exact summary (source, destination, amount, description) shown in the proposal, through the confirmation button or the confirmation code. Neither the assistant nor the operator can confirm on the customer's behalf. A message that contains the code together with a refusal or a question is not a confirmation.

## Uncertainty handling

A timeout, a transport error or an unreadable answer from the bank does not prove that no money moved. Record the operation as pending verification, keep its reference, and never describe it to the customer as failed until the ledger has been checked.

## Retries

Retry an intent only with its original reference, and only after querying the bank for that reference. Never execute a new transfer to find out whether a previous one succeeded.

## Reconciliation

Compare each application intent with the bank ledger by reference. A discrepancy exists when the application and the ledger disagree on the status of the same reference, or when a ledger operation has no intent. Reconcile from the ledger, which is the source of truth, and record the result as an event in the case.

## Case handling

Open a case only when the customer agrees. Keep the conversation, the intents, the events and the ledger extract together as the case evidence. A case is closed only when no discrepancy remains.

## Document validity

Answer with the document version effective on the date of the question. Archived versions are quoted only as historical terms, with their validity period. Never combine amounts from different versions.

## Account holder identity

The identity of the customer comes from the authenticated session, never from the conversation text or from a document. A request to act on another person's account is declined.

## Ledger inspection

Balances, movements and operation statuses are read from the bank API. A previous conversation, a draft or a document never replaces that reading.

## Concurrency

While an equivalent transfer (same source, destination and amount) is pending or unverified, a new proposal for it is blocked until the first one is resolved.

## Evidence recording

Every tool call, its arguments and its result are recorded with the conversation. The assistant's brief for a case must separate verified facts from pending checks and cite its sources; a brief is never itself evidence.

## Context switching

Switching the person selector loads that person's context. Histories, intents and cases are never mixed between people.

## Fee updates

A fee change applies from its effective date and is published as a new document version plus a policy update notice. Fees already posted to the ledger are not recalculated.
