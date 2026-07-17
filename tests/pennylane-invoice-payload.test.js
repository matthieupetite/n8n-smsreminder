const assert = require('assert');
const {
  buildTransactionReferencePayload,
  appendTransactionReferenceToCreatePayload,
  resolveInvoiceIssueDate,
} = require('../dist/nodes/Pennylane/invoicePayloadUtils.js');

const payload = buildTransactionReferencePayload({
  banking_provider: 'stripe',
  provider_field_name: 'payment_id',
  provider_field_value: 'INV-001',
});

assert.deepStrictEqual(payload, {
  banking_provider: 'stripe',
  provider_field_name: 'payment_id',
  provider_field_value: 'INV-001',
});

const invalidPayload = buildTransactionReferencePayload({
  banking_provider: 'demo_bank',
  provider_field_name: 'reference',
  provider_field_value: 'INV-001',
});
assert.strictEqual(invalidPayload, null);

const createPayload = {};
appendTransactionReferenceToCreatePayload(createPayload, {
  banking_provider: 'gocardless',
  provider_field_name: 'charge_id',
  provider_field_value: 'INV-001',
});

assert.deepStrictEqual(createPayload.transaction_reference, {
  banking_provider: 'gocardless',
  provider_field_name: 'charge_id',
  provider_field_value: 'INV-001',
});

assert.strictEqual(resolveInvoiceIssueDate('2024-01-01', false, '2024-01-15'), '2024-01-15');
assert.strictEqual(resolveInvoiceIssueDate('2024-01-01', true, '2024-01-15'), '2024-01-01');
assert.strictEqual(resolveInvoiceIssueDate('2024-01-01', false), '2024-01-01');

console.log('Pennylane invoice payload regression test passed');
