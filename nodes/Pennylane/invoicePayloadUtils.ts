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

export function buildPennylaneCategoriesPayload(categoriesData: unknown, _isCustomerInvoice: boolean): unknown {
  // Both Customer Invoice and Supplier Invoice APIs expect the same format: a direct array of objects
  // API docs: https://pennylane.readme.io/reference/putcustomerinvoicecategories
  //           https://pennylane.readme.io/reference/putsupplierinvoicecategories
  // Expected format: [{"id": 12, "weight": "0.4"}, {"id": 426, "weight": "0.6"}]
  // - id: integer (required)
  // - weight: string representing decimal 0-1 (optional, defaults to "1" if omitted)
  
  const normalizedCategories = Array.isArray(categoriesData)
    ? categoriesData
    : (categoriesData && typeof categoriesData === 'object' && Array.isArray((categoriesData as any).categories)
        ? (categoriesData as any).categories
        : categoriesData);

  // Ensure all items are objects with integer IDs and string weights
  if (Array.isArray(normalizedCategories)) {
    return normalizedCategories.map(item => {
      // If already an object with id, normalize id to integer and weight to string
      if (item && typeof item === 'object' && 'id' in item) {
        const id = (item as any).id;
        const parsedId = typeof id === 'string' ? parseInt(id, 10) : id;
        if (typeof parsedId !== 'number' || isNaN(parsedId)) {
          throw new Error(`Invalid category ID in object: "${id}" is not a valid integer`);
        }
        
        const result: any = { id: parsedId };
        
        // Normalize weight to string if present
        if ('weight' in item) {
          const weight = (item as any).weight;
          if (weight !== null && weight !== undefined) {
            result.weight = typeof weight === 'string' ? weight : String(weight);
          }
        }
        
        return result;
      }
      
      // If it's a number or string, wrap it in an object with just the id
      if (typeof item === 'number') {
        return { id: item };
      }
      
      if (typeof item === 'string') {
        const parsed = parseInt(item, 10);
        if (isNaN(parsed)) {
          throw new Error(`Invalid category ID: "${item}" is not a valid integer`);
        }
        return { id: parsed };
      }
      
      throw new Error(`Invalid category format: expected number, string, or object with id, got ${typeof item}`);
    });
  }

  return normalizedCategories;
}
