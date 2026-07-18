export interface TransactionReferencePayload {
  banking_provider: string;
  provider_field_name: string;
  provider_field_value: string;
}

const allowedBankingProviders = ['stripe', 'gocardless', 'bank', 'budgetinsight'];
const allowedProviderFieldNames = ['payment_id', 'charge_id', 'report_id', 'web_id', 'label'];

function normalizeEnumValue(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function buildTransactionReferencePayload(input?: Partial<TransactionReferencePayload> | null): TransactionReferencePayload | null {
  if (!input) {
    return null;
  }

  const bankingProvider = normalizeEnumValue(input.banking_provider);
  const providerFieldName = normalizeEnumValue(input.provider_field_name);
  const providerFieldValue = typeof input.provider_field_value === 'string' ? input.provider_field_value.trim() : '';

  if (!bankingProvider || !providerFieldName || !providerFieldValue) {
    return null;
  }

  if (!allowedBankingProviders.includes(bankingProvider) || !allowedProviderFieldNames.includes(providerFieldName)) {
    return null;
  }

  return {
    banking_provider: bankingProvider,
    provider_field_name: providerFieldName,
    provider_field_value: providerFieldValue,
  };
}

export function appendTransactionReferenceToCreatePayload(
  createData: Record<string, any>,
  input?: Partial<TransactionReferencePayload> | null,
): void {
  const transactionReference = buildTransactionReferencePayload(input);
  if (transactionReference) {
    createData.transaction_reference = transactionReference;
  }
}

export function resolveInvoiceIssueDate(
  invoiceDate: string | undefined | null,
  draft: boolean | undefined | null,
  latestFinalizedInvoiceDate?: string | undefined | null,
): string {
  const candidate = typeof invoiceDate === 'string' ? invoiceDate.trim() : '';
  if (!candidate) {
    return '';
  }

  if (draft === false) {
    const latestDate = typeof latestFinalizedInvoiceDate === 'string' ? latestFinalizedInvoiceDate.trim() : '';
    if (!latestDate) {
      return candidate;
    }

    return latestDate >= candidate ? latestDate : candidate;
  }

  return candidate;
}

export function buildCustomerInvoiceMarkAsPaidEndpoint(invoiceId: string | number): string {
  const normalizedInvoiceId = typeof invoiceId === 'number' ? invoiceId.toString() : (invoiceId ?? '').trim();
  if (!normalizedInvoiceId) {
    throw new Error('Invoice ID is required to mark a customer invoice as paid');
  }

  return `/customer_invoices/${normalizedInvoiceId}/mark_as_paid`;
}

export function buildPennylaneCategoriesPayload(categoriesData: unknown, isCustomerInvoice: boolean): unknown {
  const normalizedCategories = Array.isArray(categoriesData)
    ? categoriesData
    : (categoriesData && typeof categoriesData === 'object' && Array.isArray((categoriesData as any).categories)
        ? (categoriesData as any).categories
        : categoriesData);

  return isCustomerInvoice ? normalizedCategories : { categories: normalizedCategories };
}
