import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  INodePropertyOptions,
} from 'n8n-workflow';

import { pennylaneApiRequest } from './GenericFunctions';
import { appendTransactionReferenceToCreatePayload, buildCustomerInvoiceMarkAsPaidEndpoint, resolveInvoiceIssueDate } from './invoicePayloadUtils';

async function getLatestFinalizedInvoiceDate(context: IExecuteFunctions, customerId: number): Promise<string | null> {
  try {
    const response = await pennylaneApiRequest.call(context as any, 'GET', '/customer_invoices?per_page=100');
    const invoices = Array.isArray(response?.items) ? response.items : [];

    const finalizedInvoices = invoices.filter((invoice: any) => {
      const invoiceCustomerId = invoice?.customer_id;
      const invoiceDate = typeof invoice?.date === 'string' ? invoice.date.split('T')[0] : '';
      return invoiceCustomerId === customerId && invoice?.draft === false && invoiceDate;
    });

    if (finalizedInvoices.length === 0) {
      return null;
    }

    return finalizedInvoices.reduce((latest: string | null, invoice: any) => {
      const invoiceDate = typeof invoice?.date === 'string' ? invoice.date.split('T')[0] : '';
      if (!invoiceDate) {
        return latest;
      }

      if (!latest || invoiceDate > latest) {
        return invoiceDate;
      }

      return latest;
    }, null);
  } catch (error) {
    return null;
  }
}

export class Pennylane implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Pennylane',
    name: 'pennylane',
    icon: 'file:pennylane.svg',
    group: ['transform'],
    version: 1,
    description: 'n8n community node for Pennylane External API v2 - Complete & Working',
    defaults: {
      name: 'Pennylane',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'pennylaneApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        options: [
          // 👥 COMMERCIAL DOCUMENTS (Commonly used)
          { name: '👤 Customer', value: 'customer' },
          { name: '🛍️ Product', value: 'product' },
          { name: '📄 Customer Invoice', value: 'customerInvoice' },
          { name: '💰 Quote', value: 'quote' },
          
          // 🏢 SUPPLIER MANAGEMENT
          { name: '🏢 Supplier', value: 'supplier' },
          { name: '📥 Supplier Invoice', value: 'supplierInvoice' },
          
          // 💳 FINANCIAL
          { name: '🏦 Bank Account', value: 'bankAccount' },
          { name: '💸 Transaction', value: 'transaction' },
          { name: '💰 Payment', value: 'payment' },
          { name: '💳 SEPA Mandate', value: 'sepaMandate' },
          { name: '🔄 GoCardless Mandate', value: 'goCardlessMandate' },
          
          // 📊 ACCOUNTING (Advanced)
          { name: '📓 Journal', value: 'journal' },
          { name: '📈 Ledger Account', value: 'ledgerAccount' },
          { name: '📋 Ledger Entry', value: 'ledgerEntry' },
          { name: '📑 Ledger Entry Line', value: 'ledgerEntryLine' },
          { name: '📎 Ledger Attachment', value: 'ledgerAttachment' },
          { name: '⚖️ Trial Balance', value: 'trialBalance' },
          { name: '📅 Fiscal Year', value: 'fiscalYear' },
          
          // 🏷️ CATEGORIZATION
          { name: '🏷️ Category', value: 'category' },
          { name: '📦 Category Group', value: 'categoryGroup' },
          
          // 🔄 SUBSCRIPTION & MONITORING
          { name: '🔄 Billing Subscription', value: 'billingSubscription' },
          
          // 📋 INVOICE DETAILS
          { name: '📋 Invoice Lines', value: 'invoiceLines' },
          { name: '📎 Invoice Appendices', value: 'invoiceAppendices' },
          { name: '📝 Customer Invoice Template', value: 'customerInvoiceTemplate' },
          
          // 📎 FILES & OTHER
          { name: '📎 File Attachment', value: 'fileAttachment' },
          { name: '📄 Commercial Document', value: 'commercialDocument' },
          { name: '⚡ E-Invoice Create (Import)', value: 'eInvoiceImport' },
          { name: '👤 User Profile', value: 'userProfile' },
        ],
        default: 'customer',
      },
      // Operations pour les ressources avec CREATE + UPDATE support
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customer', 'supplier', 'category']
          },
        },
        options: [
          { name: 'Get All', value: 'getAll' },
          { name: 'Get', value: 'get' },
          { name: 'Create', value: 'create' },
          { name: 'Update', value: 'update' },
          { name: 'Delete', value: 'delete' },
        ],
        default: 'getAll',
        description: 'Full CRUD support',
      },
      
      // Operations pour Customer Invoice (avec opérations spéciales pour sous-ressources)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customerInvoice']
          },
        },
        options: [
          { name: 'Get All', value: 'getAll' },
          { name: 'Get', value: 'get' },
          { name: 'Create', value: 'create' },
          { name: 'Update', value: 'update' },
          { name: 'Delete', value: 'delete' },
          { name: 'Get Invoice Lines', value: 'getInvoiceLines' },
          { name: 'Get Invoice Line Sections', value: 'getInvoiceLineSections' },
          { name: 'Get Payments', value: 'getPayments' },
          { name: 'Get Matched Transactions', value: 'getMatchedTransactions' },
          { name: 'Get Appendices', value: 'getAppendices' },
          { name: 'Upload Appendix', value: 'uploadAppendix' },
          { name: 'Get Categories', value: 'getCategories' },
          { name: 'Categorize Invoice', value: 'categorizeInvoice' },
          { name: 'Mark as Paid', value: 'markAsPaid' },
          { name: 'Send by Email', value: 'sendByEmail' },
          { name: 'Get Custom Header Fields', value: 'getCustomHeaderFields' },
        ],
        default: 'getAll',
        description: 'Customer Invoice operations including sub-resources (DELETE for drafts only)',
      },
      
      // Operations pour les ressources avec CREATE+UPDATE support
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['product']
          },
        },
        options: [
          { name: 'Get All', value: 'getAll' },
          { name: 'Get', value: 'get' },
          { name: 'Create', value: 'create' },
          { name: 'Update', value: 'update' },
        ],
        default: 'getAll',
        description: 'Full CRUD support except DELETE',
      },
      
      // Operations pour les ressources avec CREATE seulement
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['journal', 'ledgerAccount', 'ledgerEntry']
          },
        },
        options: [
          { name: 'Get All', value: 'getAll' },
          { name: 'Get', value: 'get' },
          { name: 'Create', value: 'create' },
        ],
        default: 'getAll',
        description: 'These resources support creation only',
      },
      
      // Operations pour E-Invoice Import (CREATE seulement, pas de lecture)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['eInvoiceImport']
          },
        },
        options: [
          { name: 'Create (Import E-Invoice)', value: 'create' },
        ],
        default: 'create',
        description: 'POST /e-invoices/imports - Create by importing e-invoice data (BETA)',
      },
      
      
      // Operations pour Customer Mandates (avec DELETE)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['sepaMandate']
          },
        },
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Delete', value: 'delete' },
        ],
        default: 'create',
        description: 'SEPA mandates - CREATE and DELETE only (GET endpoints return HTML)',
      },
      
      
      // Operations spéciales pour Trial Balance et Fiscal Year (rapports uniquement)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['trialBalance', 'fiscalYear']
          },
        },
        options: [
          { name: 'Get Report', value: 'getAll' },
          { name: 'Get Report (with params)', value: 'get' },
        ],
        default: 'getAll',
        description: 'Generate report (these endpoints provide reports, not individual records)',
      },
      
      // Operations pour Supplier Invoice (read + write operations)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice']
          },
        },
        options: [
          // Read operations
          { name: 'Get All', value: 'getAll' },
          { name: 'Get', value: 'get' },
          { name: 'Get Invoice Lines', value: 'getInvoiceLines' },
          { name: 'Get Categories', value: 'getCategories' },
          { name: 'Get Payments', value: 'getPayments' },
          { name: 'Get Matched Transactions', value: 'getMatchedTransactions' },
          // Write operations
          { name: 'Import Invoice', value: 'importInvoice' },
          { name: 'Update Invoice', value: 'update' },
          { name: 'Categorize Invoice', value: 'categorizeInvoice' },
          { name: 'Update Payment Status', value: 'updatePaymentStatus' },
          { name: 'Validate Accounting', value: 'validateAccounting' },
          { name: 'Link Purchase Request', value: 'linkPurchaseRequest' },
          { name: 'Update E-Invoice Status', value: 'updateEInvoiceStatus' },
        ],
        default: 'getAll',
        description: 'Supplier invoice operations (read & write)',
      },
      
      // Operations pour TOUTES les autres ressources (lecture seule)
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        displayOptions: {
          show: { 
            resource: [
              'quote', 'commercialDocument', 
              'ledgerEntryLine', 'ledgerAttachment', 'categoryGroup', 
              'transaction', 'bankAccount', 'payment', 'invoiceLines', 'invoiceAppendices',
              'billingSubscription', 'goCardlessMandate', 'fileAttachment', 'userProfile',
              'customerInvoiceTemplate'
            ]
          },
        },
        options: [
          { name: 'Get All', value: 'getAll' },
          { name: 'Get', value: 'get' },
        ],
        default: 'getAll',
        description: 'Read-only operations (Pennylane API limitation)',
      },

      // Mode de sélection Customer
      {
        displayName: 'Customer Selection Mode',
        name: 'customerSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the customer',
      },
      // Customer - Sélection par liste
      {
        displayName: 'Customer',
        name: 'customerId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomers',
        },
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['get', 'update', 'delete'],
            customerSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the customer from the list',
        required: true,
      },
      // Customer - Saisie manuelle
      {
        displayName: 'Customer ID',
        name: 'customerId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['get', 'update', 'delete'],
            customerSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the customer ID manually',
        required: true,
      },
      // Mode de sélection Supplier
      {
        displayName: 'Supplier Selection Mode',
        name: 'supplierSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the supplier',
      },
      // Supplier - Sélection par liste
      {
        displayName: 'Supplier',
        name: 'supplierId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSuppliers',
        },
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['get', 'update', 'delete'],
            supplierSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the supplier from the list',
        required: true,
      },
      // Supplier - Saisie manuelle
      {
        displayName: 'Supplier ID',
        name: 'supplierId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['get', 'update', 'delete'],
            supplierSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the supplier ID manually',
        required: true,
      },
      // Mode de sélection Product
      {
        displayName: 'Product Selection Mode',
        name: 'productSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the product',
      },
      // Product - Sélection par liste
      {
        displayName: 'Product',
        name: 'productId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getProducts',
        },
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['get', 'update', 'delete'],
            productSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the product from the list',
        required: true,
      },
      // Product - Saisie manuelle
      {
        displayName: 'Product ID',
        name: 'productId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['get', 'update', 'delete'],
            productSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the product ID manually',
        required: true,
      },
      // Mode de sélection Quote
      {
        displayName: 'Quote Selection Mode',
        name: 'quoteSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['quote'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the quote',
      },
      // Quote - Sélection par liste
      {
        displayName: 'Quote',
        name: 'resourceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getQuotes',
        },
        displayOptions: {
          show: { 
            resource: ['quote'],
            operation: ['get', 'update', 'delete'],
            quoteSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the quote from the list',
      },
      // Quote - Saisie manuelle
      {
        displayName: 'Quote ID',
        name: 'resourceId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['quote'],
            operation: ['get', 'update', 'delete'],
            quoteSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the quote ID manually',
      },
      // Mode de sélection Supplier Invoice
      {
        displayName: 'Supplier Invoice Selection Mode',
        name: 'supplierInvoiceSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the supplier invoice',
      },
      // Supplier Invoice - Sélection par liste
      {
        displayName: 'Supplier Invoice',
        name: 'resourceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSupplierInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['get', 'update', 'delete'],
            supplierInvoiceSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the supplier invoice from the list',
      },
      // Supplier Invoice - Saisie manuelle
      {
        displayName: 'Supplier Invoice ID',
        name: 'resourceId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['get', 'update', 'delete'],
            supplierInvoiceSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the supplier invoice ID manually',
      },
      // Mode de sélection Transaction
      {
        displayName: 'Transaction Selection Mode',
        name: 'transactionSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['transaction'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the transaction',
      },
      // Transaction - Sélection par liste
      {
        displayName: 'Transaction',
        name: 'resourceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getTransactions',
        },
        displayOptions: {
          show: { 
            resource: ['transaction'],
            operation: ['get', 'update', 'delete'],
            transactionSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the transaction from the list',
      },
      // Transaction - Saisie manuelle
      {
        displayName: 'Transaction ID',
        name: 'resourceId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['transaction'],
            operation: ['get', 'update', 'delete'],
            transactionSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the transaction ID manually',
      },
      // Mode de sélection Bank Account
      {
        displayName: 'Bank Account Selection Mode',
        name: 'bankAccountSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['bankAccount'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the bank account',
      },
      // Bank Account - Sélection par liste
      {
        displayName: 'Bank Account',
        name: 'resourceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getBankAccounts',
        },
        displayOptions: {
          show: { 
            resource: ['bankAccount'],
            operation: ['get', 'update', 'delete'],
            bankAccountSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the bank account from the list',
      },
      // Bank Account - Saisie manuelle
      {
        displayName: 'Bank Account ID',
        name: 'resourceId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['bankAccount'],
            operation: ['get', 'update', 'delete'],
            bankAccountSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the bank account ID manually',
      },
      // Resource ID générique pour les autres (sans dropdown disponible)
      {
        displayName: 'Resource ID',
        name: 'resourceId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['commercialDocument', 'ledgerEntryLine', 'ledgerAttachment', 'categoryGroup', 'billingSubscription', 'goCardlessMandate', 'fileAttachment'],
            operation: ['get', 'update', 'delete']
          },
        },
        default: '',
        description: 'Enter the resource ID',
      },
      
      // Champs spécialisés pour Supplier
      {
        displayName: 'Supplier Name',
        name: 'supplierName',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Supplier name (company or individual)',
        required: true,
        placeholder: 'Enter supplier name...',
      },
      {
        displayName: 'Supplier Email (Optional)',
        name: 'supplierEmail',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Supplier email address (optional)',
        placeholder: 'supplier@example.com',
        typeOptions: {
          validation: [
            {
              type: 'regex',
              properties: {
                regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                errorMessage: 'Please enter a valid email address',
              },
            },
          ],
        },
      },
      {
        displayName: 'Supplier Phone (Optional)',
        name: 'supplierPhone',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Supplier phone number (optional)',
        placeholder: '+33 1 23 45 67 89',
      },
      {
        displayName: 'Supplier Address (Optional)',
        name: 'supplierAddress',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Supplier address (optional)',
        placeholder: '123 Rue de la Paix, 75001 Paris',
      },
      {
        displayName: 'Supplier SIRET (Optional)',
        name: 'supplierSiret',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Supplier SIRET number (optional)',
        placeholder: '12345678901234',
      },
      {
        displayName: 'Supplier VAT Number (Optional)',
        name: 'supplierVatNumber',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Supplier VAT number (optional)',
        placeholder: 'FR12345678901',
      },
      {
        displayName: 'Payment Terms (Optional)',
        name: 'supplierPaymentTerms',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['supplier'],
            operation: ['create']
          },
        },
        options: [
          { name: 'Payment on receipt', value: 'on_receipt' },
          { name: '15 days', value: '15_days' },
          { name: '30 days', value: '30_days' },
          { name: '45 days', value: '45_days' },
          { name: '60 days', value: '60_days' },
          { name: '90 days', value: '90_days' },
        ],
        default: '30_days',
        description: 'Default payment terms for this supplier',
      },
      
      // Champs spécialisés pour Customer
      {
        displayName: 'Customer Type',
        name: 'customerType',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update', 'get']
          },
        },
        options: [
          { name: '🏢 Company', value: 'company' },
          { name: '👤 Individual', value: 'individual' },
        ],
        default: 'company',
        description: 'Type of customer (company or individual)',
        required: true,
      },
      
      // === CHAMPS COMMUNS ===
      {
        displayName: 'Company Name',
        name: 'customerName',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update'],
            customerType: ['company']
          },
        },
        default: '',
        description: 'Company name (required for CREATE, optional for UPDATE)',
        placeholder: 'Acme Corporation',
      },
      {
        displayName: 'Customer Email (Optional)',
        name: 'customerEmail',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update']
          },
        },
        default: '',
        description: 'Customer email address (optional)',
        placeholder: 'customer@example.com',
        typeOptions: {
          validation: [
            {
              type: 'regex',
              properties: {
                regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                errorMessage: 'Please enter a valid email address',
              },
            },
          ],
        },
      },
      {
        displayName: 'Customer Phone (Optional)',
        name: 'customerPhone',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update']
          },
        },
        default: '',
        description: 'Customer phone number (optional)',
        placeholder: '+33 1 23 45 67 89',
      },
      {
        displayName: 'Customer Address',
        name: 'customerAddress',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update']
          },
        },
        default: '',
        description: 'Customer street address (required for CREATE, optional for UPDATE)',
        placeholder: '123 Rue de la Paix',
      },
      {
        displayName: 'Customer Postal Code',
        name: 'customerPostalCode',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update']
          },
        },
        default: '',
        description: 'Customer postal code (required for CREATE, optional for UPDATE)',
        placeholder: '75001',
      },
      {
        displayName: 'Customer City',
        name: 'customerCity',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update']
          },
        },
        default: '',
        description: 'Customer city (required for CREATE, optional for UPDATE)',
        placeholder: 'Paris',
      },
      {
        displayName: 'Customer Country Code',
        name: 'customerCountry',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update']
          },
        },
        default: 'FR',
        description: 'Customer country (ISO Alpha-2 code, e.g., FR, BE, CH)',
        placeholder: 'FR',
      },
      
      // === CHAMPS SPÉCIFIQUES COMPANY ===
      {
        displayName: 'Company SIRET (Optional)',
        name: 'customerSiret',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update'],
            customerType: ['company']
          },
        },
        default: '',
        description: 'Company SIRET number (optional)',
        placeholder: '12345678901234',
      },
      {
        displayName: 'Company VAT Number (Optional)',
        name: 'customerVatNumber',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update'],
            customerType: ['company']
          },
        },
        default: '',
        description: 'Company VAT number (optional)',
        placeholder: 'FR12345678901',
      },
      
      // === CHAMPS SPÉCIFIQUES INDIVIDUAL ===
      {
        displayName: 'Individual First Name',
        name: 'customerFirstName',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update'],
            customerType: ['individual']
          },
        },
        default: '',
        description: 'Individual first name (required for CREATE, optional for UPDATE)',
        placeholder: 'Jean',
      },
      {
        displayName: 'Individual Last Name',
        name: 'customerLastName',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customer'],
            operation: ['create', 'update'],
            customerType: ['individual']
          },
        },
        default: '',
        description: 'Individual last name (required for CREATE, optional for UPDATE)',
        placeholder: 'Dupont',
      },
      
      // Champs spécialisés pour Category
      {
        displayName: 'Category Label',
        name: 'categoryLabel',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['category'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Category label',
        required: true,
      },
      {
        displayName: 'Category Group',
        name: 'categoryGroupId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCategoryGroups',
        },
        displayOptions: {
          show: { 
            resource: ['category'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Select the category group',
        required: true,
      },
      
      // Champs spécialisés pour Journal
      {
        displayName: 'Journal Code',
        name: 'journalCode',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['journal'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Journal code (short identifier)',
        required: true,
      },
      {
        displayName: 'Journal Label',
        name: 'journalLabel',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['journal'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Journal label (full name)',
        required: true,
      },
      
      // Champs spécialisés pour Ledger Account
      {
        displayName: 'Account Number',
        name: 'accountNumber',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['ledgerAccount'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Account number (e.g., 411000)',
        required: true,
      },
      {
        displayName: 'Account Label',
        name: 'accountLabel',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['ledgerAccount'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Account name/label',
        required: true,
      },
      
      // Champs spécialisés pour Product
      {
        displayName: 'Product Label',
        name: 'productLabel',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update']
          },
        },
        default: '',
        description: 'Product name/label (required for CREATE, optional for UPDATE)',
        required: false,
      },
      {
        displayName: 'Product Unit',
        name: 'productUnit',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update']
          },
        },
        options: [
          { name: '📦 Unit (pièce)', value: 'unit' },
          { name: '⏱️ Hour (heure)', value: 'hour' },
          { name: '📅 Day (jour)', value: 'day' },
          { name: '📏 Meter (mètre)', value: 'meter' },
          { name: '⚖️ Kilogram (kilogramme)', value: 'kg' },
          { name: '📐 Square meter (mètre carré)', value: 'm2' },
          { name: '🧊 Cubic meter (mètre cube)', value: 'm3' },
          { name: '💧 Liter (litre)', value: 'liter' },
          { name: '📦 Package (colis)', value: 'package' },
          { name: '📄 Page', value: 'page' },
          { name: '🔢 Custom Unit', value: 'custom' },
        ],
        default: 'unit',
        description: 'Select the unit of measurement',
        required: true,
      },
      // Champ unit personnalisé si "Custom Unit" sélectionné
      {
        displayName: 'Custom Unit Name',
        name: 'productUnitCustom',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update'],
            productUnit: ['custom']
          },
        },
        default: '',
        description: 'Enter custom unit name',
        required: true,
      },
      {
        displayName: 'Price Input Method',
        name: 'priceInputMethod',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update']
          },
        },
        options: [
          { name: '💰 Price in Currency Units', value: 'euros' },
          { name: '🪙 Price in Cents', value: 'cents' },
        ],
        default: 'euros',
        description: 'Choose how to enter the price',
      },
      // Prix en devise principale (converti automatiquement en cents)
      {
        displayName: 'Product Price (Main Currency)',
        name: 'productPriceEuros',
        type: 'number',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update'],
            priceInputMethod: ['euros']
          },
        },
        default: 10.00,
        description: 'Price before tax in selected currency (will be converted to cents for API)',
        required: true,
        typeOptions: {
          numberPrecision: 2,
          minValue: 0,
        },
      },
      // Prix en cents (valeur directe)
      {
        displayName: 'Product Price (Cents)',
        name: 'productPrice',
        type: 'number',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update'],
            priceInputMethod: ['cents']
          },
        },
        default: 1000,
        description: 'Price before tax in cents (1000 = 10.00 in selected currency)',
        required: true,
        typeOptions: {
          minValue: 0,
        },
      },
      {
        displayName: 'Currency',
        name: 'productCurrency',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update']
          },
        },
        options: [
          { name: '🇪🇺 EUR - Euro', value: 'EUR' },
          { name: '🇺🇸 USD - US Dollar', value: 'USD' },
          { name: '🇬🇧 GBP - British Pound', value: 'GBP' },
          { name: '🇨🇭 CHF - Swiss Franc', value: 'CHF' },
          { name: '🇯🇵 JPY - Japanese Yen', value: 'JPY' },
          { name: '🇨🇦 CAD - Canadian Dollar', value: 'CAD' },
          { name: '🇦🇺 AUD - Australian Dollar', value: 'AUD' },
          { name: '🇸🇪 SEK - Swedish Krona', value: 'SEK' },
          { name: '🇳🇴 NOK - Norwegian Krone', value: 'NOK' },
          { name: '🇩🇰 DKK - Danish Krone', value: 'DKK' },
          { name: '🇵🇱 PLN - Polish Zloty', value: 'PLN' },
          { name: '🇨🇿 CZK - Czech Koruna', value: 'CZK' },
          { name: '🇭🇺 HUF - Hungarian Forint', value: 'HUF' },
        ],
        default: 'EUR',
        description: 'Product currency',
        required: true,
      },
      // Exemples de prix selon la devise
      {
        displayName: 'EUR Example',
        name: 'priceExampleEur',
        type: 'notice',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create'],
            productCurrency: ['EUR']
          },
        },
        default: '',
        typeOptions: {
          theme: 'info',
        },
        description: 'Example: 75.50 EUR = 7550 cents',
      },
      {
        displayName: 'USD Example',
        name: 'priceExampleUsd',
        type: 'notice',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create'],
            productCurrency: ['USD']
          },
        },
        default: '',
        typeOptions: {
          theme: 'info',
        },
        description: 'Example: 85.25 USD = 8525 cents',
      },
      {
        displayName: 'GBP Example',
        name: 'priceExampleGbp',
        type: 'notice',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create'],
            productCurrency: ['GBP']
          },
        },
        default: '',
        typeOptions: {
          theme: 'info',
        },
        description: 'Example: 65.00 GBP = 6500 cents',
      },
      {
        displayName: 'Other Currency Example',
        name: 'priceExampleOther',
        type: 'notice',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create'],
            productCurrency: ['CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF']
          },
        },
        default: '',
        typeOptions: {
          theme: 'info',
        },
        description: 'The price will be converted to cents (multiply by 100)',
      },
      {
        displayName: 'VAT Rate',
        name: 'vatRate',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['product'],
            operation: ['create', 'update']
          },
        },
        options: [
          { name: '20% (FR_200)', value: 'FR_200' },
          { name: '10% (FR_100)', value: 'FR_100' },
          { name: '5.5% (FR_55)', value: 'FR_55' },
          { name: '2.1% (FR_21)', value: 'FR_21' },
          { name: '0% (FR_0)', value: 'FR_0' },
        ],
        default: 'FR_200',
        description: 'VAT rate code (required for CREATE, optional for UPDATE)',
        required: false,
      },
      
      // Champs spécialisés pour Customer Invoice
      {
        displayName: 'Invoice Creation Method',
        name: 'invoiceCreationMethod',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        options: [
          { name: '📝 Simple Invoice (Quick)', value: 'simple' },
          { name: '📋 Advanced Invoice (JSON Lines)', value: 'advanced' },
          { name: '➕ Dynamic Lines (Add/Remove)', value: 'dynamic' },
          { name: '📄 JSON Template (Complete)', value: 'json' },
        ],
        default: 'simple',
        description: 'Choose how to create the invoice',
        required: true,
      },
      
      // === CHAMPS COMMUNS ===
      {
        displayName: 'Invoice Date',
        name: 'invoiceDate',
        type: 'dateTime',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Invoice date',
        required: true,
        typeOptions: {
          dateTimePickerOptions: {
            format: 'yyyy-MM-dd',
          },
        },
      },
      {
        displayName: 'Payment Deadline',
        name: 'invoiceDeadline',
        type: 'dateTime',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Payment deadline date (required by Pennylane API)',
        required: true,
        typeOptions: {
          dateTimePickerOptions: {
            format: 'yyyy-MM-dd',
          },
        },
      },
      {
        displayName: 'Invoice Status',
        name: 'invoiceDraft',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        options: [
          { name: '📝 Draft (Not Finalized)', value: true },
          { name: '✅ Finalized', value: false },
        ],
        default: true,
        description: 'Whether the invoice is a draft or finalized (required by Pennylane API)',
        required: true,
      },
      {
        displayName: 'Customer',
        name: 'invoiceCustomerId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomers',
        },
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Select the customer',
        required: true,
      },
      
      // === CHAMPS OPTIONNELS COMMUNS ===
      {
        displayName: 'Invoice Template',
        name: 'invoiceTemplateId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomerInvoiceTemplates',
        },
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Select a customer invoice template (optional)',
      },
      {
        displayName: 'Currency',
        name: 'invoiceCurrency',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        options: [
          { name: 'EUR (Euro)', value: 'EUR' },
          { name: 'USD (US Dollar)', value: 'USD' },
          { name: 'GBP (British Pound)', value: 'GBP' },
          { name: 'CHF (Swiss Franc)', value: 'CHF' },
          { name: 'CAD (Canadian Dollar)', value: 'CAD' },
        ],
        default: 'EUR',
        description: 'Invoice currency',
      },
      {
        displayName: 'Language',
        name: 'invoiceLanguage',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        options: [
          { name: '🇫🇷 French', value: 'fr_FR' },
          { name: '🇬🇧 English', value: 'en_GB' },
          { name: '🇩🇪 German', value: 'de_DE' },
        ],
        default: 'fr_FR',
        description: 'Invoice language (defaults to customer billing language if not specified)',
      },
      {
        displayName: 'Invoice Title (PDF)',
        name: 'invoiceSubject',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Invoice title (appears on PDF)',
        placeholder: 'e.g., Consulting Services - January 2024',
      },
      {
        displayName: 'Invoice Description (PDF)',
        name: 'invoiceDescription',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Invoice description (appears on PDF, max 5000 characters)',
        placeholder: 'e.g., Monthly services as per contract',
        typeOptions: {
          rows: 4,
        },
      },
      {
        displayName: 'Additional Contact Info (PDF)',
        name: 'invoiceFreeText',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Free text for contact details (appears on PDF)',
        placeholder: 'e.g., Contact: John Doe - john@example.com',
      },
      {
        displayName: 'Special Mention',
        name: 'invoiceSpecialMention',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Additional details (max 20000 characters)',
        placeholder: 'e.g., Payment terms, special conditions',
        typeOptions: {
          rows: 3,
        },
      },
      {
        displayName: 'Accounting Label',
        name: 'invoiceLabel',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Custom label for accounting (ledger) entries. If not provided, Pennylane generates one automatically.',
        placeholder: 'e.g., Invoice Q1-2024',
      },
      {
        displayName: 'External Reference',
        name: 'invoiceExternalReference',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Your unique external reference to track this invoice. If not provided, Pennylane generates one.',
        placeholder: 'e.g., EXT-2024-001',
      },
      {
        displayName: 'Transaction Reference',
        name: 'invoiceTransactionReference',
        type: 'fixedCollection',
        displayOptions: {
          show: {
            resource: ['customerInvoice'],
            operation: ['create']
          },
        },
        default: {},
        placeholder: 'Add transaction reference',
        description: 'Optional payment matching reference to reconcile the invoice with a bank transaction',
        options: [
          {
            name: 'values',
            displayName: 'Reference',
            values: [
              {
                displayName: 'Banking Provider',
                name: 'banking_provider',
                type: 'options',
                options: [
                  { name: 'Stripe', value: 'stripe' },
                  { name: 'GoCardless', value: 'gocardless' },
                  { name: 'Bank', value: 'bank' },
                  { name: 'Budget Insight', value: 'budgetinsight' },
                ],
                default: '',
                description: 'Allowed Pennylane banking provider values',
              },
              {
                displayName: 'Provider Field Name',
                name: 'provider_field_name',
                type: 'options',
                options: [
                  { name: 'Payment ID', value: 'payment_id' },
                  { name: 'Paymend ID', value: 'paymend_id' },
                  { name: 'Charge ID', value: 'charge_id' },
                  { name: 'Report ID', value: 'report_id' },
                  { name: 'Web ID', value: 'web_id' },
                  { name: 'Label', value: 'label' },
                ],
                default: '',
                description: 'Allowed Pennylane provider field name values',
              },
              {
                displayName: 'Provider Field Value',
                name: 'provider_field_value',
                type: 'string',
                default: '',
                placeholder: 'e.g., INV-2024-001',
              },
            ],
          },
        ],
      },
      
      // === MÉTHODE SIMPLE ===
      {
        displayName: 'Product for Invoice Line',
        name: 'invoiceProductId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getProducts',
        },
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['simple']
          },
        },
        default: '',
        description: 'Select a product for the invoice line',
        required: true,
      },
      {
        displayName: 'Quantity',
        name: 'invoiceQuantity',
        type: 'number',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['simple']
          },
        },
        default: 1,
        description: 'Quantity for this product',
        required: true,
        typeOptions: {
          minValue: 0.01,
          numberPrecision: 2,
        },
      },
      
      // === MÉTHODE AVANCÉE ===
      {
        displayName: 'Invoice Lines (JSON Array)',
        name: 'invoiceLines',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['advanced']
          },
        },
        default: `[
  {
    "product_id": 123,
    "quantity": "2",
    "raw_currency_unit_price": "7500",
    "unit": "hour",
    "vat_rate": "FR_200",
    "label": "Consultation IT",
    "discount_amount": "200"
  },
  {
    "product_id": 456,
    "quantity": "1",
    "raw_currency_unit_price": "15000",
    "unit": "day",
    "vat_rate": "FR_200",
    "label": "Formation équipe"
  }
]`,
        description: 'JSON array of invoice lines - Add as many lines as needed',
        required: true,
      },
      
      // === MÉTHODE DYNAMIQUE ===
      {
        displayName: 'Invoice Lines',
        name: 'invoiceLinesDynamic',
        type: 'fixedCollection',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['dynamic']
          },
        },
        default: {},
        placeholder: 'Add Invoice Line',
        typeOptions: {
          multipleValues: true,
        },
        description: 'Add as many invoice lines as needed with Add/Remove buttons',
        options: [
          {
            name: 'lines',
            displayName: 'Invoice Lines',
            values: [
              {
                displayName: 'Product',
                name: 'product_id',
                type: 'options',
                typeOptions: {
                  loadOptionsMethod: 'getProducts',
                },
                default: '',
                description: 'Select product for this line',
                required: true,
              },
              {
                displayName: 'Quantity',
                name: 'quantity',
                type: 'number',
                default: 1,
                description: 'Quantity for this line',
                required: true,
                typeOptions: {
                  minValue: 0.01,
                  numberPrecision: 2,
                },
              },
              {
                displayName: 'Unit Price (cents)',
                name: 'raw_currency_unit_price',
                type: 'number',
                default: 1000,
                description: 'Unit price in cents (1000 = 10.00€)',
                required: true,
                typeOptions: {
                  minValue: 0,
                },
              },
              {
                displayName: 'Label (Optional)',
                name: 'label',
                type: 'string',
                default: '',
                description: 'Description for this line',
                placeholder: 'e.g., Consultation IT',
              },
              {
                displayName: 'Unit',
                name: 'unit',
                type: 'options',
                options: [
                  { name: 'Unit', value: 'unit' },
                  { name: 'Hour', value: 'hour' },
                  { name: 'Day', value: 'day' },
                  { name: 'Meter', value: 'meter' },
                  { name: 'Kg', value: 'kg' },
                  { name: 'Custom', value: 'custom' },
                ],
                default: 'unit',
                description: 'Unit of measurement',
              },
              {
                displayName: 'Custom Unit',
                name: 'customUnit',
                type: 'string',
                displayOptions: {
                  show: {
                    unit: ['custom'],
                  },
                },
                default: '',
                description: 'Enter custom unit',
                placeholder: 'e.g., pieces, sessions, etc.',
              },
              {
                displayName: 'VAT Rate',
                name: 'vat_rate',
                type: 'options',
                options: [
                  { name: '20% (FR_200)', value: 'FR_200' },
                  { name: '10% (FR_100)', value: 'FR_100' },
                  { name: '5.5% (FR_055)', value: 'FR_055' },
                  { name: '2.1% (FR_021)', value: 'FR_021' },
                  { name: '0% (FR_000)', value: 'FR_000' },
                ],
                default: 'FR_200',
                description: 'VAT rate for this line',
              },
              {
                displayName: 'Discount (cents, optional)',
                name: 'discount_amount',
                type: 'number',
                default: 0,
                description: 'Discount amount in cents (optional)',
                typeOptions: {
                  minValue: 0,
                },
              },
              {
                displayName: 'Line Description',
                name: 'description',
                type: 'string',
                default: '',
                description: 'Detailed description of the invoice line (optional)',
                placeholder: 'e.g., Strategic IT consulting for Q1',
                typeOptions: {
                  rows: 2,
                },
              },
              {
                displayName: 'Substance',
                name: 'substance',
                type: 'options',
                options: [
                  { name: 'Not specified', value: '' },
                  { name: 'Goods', value: 'goods' },
                  { name: 'Services', value: 'services' },
                ],
                default: '',
                description: 'Resolves the line ledger account to the company goods or services account (optional)',
              },
              {
                displayName: 'Ledger Account ID',
                name: 'ledger_account_id',
                type: 'number',
                default: 0,
                description: 'The ledger account ID (optional, overrides product default)',
                typeOptions: {
                  minValue: 0,
                },
              },
              {
                displayName: 'Section Rank',
                name: 'section_rank',
                type: 'number',
                default: 0,
                description: 'Section number for grouping lines (optional, must match invoice_line_sections)',
                typeOptions: {
                  minValue: 0,
                },
              },
            ],
          },
        ],
      },
      
      {
        displayName: 'Discount Type',
        name: 'invoiceDiscountType',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['simple', 'advanced', 'dynamic']
          },
        },
        options: [
          { name: 'No Discount', value: 'none' },
          { name: 'Absolute Amount (cents)', value: 'absolute' },
          { name: 'Percentage (%)', value: 'relative' },
        ],
        default: 'none',
        description: 'Type of global discount to apply',
      },
      {
        displayName: 'Discount Amount (cents)',
        name: 'invoiceDiscountAmount',
        type: 'number',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['simple', 'advanced', 'dynamic'],
            invoiceDiscountType: ['absolute']
          },
        },
        default: 0,
        description: 'Discount amount in cents',
        required: true,
        typeOptions: {
          minValue: 0,
        },
      },
      {
        displayName: 'Discount Percentage',
        name: 'invoiceDiscountPercent',
        type: 'number',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['simple', 'advanced', 'dynamic'],
            invoiceDiscountType: ['relative']
          },
        },
        default: 0,
        description: 'Discount percentage (e.g., 10 for 10%)',
        required: true,
        typeOptions: {
          minValue: 0,
          maxValue: 100,
          numberPrecision: 2,
        },
      },
      {
        displayName: 'Invoice Line Sections',
        name: 'invoiceLineSections',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['advanced', 'dynamic']
          },
        },
        default: '[]',
        description: 'Array of section objects to group invoice lines: [{"rank": 1, "title": "Section Title", "description": "Optional description"}]',
        placeholder: '[{"rank": 1, "title": "Consulting Services"}]',
      },
      
      // === MÉTHODE JSON COMPLÈTE ===
      {
        displayName: 'Complete Invoice JSON',
        name: 'invoiceCompleteJson',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['create'],
            invoiceCreationMethod: ['json']
          },
        },
        default: `{
  "date": "2024-01-15",
  "deadline": "2024-02-14",
  "draft": true,
  "customer_id": 123,
  "currency": "EUR",
  "language": "fr_FR",
  "pdf_invoice_subject": "Consulting Services Q1",
  "pdf_description": "Professional services as per contract",
  "special_mention": "Payment due within 30 days",
  "customer_invoice_template_id": 789,
  "discount": {
    "type": "relative",
    "value": "10.00"
  },
  "invoice_line_sections": [
    {
      "rank": 1,
      "title": "Consulting Services",
      "description": "Strategic advisory services"
    },
    {
      "rank": 2,
      "title": "Development Services"
    }
  ],
  "invoice_lines": [
    {
      "product_id": 456,
      "quantity": "2.5",
      "label": "Consultation Premium",
      "raw_currency_unit_price": "8000",
      "unit": "hour",
      "vat_rate": "FR_200",
      "substance": "services",
      "description": "Strategic IT consulting for Q1",
      "section_rank": 1
    },
    {
      "product_id": 457,
      "quantity": "1",
      "label": "Development",
      "raw_currency_unit_price": "15000",
      "unit": "day",
      "vat_rate": "FR_200",
      "substance": "services",
      "section_rank": 2
    }
  ],
  "external_reference": "EXT-2024-001"
}`,
        description: 'Complete invoice JSON with all possible fields',
        required: true,
      },
      
      // Notice générale pour GET ALL
      {
        displayName: '🔄 Auto-Split Info',
        name: 'getAllSplitNotice',
        type: 'notice',
        default: '',
        displayOptions: {
          show: { 
            operation: ['getAll'],
            resource: ['customerInvoice', 'supplierInvoice', 'customer', 'supplier', 'product', 'transaction', 'category', 'ledgerEntryLine', 'journal']
          },
        },
        typeOptions: {
          theme: 'success',
        },
        description: `### 🔄 Auto-Split Activé
**Chaque item sera un output séparé** - parfait pour les workflows n8n !
- 📦 **1 item** = **1 output** (au lieu d'un gros JSON avec array)
- 🚀 **Plus pratique** pour traiter individuellement
- ✅ **Compatible** avec tous les noeuds n8n suivants`,
      },
      
      // Notice pour Payment GET ALL
      {
        displayName: '📊 Payment GET ALL Info',
        name: 'paymentGetAllNotice',
        type: 'notice',
        default: '',
        displayOptions: {
          show: { 
            resource: ['payment'],
            operation: ['getAll']
          },
        },
        typeOptions: {
          theme: 'info',
        },
        description: `### 💰 Payment GET ALL - Vue Simplifiée
**Retourne TOUTES les factures** avec leur statut de paiement :
- 📄 **Une entrée par facture** (payée ou non payée)
- ✅ **Statut \`paid_status\`** : true/false pour chaque facture
- 💰 **Transactions incluses** : array des paiements (vide si aucun)
- 📊 **Métadonnées complètes** : montant, date, numéro, client/fournisseur
- 🔄 **Auto-split** : Chaque facture = 1 output séparé

**Usage** : Filtrez ensuite avec les nœuds n8n (IF, Filter, etc.) selon vos besoins.`,
      },
      
      // Notice pour Payment GET (specific)
      {
        displayName: '🎯 Payment GET Info',
        name: 'paymentGetNotice',
        type: 'notice',
        default: '',
        displayOptions: {
          show: { 
            resource: ['payment'],
            operation: ['get']
          },
        },
        typeOptions: {
          theme: 'warning',
        },
        description: `### 🎯 Payment GET (Specific Invoice)
**Récupère les transactions matchées d'une facture spécifique** :
- 📋 Sélectionnez le type (Client/Fournisseur)
- 🧾 Choisissez la facture dans la liste
- 💸 Obtenez toutes les transactions bancaires de cette facture

**Note** : Utilise /matched_transactions (vrais paiements bancaires).`,
      },
      
      // Champs spécialisés pour Payment
      {
        displayName: 'Payment Type',
        name: 'paymentType',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['payment'],
            operation: ['get']
          },
        },
        options: [
          { name: 'Customer Invoice Payments', value: 'customer' },
          { name: 'Supplier Invoice Payments', value: 'supplier' },
        ],
        default: 'customer',
        description: 'Choose payment type to retrieve',
        required: true,
      },
      {
        displayName: 'Invoice',
        name: 'paymentInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomerInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['payment'],
            operation: ['get'],
            paymentType: ['customer']
          },
        },
        default: '',
        description: 'Select customer invoice to get payments for',
        required: true,
      },
      {
        displayName: 'Invoice',
        name: 'paymentInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSupplierInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['payment'],
            operation: ['get'],
            paymentType: ['supplier']
          },
        },
        default: '',
        description: 'Select supplier invoice to get payments for',
        required: true,
      },
      
      // Champs spécialisés pour Invoice Lines
      {
        displayName: 'Invoice Type',
        name: 'invoiceType',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['invoiceLines', 'invoiceAppendices'],
            operation: ['getAll', 'get']
          },
        },
        options: [
          { name: 'Customer Invoice', value: 'customer' },
          { name: 'Supplier Invoice', value: 'supplier' },
        ],
        default: 'customer',
        description: 'Choose invoice type',
        required: true,
      },
      {
        displayName: 'Customer Invoice',
        name: 'customerInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomerInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['invoiceLines', 'invoiceAppendices'],
            operation: ['getAll', 'get'],
            invoiceType: ['customer']
          },
        },
        default: '',
        description: 'Select customer invoice',
        required: true,
      },
      {
        displayName: 'Customer Invoice',
        name: 'customerInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomerInvoices',
        },
        displayOptions: {
          show: {
            resource: ['customerInvoice'],
            operation: ['markAsPaid']
          },
        },
        default: '',
        description: 'Select the customer invoice to mark as paid',
        required: true,
      },
      {
        displayName: 'Supplier Invoice',
        name: 'supplierInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSupplierInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['invoiceLines', 'invoiceAppendices'],
            operation: ['getAll', 'get'],
            invoiceType: ['supplier']
          },
        },
        default: '',
        description: 'Select supplier invoice',
        required: true,
      },
      
      // === SUPPLIER INVOICE RESOURCE PARAMETERS ===
      {
        displayName: 'Supplier Invoice',
        name: 'subResourceSupplierInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSupplierInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['get', 'getInvoiceLines', 'getCategories', 'getPayments', 'getMatchedTransactions', 
                       'update', 'categorizeInvoice', 'updatePaymentStatus', 'validateAccounting', 
                       'linkPurchaseRequest', 'updateEInvoiceStatus']
          },
        },
        default: '',
        description: 'Select supplier invoice',
        required: true,
      },
      
      // Import Invoice fields
      {
        displayName: 'Invoice Data (JSON)',
        name: 'importInvoiceData',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['importInvoice']
          },
        },
        default: '{\n  "label": "Invoice Label",\n  "invoice_number": "INV-2024-001",\n  "currency": "EUR",\n  "amount": "100.00",\n  "currency_amount_before_tax": "83.33",\n  "date": "2024-01-15",\n  "deadline": "2024-02-15",\n  "supplier": {"source_id": "supplier_123"},\n  "invoice_lines": [{\n    "label": "Service",\n    "quantity": 1,\n    "unit": "unit",\n    "vat_rate": "FR_200",\n    "currency_price_before_tax": "83.33",\n    "currency_amount": "100.00"\n  }]\n}',
        description: 'Invoice data as JSON (see Pennylane API docs for full structure)',
        required: true,
      },
      
      // Update Invoice fields
      {
        displayName: 'Update Data (JSON)',
        name: 'updateInvoiceData',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['update']
          },
        },
        default: '{\n  "label": "Updated Label",\n  "invoice_number": "INV-2024-001-UPDATED"\n}',
        description: 'Fields to update (all optional): label, invoice_number, currency, amount, currency_amount_before_tax, date, deadline, etc.',
        required: false,
      },
      
      // Categorize Invoice fields
      {
        displayName: 'Categories (JSON)',
        name: 'categoriesData',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['categorizeInvoice']
          },
        },
        default: '[{"id": 1234, "weight": 1.0}]',
        description: 'Array of category objects with id and weight (e.g., [{"id": 1234, "weight": 1.0}])',
        required: true,
      },
      
      // Payment Status fields
      {
        displayName: 'Payment Status',
        name: 'paymentStatus',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['updatePaymentStatus']
          },
        },
        options: [
          { name: 'Paid', value: 'paid' },
          { name: 'To Be Paid', value: 'to_be_paid' },
        ],
        default: 'paid',
        description: 'Payment status to set',
        required: true,
      },
      
      // Link Purchase Request fields
      {
        displayName: 'Purchase Request ID',
        name: 'purchaseRequestId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['linkPurchaseRequest']
          },
        },
        default: '',
        description: 'ID of the purchase request to link',
        required: true,
      },
      
      // E-Invoice Status fields
      {
        displayName: 'E-Invoice Status',
        name: 'eInvoiceStatus',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['updateEInvoiceStatus']
          },
        },
        options: [
          { name: 'Disputed', value: 'disputed' },
          { name: 'Refused', value: 'refused' },
          { name: 'Undisputed', value: 'undisputed' },
        ],
        default: 'disputed',
        description: 'E-invoice status to set',
        required: true,
      },
      {
        displayName: 'Reason',
        name: 'eInvoiceReason',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['supplierInvoice'],
            operation: ['updateEInvoiceStatus'],
            eInvoiceStatus: ['disputed', 'refused']
          },
        },
        options: [
          { name: 'Incorrect VAT Rate', value: 'incorrect_vat_rate' },
          { name: 'Incorrect Unit Prices', value: 'incorrect_unit_prices' },
          { name: 'Incorrect Billed Quantity', value: 'incorrect_billed_quantity' },
          { name: 'Incorrect Billed Item', value: 'incorrect_billed_item' },
          { name: 'Defective Delivered Item', value: 'defective_delivered_item' },
          { name: 'Delivery Issue', value: 'delivery_issue' },
          { name: 'Bank Details Error', value: 'bank_details_error' },
          { name: 'Incorrect Payment Terms', value: 'incorrect_payment_terms' },
          { name: 'Missing Legal Notice', value: 'missing_legal_notice' },
          { name: 'Missing Contractual Reference', value: 'missing_contractual_reference' },
          { name: 'Recipient Error', value: 'recipient_error' },
          { name: 'Contract Completed', value: 'contract_completed' },
          { name: 'Duplicate Invoice', value: 'duplicate_invoice' },
          { name: 'Incorrect Prices', value: 'incorrect_prices' },
          { name: 'Non Compliant Invoice', value: 'non_compliant_invoice' },
        ],
        default: 'incorrect_vat_rate',
        description: 'Reason for dispute or refusal',
        required: false,
      },
      
      // Champs spécialisés pour SEPA Mandate
      {
        displayName: 'Mandate Customer',
        name: 'mandateCustomerId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomers',
        },
        displayOptions: {
          show: { 
            resource: ['sepaMandate'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Select the customer for the mandate',
        required: true,
      },
      {
        displayName: 'IBAN',
        name: 'mandateIban',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['sepaMandate'],
            operation: ['create']
          },
        },
        default: '',
        description: 'Customer IBAN (e.g., FR1420041010050500013M02606)',
        required: true,
      },
      
      // Champs spécialisés pour E-Invoice Import
      {
        displayName: 'E-Invoice Data',
        name: 'eInvoiceData',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['eInvoiceImport'],
            operation: ['create']
          },
        },
        default: '{}',
        description: 'E-Invoice data to import (JSON format)',
        required: true,
      },
      
      // Champs spécialisés pour User Profile
      {
        displayName: 'User Selection Mode',
        name: 'userProfileSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['userProfile'],
            operation: ['get']
          },
        },
        options: [
          { name: 'Current User (me)', value: 'me' },
          { name: 'Enter User ID', value: 'manual' },
        ],
        default: 'me',
        description: 'Choose how to select the user',
      },
      {
        displayName: 'User ID',
        name: 'userProfileId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['userProfile'],
            operation: ['get'],
            userProfileSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the user ID',
        required: true,
      },
      
      // === SÉLECTEURS CHANGELOG ===
      
      // Mode de sélection Customer Invoice
      {
        displayName: 'Invoice Selection Mode',
        name: 'invoiceSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the invoice',
      },
      // Customer Invoice - Sélection par liste
      {
        displayName: 'Customer Invoice',
        name: 'customerInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomerInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['get', 'update', 'delete'],
            invoiceSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the invoice from the list',
        required: true,
      },
      // Customer Invoice - Saisie manuelle
      {
        displayName: 'Customer Invoice ID',
        name: 'customerInvoiceId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['get', 'update', 'delete'],
            invoiceSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the invoice ID manually',
        required: true,
      },
      
      // === CHAMPS POUR SUB-RESOURCE OPERATIONS ===
      
      // Invoice ID pour les opérations de sous-ressources
      {
        displayName: 'Customer Invoice',
        name: 'subResourceInvoiceId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomerInvoices',
        },
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['getInvoiceLines', 'getInvoiceLineSections', 'getPayments', 'getMatchedTransactions', 'getAppendices', 'uploadAppendix', 'getCategories', 'categorizeInvoice', 'sendByEmail', 'getCustomHeaderFields']
          },
        },
        default: '',
        description: 'Select the customer invoice',
        required: true,
      },
      
      // Champs pour Upload Appendix
      {
        displayName: 'File',
        name: 'appendixFile',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['uploadAppendix']
          },
        },
        default: '',
        description: 'File to upload (use Binary Data input). Supported: PDF, PNG, JPEG, TIFF, BMP, GIF',
        placeholder: 'data:@binary',
        required: true,
      },
      
      // Champs pour Categorize Invoice
      {
        displayName: 'Categories (JSON)',
        name: 'invoiceCategories',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['categorizeInvoice']
          },
        },
        default: '[]',
        description: 'Array of category assignments. Example: [{"category_id": 1, "weight": "0.5"}]',
        placeholder: '[{"category_id": 123, "weight": "1.0"}]',
        required: true,
      },
      
      // Champs pour Send by Email
      {
        displayName: 'Recipients (Optional)',
        name: 'emailRecipients',
        type: 'json',
        displayOptions: {
          show: { 
            resource: ['customerInvoice'],
            operation: ['sendByEmail']
          },
        },
        default: '[]',
        description: 'Array of email addresses to send to. If empty, sends to invoice customer. Example: ["customer@example.com", "admin@example.com"]',
        placeholder: '["customer@example.com"]',
      },
      
      // Mode de sélection Journal
      {
        displayName: 'Journal Selection Mode',
        name: 'journalSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['journal'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the journal',
      },
      // Journal - Sélection par liste
      {
        displayName: 'Journal',
        name: 'journalId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getJournals',
        },
        displayOptions: {
          show: { 
            resource: ['journal'],
            operation: ['get', 'update', 'delete'],
            journalSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the journal from the list',
        required: true,
      },
      // Journal - Saisie manuelle
      {
        displayName: 'Journal ID',
        name: 'journalId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['journal'],
            operation: ['get', 'update', 'delete'],
            journalSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the journal ID manually',
        required: true,
      },
      // Mode de sélection Ledger Account
      {
        displayName: 'Ledger Account Selection Mode',
        name: 'ledgerAccountSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['ledgerAccount'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the ledger account',
      },
      // Ledger Account - Sélection par liste
      {
        displayName: 'Ledger Account',
        name: 'ledgerAccountId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getLedgerAccounts',
        },
        displayOptions: {
          show: { 
            resource: ['ledgerAccount'],
            operation: ['get', 'update', 'delete'],
            ledgerAccountSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the ledger account from the list',
        required: true,
      },
      // Ledger Account - Saisie manuelle
      {
        displayName: 'Ledger Account ID',
        name: 'ledgerAccountId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['ledgerAccount'],
            operation: ['get', 'update', 'delete'],
            ledgerAccountSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the ledger account ID manually',
        required: true,
      },
      // Mode de sélection Ledger Entry
      {
        displayName: 'Ledger Entry Selection Mode',
        name: 'ledgerEntrySelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['ledgerEntry'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the ledger entry',
      },
      // Ledger Entry - Sélection par liste
      {
        displayName: 'Ledger Entry',
        name: 'ledgerEntryId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getLedgerEntries',
        },
        displayOptions: {
          show: { 
            resource: ['ledgerEntry'],
            operation: ['get', 'update', 'delete'],
            ledgerEntrySelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the ledger entry from the list',
        required: true,
      },
      // Ledger Entry - Saisie manuelle
      {
        displayName: 'Ledger Entry ID',
        name: 'ledgerEntryId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['ledgerEntry'],
            operation: ['get', 'update', 'delete'],
            ledgerEntrySelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the ledger entry ID manually',
        required: true,
      },
      // Mode de sélection Category
      {
        displayName: 'Category Selection Mode',
        name: 'categorySelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['category'],
            operation: ['get', 'update', 'delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the category',
      },
      // Category - Sélection par liste
      {
        displayName: 'Category',
        name: 'categoryId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCategories',
        },
        displayOptions: {
          show: { 
            resource: ['category'],
            operation: ['get', 'update', 'delete'],
            categorySelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the category from the list',
        required: true,
      },
      // Category - Saisie manuelle
      {
        displayName: 'Category ID',
        name: 'categoryId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['category'],
            operation: ['get', 'update', 'delete'],
            categorySelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the category ID manually',
        required: true,
      },
      // Mode de sélection SEPA Mandate
      {
        displayName: 'SEPA Mandate Selection Mode',
        name: 'mandateSelectionMode',
        type: 'options',
        displayOptions: {
          show: { 
            resource: ['sepaMandate'],
            operation: ['delete']
          },
        },
        options: [
          { name: '📋 Select from List', value: 'list' },
          { name: '✏️ Enter Custom ID', value: 'manual' },
        ],
        default: 'list',
        description: 'Choose how to select the SEPA mandate',
      },
      // SEPA Mandate - Sélection par liste
      {
        displayName: 'SEPA Mandate',
        name: 'mandateId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getCustomerMandates',
        },
        displayOptions: {
          show: { 
            resource: ['sepaMandate'],
            operation: ['delete'],
            mandateSelectionMode: ['list']
          },
        },
        default: '',
        description: 'Select the mandate from the list',
        required: true,
      },
      // SEPA Mandate - Saisie manuelle
      {
        displayName: 'SEPA Mandate ID',
        name: 'mandateId',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['sepaMandate'],
            operation: ['delete'],
            mandateSelectionMode: ['manual']
          },
        },
        default: '',
        description: 'Enter the mandate ID manually',
        required: true,
      },
      
      // Paramètres spéciaux pour Trial Balance
      {
        displayName: 'Period Start',
        name: 'periodStart',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['trialBalance'],
            operation: ['getAll', 'get']
          },
        },
        default: '2024-01-01',
        description: 'Start date for trial balance (YYYY-MM-DD)',
        required: true,
      },
      {
        displayName: 'Period End',
        name: 'periodEnd',
        type: 'string',
        displayOptions: {
          show: { 
            resource: ['trialBalance'],
            operation: ['getAll', 'get']
          },
        },
        default: '2024-12-31',
        description: 'End date for trial balance (YYYY-MM-DD)',
        required: true,
      },

      // Paramètres de pagination
      {
        displayName: 'Page',
        name: 'page',
        type: 'number',
        displayOptions: {
          show: { 
            resource: ['trialBalance', 'fiscalYear'],
            operation: ['getAll', 'get']
          },
        },
        default: 1,
        description: 'Page number for pagination',
      },
      {
        displayName: 'Per Page',
        name: 'perPage',
        type: 'number',
        displayOptions: {
          show: { 
            resource: ['trialBalance', 'fiscalYear'],
            operation: ['getAll', 'get']
          },
        },
        default: 50,
        description: 'Number of items per page',
      },

    ],
  };

  methods = {
    loadOptions: {
      async getCustomers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/customers');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: item.name || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getSuppliers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/suppliers');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: item.name || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getProducts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/products');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: item.label || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getCustomerInvoiceTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/customer_invoice_templates');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: item.name || item.label || `Template ${item.id}`,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/projects');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: item.name || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/accounts');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.number} - ${item.name}` || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getCategoryGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/category_groups');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: item.name || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getCustomerInvoices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/customer_invoices');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.label || item.reference || item.id} (${item.date})`,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getJournals(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/journals');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.code} - ${item.label}` || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getLedgerAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/ledger_accounts');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.number} - ${item.label}` || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getLedgerEntries(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/ledger_entries');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.label} (${item.date})` || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getCategories(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/categories');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: item.label || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getCustomerMandates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/customer_mandates');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.iban} (${item.status})` || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getQuotes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/quotes');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.label || item.reference || item.id} (${item.date})`,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getSupplierInvoices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/supplier_invoices');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.label || item.reference || item.id} (${item.date})`,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getTransactions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/transactions');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.label} - ${item.amount}€ (${item.date})` || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
      async getBankAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        try {
          const response = await pennylaneApiRequest.call(this, 'GET', '/bank_accounts');
          const items = response.items || [];
          return items.map((item: any) => ({
            name: `${item.name} - ${item.iban}` || item.id,
            value: item.id,
          }));
        } catch (error) {
          return [];
        }
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Mapping des ressources vers leurs endpoints selon la doc Pennylane
    const resourceEndpoints: { [key: string]: string } = {
      // COMMERCIAL DOCUMENTS
      customer: 'customers',
      customerInvoice: 'customer_invoices',
      product: 'products',
      quote: 'quotes',
      commercialDocument: 'commercial_documents',
      
      // SUPPLIER INVOICES
      supplier: 'suppliers', 
      supplierInvoice: 'supplier_invoices',
      
      // ACCOUNTING
      journal: 'journals',
      ledgerAccount: 'ledger_accounts',
      ledgerEntry: 'ledger_entries',
      ledgerEntryLine: 'ledger_entry_lines',
      ledgerAttachment: 'ledger_attachments',
      trialBalance: 'trial_balance',
      fiscalYear: 'fiscal_years',
      
      // ANALYTICS
      category: 'categories',
      categoryGroup: 'category_groups',
      
      // TRANSACTIONS
      transaction: 'transactions',
      bankAccount: 'bank_accounts',
      payment: 'payments', // Will be dynamically constructed
      invoiceLines: 'invoice_lines', // Will be dynamically constructed  
      invoiceAppendices: 'appendices', // Will be dynamically constructed
      
      // BILLING SUBSCRIPTIONS
      billingSubscription: 'billing_subscriptions',
      
      // INVOICE TEMPLATES
      customerInvoiceTemplate: 'customer_invoice_templates',
      
      // CHANGELOGS
      
      // MANDATES
      sepaMandate: 'customer_mandates',
      goCardlessMandate: 'gocardless_mandates',
      
      // FILE UPLOAD
      fileAttachment: 'file_attachments',
      eInvoiceImport: 'e-invoices/imports',
      
      // USERS
      userProfile: 'me',
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        
        const endpoint = resourceEndpoints[resource];
        if (!endpoint) {
          throw new Error(`Unknown resource: ${resource}`);
        }

        let responseData;

        switch (operation) {
          case 'getAll':
            let getUrl = `/${endpoint}`;
            
            // Paramètres spéciaux pour Trial Balance
            if (resource === 'trialBalance') {
              const periodStart = this.getNodeParameter('periodStart', i) as string;
              const periodEnd = this.getNodeParameter('periodEnd', i) as string;
              const page = this.getNodeParameter('page', i) as number;
              const perPage = this.getNodeParameter('perPage', i) as number;
              getUrl += `?period_start=${periodStart}&period_end=${periodEnd}&page=${page}&per_page=${perPage}`;
            }
            // Paramètres spéciaux pour Fiscal Years
            else if (resource === 'fiscalYear') {
              const page = this.getNodeParameter('page', i) as number;
              const perPage = this.getNodeParameter('perPage', i) as number;
              getUrl += `?page=${page}&per_page=${perPage}`;
            }
            // Paramètres spéciaux pour Payments GET ALL - Vue simplifiée
            else if (resource === 'payment') {
              // GET ALL: Retourne toutes les factures avec leur statut de paiement
              console.log(`🚀 Payment GET ALL v1.7.5: Vue simplifiée - toutes les factures avec statut paid`);
              console.log(`🔧 Interface simplifiée: plus de filtre manuel, utilisez les nœuds n8n pour filtrer`);
              
              let allPayments: any[] = [];
              
              try {
                // 1. Récupérer toutes les factures clients
                console.log('📋 Récupération des factures clients...');
                console.log(`🔗 URL: /customer_invoices?per_page=100`);
                const customerInvoicesResponse = await pennylaneApiRequest.call(this, 'GET', '/customer_invoices?per_page=100');
                console.log(`✅ Réponse reçue:`, typeof customerInvoicesResponse, Object.keys(customerInvoicesResponse || {}));
                const customerInvoices = customerInvoicesResponse.items || [];
                console.log(`📊 ${customerInvoices.length} factures clients trouvées`);
                
                // 2. Pour chaque facture client (payée ET non payée), récupérer ses paiements
                let customerPaymentCount = 0;
                let customerInvoicesChecked = 0;
                
                // Fonction helper pour attendre
                const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
                
                for (const invoice of customerInvoices) {
                  // Pas de filtre - traiter toutes les factures
                  
                  try {
                    // Petit délai entre les requêtes pour éviter le rate limiting
                    if (customerInvoicesChecked > 0 && customerInvoicesChecked % 10 === 0) {
                      console.log(`⏱️ Pause de 500ms après ${customerInvoicesChecked} factures clients...`);
                      await delay(500);
                    }
                    
                    console.log(`🔗 Appel: /customer_invoices/${invoice.id}/matched_transactions`);
                    const paymentsResponse = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${invoice.id}/matched_transactions`);
                    const payments = paymentsResponse.items || [];
                    customerInvoicesChecked++;
                    
                    // Créer TOUJOURS une entrée pour cette facture (avec ou sans transactions)
                    const invoicePaymentData = {
                      invoice_id: invoice.id,
                      invoice_type: 'customer',
                      invoice_number: invoice.invoice_number,
                      invoice_amount: invoice.amount,
                      invoice_date: invoice.date,
                      paid_status: invoice.paid,
                      customer_name: invoice.customer?.name || 'N/A',
                      transaction_count: payments.length,
                      transactions: payments
                    };
                    
                    allPayments.push(invoicePaymentData);
                    customerPaymentCount++;
                    
                    console.log(`📄 Facture client ${invoice.id}: paid=${invoice.paid}, transactions=${payments.length}`);
                  } catch (error) {
                    console.log(`⚠️ Erreur paiements facture client ${invoice.id}:`, error instanceof Error ? error.message.substring(0, 200) : error);
                    // En cas d'erreur de rate limiting, attendre plus longtemps mais CONTINUER
                    if (error instanceof Error && error.message.includes('HTML')) {
                      console.log(`🚨 Rate limiting détecté sur facture ${invoice.id}, pause de 3s et CONTINUE...`);
                      await delay(3000);
                    }
                    // NE PAS faire crash - continuer avec les autres factures
                    console.log(`➡️ Continue avec les autres factures...`);
                  }
                }
                console.log(`📄 ${customerPaymentCount} factures clients traitées (${customerInvoicesChecked} vérifiées)`);
                
                // 3. Récupérer toutes les factures fournisseurs  
                console.log('📋 Récupération des factures fournisseurs...');
                const supplierInvoicesResponse = await pennylaneApiRequest.call(this, 'GET', '/supplier_invoices?per_page=100');
                const supplierInvoices = supplierInvoicesResponse.items || [];
                console.log(`📊 ${supplierInvoices.length} factures fournisseurs trouvées`);
                
                // 4. Pour chaque facture fournisseur (payée ET non payée), récupérer ses paiements
                let supplierPaymentCount = 0;
                let supplierInvoicesChecked = 0;
                for (const invoice of supplierInvoices) {
                  // Pas de filtre - traiter toutes les factures
                  
                  try {
                    // Petit délai entre les requêtes pour éviter le rate limiting
                    if (supplierInvoicesChecked > 0 && supplierInvoicesChecked % 10 === 0) {
                      console.log(`⏱️ Pause de 500ms après ${supplierInvoicesChecked} factures fournisseurs...`);
                      await delay(500);
                    }
                    
                    console.log(`🔗 Appel: /supplier_invoices/${invoice.id}/matched_transactions`);
                    const paymentsResponse = await pennylaneApiRequest.call(this, 'GET', `/supplier_invoices/${invoice.id}/matched_transactions`);
                    const payments = paymentsResponse.items || [];
                    supplierInvoicesChecked++;
                    
                    // Créer TOUJOURS une entrée pour cette facture (avec ou sans transactions)
                    const invoicePaymentData = {
                      invoice_id: invoice.id,
                      invoice_type: 'supplier',
                      invoice_number: invoice.invoice_number,
                      invoice_amount: invoice.amount,
                      invoice_date: invoice.date,
                      paid_status: invoice.paid,
                      supplier_name: invoice.supplier?.name || 'N/A',
                      transaction_count: payments.length,
                      transactions: payments
                    };
                    
                    allPayments.push(invoicePaymentData);
                    supplierPaymentCount++;
                    
                    console.log(`📄 Facture fournisseur ${invoice.id}: paid=${invoice.paid}, transactions=${payments.length}`);
                  } catch (error) {
                    console.log(`⚠️ Erreur paiements facture fournisseur ${invoice.id}:`, error instanceof Error ? error.message.substring(0, 200) : error);
                    // En cas d'erreur de rate limiting, attendre plus longtemps mais CONTINUER
                    if (error instanceof Error && error.message.includes('HTML')) {
                      console.log(`🚨 Rate limiting détecté sur facture ${invoice.id}, pause de 3s et CONTINUE...`);
                      await delay(3000);
                    }
                    // NE PAS faire crash - continuer avec les autres factures
                    console.log(`➡️ Continue avec les autres factures...`);
                  }
                }
                console.log(`📄 ${supplierPaymentCount} factures fournisseurs traitées (${supplierInvoicesChecked} vérifiées)`);
                
                // 5. Retourner le résultat simplifié (sera splité automatiquement)
                responseData = {
                  items: allPayments,
                  has_more: false,
                  next_cursor: null,
                  total_invoices: allPayments.length,
                  total_customer_invoices: customerPaymentCount,
                  total_supplier_invoices: supplierPaymentCount,
                  source: 'all_invoices_with_payment_status',
                  generated_at: new Date().toISOString()
                };
                
                console.log(`✅ Payment GET ALL terminé: ${allPayments.length} factures (toutes avec statut paid) -> seront splités automatiquement`);
                // IMPORTANT: Ne pas continuer vers l'appel général, l'agrégation est terminée
                break;
                
              } catch (error) {
                console.error('❌ Erreur lors de l\'agrégation des paiements:', error);
                throw new Error(`Erreur agrégation paiements: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
            // Paramètres spéciaux pour Invoice Lines
            else if (resource === 'invoiceLines') {
              const invoiceType = this.getNodeParameter('invoiceType', i) as string;
              
              if (invoiceType === 'customer') {
                const invoiceId = this.getNodeParameter('customerInvoiceId', i) as string;
                getUrl = `/customer_invoices/${invoiceId}/invoice_lines`;
              } else if (invoiceType === 'supplier') {
                const invoiceId = this.getNodeParameter('supplierInvoiceId', i) as string;
                getUrl = `/supplier_invoices/${invoiceId}/invoice_lines`;
              }
            }
            // Paramètres spéciaux pour Invoice Appendices
            else if (resource === 'invoiceAppendices') {
              const invoiceType = this.getNodeParameter('invoiceType', i) as string;
              
              if (invoiceType === 'customer') {
                const invoiceId = this.getNodeParameter('customerInvoiceId', i) as string;
                getUrl = `/customer_invoices/${invoiceId}/appendices`;
              } else if (invoiceType === 'supplier') {
                const invoiceId = this.getNodeParameter('supplierInvoiceId', i) as string;
                getUrl = `/supplier_invoices/${invoiceId}/appendices`;
              }
            }
            
            responseData = await pennylaneApiRequest.call(this, 'GET', getUrl);
            break;

          case 'get':
            // Gestion spéciale pour trial_balance et fiscal_years (pas d'ID, mais paramètres)
            if (resource === 'trialBalance') {
              const periodStart = this.getNodeParameter('periodStart', i) as string;
              const periodEnd = this.getNodeParameter('periodEnd', i) as string;
              const page = this.getNodeParameter('page', i) as number;
              const perPage = this.getNodeParameter('perPage', i) as number;
              const getUrl = `/${endpoint}?period_start=${periodStart}&period_end=${periodEnd}&page=${page}&per_page=${perPage}`;
              responseData = await pennylaneApiRequest.call(this, 'GET', getUrl);
            } else if (resource === 'fiscalYear') {
              const page = this.getNodeParameter('page', i) as number;
              const perPage = this.getNodeParameter('perPage', i) as number;
              const getUrl = `/${endpoint}?page=${page}&per_page=${perPage}`;
              responseData = await pennylaneApiRequest.call(this, 'GET', getUrl);
            } else if (resource === 'payment') {
              // GET: Paiements d'une facture spécifique
              const paymentType = this.getNodeParameter('paymentType', i) as string;
              const invoiceId = this.getNodeParameter('paymentInvoiceId', i) as string;
              let getUrl: string;
              
              console.log(`🎯 Payment GET: ${paymentType} invoice ${invoiceId}`);
              
              if (paymentType === 'customer') {
                getUrl = `/customer_invoices/${invoiceId}/matched_transactions`;
              } else if (paymentType === 'supplier') {
                getUrl = `/supplier_invoices/${invoiceId}/matched_transactions`;
              } else {
                throw new Error('Invalid payment type');
              }
              
              responseData = await pennylaneApiRequest.call(this, 'GET', getUrl);
              
              // Enrichissement avec métadonnées de la facture
              if (responseData && responseData.items) {
                try {
                  const invoiceUrl = paymentType === 'customer' ? 
                    `/customer_invoices/${invoiceId}` : 
                    `/supplier_invoices/${invoiceId}`;
                  const invoiceData = await pennylaneApiRequest.call(this, 'GET', invoiceUrl);
                  
                  responseData.items = responseData.items.map((transaction: any) => ({
                    ...transaction,
                    invoice_type: paymentType,
                    invoice_id: invoiceId,
                    invoice_number: invoiceData.invoice_number,
                    invoice_amount: invoiceData.amount,
                    invoice_date: invoiceData.date,
                    [paymentType === 'customer' ? 'customer_name' : 'supplier_name']: 
                      invoiceData[paymentType]?.name || 'N/A'
                  }));
                  
                  responseData.source = 'specific_invoice_matched_transactions';
                } catch (error) {
                  console.log('⚠️ Impossible d\'enrichir les métadonnées:', error);
                }
              }
            } else if (resource === 'invoiceLines') {
              // Gestion spéciale pour Invoice Lines (même logique que getAll)
              const invoiceType = this.getNodeParameter('invoiceType', i) as string;
              let getUrl: string;
              
              if (invoiceType === 'customer') {
                const invoiceId = this.getNodeParameter('customerInvoiceId', i) as string;
                getUrl = `/customer_invoices/${invoiceId}/invoice_lines`;
              } else if (invoiceType === 'supplier') {
                const invoiceId = this.getNodeParameter('supplierInvoiceId', i) as string;
                getUrl = `/supplier_invoices/${invoiceId}/invoice_lines`;
              } else {
                throw new Error('Invalid invoice type');
              }
              
              responseData = await pennylaneApiRequest.call(this, 'GET', getUrl);
            } else if (resource === 'invoiceAppendices') {
              // Gestion spéciale pour Invoice Appendices (même logique que getAll)
              const invoiceType = this.getNodeParameter('invoiceType', i) as string;
              let getUrl: string;
              
              if (invoiceType === 'customer') {
                const invoiceId = this.getNodeParameter('customerInvoiceId', i) as string;
                getUrl = `/customer_invoices/${invoiceId}/appendices`;
              } else if (invoiceType === 'supplier') {
                const invoiceId = this.getNodeParameter('supplierInvoiceId', i) as string;
                getUrl = `/supplier_invoices/${invoiceId}/appendices`;
              } else {
                throw new Error('Invalid invoice type');
              }
              
              responseData = await pennylaneApiRequest.call(this, 'GET', getUrl);
            } else if (resource === 'userProfile') {
              // Gestion spéciale pour User Profile
              const selectionMode = this.getNodeParameter('userProfileSelectionMode', i) as string;
              let getUrl: string;
              
              if (selectionMode === 'me') {
                // Utiliser l'endpoint /me pour l'utilisateur connecté
                getUrl = '/me';
              } else {
                // Utiliser un ID spécifique (si l'API le supporte)
                const userId = this.getNodeParameter('userProfileId', i) as string;
                getUrl = `/users/${userId}`;
              }
              
              responseData = await pennylaneApiRequest.call(this, 'GET', getUrl);
            } else {
              // Gestion normale avec ID
              let getId: string;
        if (resource === 'customer') {
                // For GET, we need to determine customer type and use appropriate endpoint
                const customerType = this.getNodeParameter('customerType', i) as string;
                getId = this.getNodeParameter('customerId', i) as string;
                
                if (customerType === 'company') {
                  responseData = await pennylaneApiRequest.call(this, 'GET', `/company_customers/${getId}`);
                } else {
                  responseData = await pennylaneApiRequest.call(this, 'GET', `/individual_customers/${getId}`);
                }
                break;
              } else if (resource === 'supplier') {
                getId = this.getNodeParameter('supplierId', i) as string;
              } else if (resource === 'product') {
                getId = this.getNodeParameter('productId', i) as string;
              } else if (resource === 'customerInvoice') {
                getId = this.getNodeParameter('customerInvoiceId', i) as string;
              } else if (resource === 'supplierInvoice') {
                getId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              } else if (resource === 'journal') {
                getId = this.getNodeParameter('journalId', i) as string;
              } else if (resource === 'ledgerAccount') {
                getId = this.getNodeParameter('ledgerAccountId', i) as string;
              } else if (resource === 'ledgerEntry') {
                getId = this.getNodeParameter('ledgerEntryId', i) as string;
              } else if (resource === 'category') {
                getId = this.getNodeParameter('categoryId', i) as string;
              // NOTE: sepaMandate removed from GET due to HTML response issue
              } else {
                getId = this.getNodeParameter('resourceId', i) as string;
              }
              responseData = await pennylaneApiRequest.call(this, 'GET', `/${endpoint}/${getId}`);
            }
            break;

          // === NEW CUSTOMER INVOICE SUB-RESOURCE OPERATIONS ===
          
          case 'getInvoiceLines':
            const invoiceLinesId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            responseData = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${invoiceLinesId}/invoice_lines`);
            break;
            
          case 'getInvoiceLineSections':
            const sectionsId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            responseData = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${sectionsId}/invoice_line_sections`);
            break;
            
          case 'getPayments':
            const paymentsId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            responseData = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${paymentsId}/payments`);
            break;
            
          case 'getMatchedTransactions':
            const transactionsId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            responseData = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${transactionsId}/matched_transactions`);
            break;
            
          case 'getAppendices':
            const appendicesId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            responseData = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${appendicesId}/appendices`);
            break;
            
          case 'getCategories':
            const categoriesId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            responseData = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${categoriesId}/categories`);
            break;
            
          case 'getCustomHeaderFields':
            const headerFieldsId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            responseData = await pennylaneApiRequest.call(this, 'GET', `/customer_invoices/${headerFieldsId}/custom_header_fields`);
            break;
          
          case 'uploadAppendix':
            const uploadInvoiceId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            const fileData = this.getNodeParameter('appendixFile', i) as string;
            
            // TODO: Implement file upload with multipart/form-data
            // For now, throw error indicating implementation needed
            throw new Error(`Upload Appendix operation for invoice ${uploadInvoiceId} requires binary data input (file: ${fileData ? 'provided' : 'missing'}). Please implement file upload handling with multipart/form-data.`);
            // Expected implementation:
            // const formData = { file: fileData };
            // responseData = await pennylaneApiRequest.call(this, 'POST', `/customer_invoices/${uploadInvoiceId}/appendices`, formData, { 'Content-Type': 'multipart/form-data' });
            break;
            
          case 'categorizeInvoice':
            const categorizeId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            const categoriesDataRaw = this.getNodeParameter('invoiceCategories', i) as string;
            const categoriesData = typeof categoriesDataRaw === 'string' ? JSON.parse(categoriesDataRaw) : categoriesDataRaw;
            
            responseData = await pennylaneApiRequest.call(this, 'PUT', `/customer_invoices/${categorizeId}/categories`, { categories: categoriesData });
            break;
            
          case 'sendByEmail':
            const sendEmailId = this.getNodeParameter('subResourceInvoiceId', i) as string;
            const recipientsRaw = this.getNodeParameter('emailRecipients', i) as string;
            const recipients = recipientsRaw && recipientsRaw.trim() !== '' && recipientsRaw !== '[]' 
              ? (typeof recipientsRaw === 'string' ? JSON.parse(recipientsRaw) : recipientsRaw)
              : undefined;
            
            const emailBody = recipients ? { recipients } : {};
            responseData = await pennylaneApiRequest.call(this, 'POST', `/customer_invoices/${sendEmailId}/send_by_email`, emailBody);
            break;
          
          // === SUPPLIER INVOICE SUB-RESOURCE OPERATIONS ===
          
          case 'getInvoiceLines':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              responseData = await pennylaneApiRequest.call(this, 'GET', `/supplier_invoices/${invoiceId}/invoice_lines`);
            }
            break;
            
          case 'getCategories':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              responseData = await pennylaneApiRequest.call(this, 'GET', `/supplier_invoices/${invoiceId}/categories`);
            }
            break;
            
          case 'getPayments':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              responseData = await pennylaneApiRequest.call(this, 'GET', `/supplier_invoices/${invoiceId}/payments`);
            }
            break;
            
          case 'getMatchedTransactions':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              responseData = await pennylaneApiRequest.call(this, 'GET', `/supplier_invoices/${invoiceId}/matched_transactions`);
            }
            break;

          case 'create':
            let createData: object = {};
            
            if (resource === 'customer') {
              const customerType = this.getNodeParameter('customerType', i) as string;
              const email = this.getNodeParameter('customerEmail', i) as string;
              const phone = this.getNodeParameter('customerPhone', i) as string;
              const address = this.getNodeParameter('customerAddress', i) as string;
              const postalCode = this.getNodeParameter('customerPostalCode', i) as string;
              const city = this.getNodeParameter('customerCity', i) as string;
              const country = this.getNodeParameter('customerCountry', i) as string;
              
              // Validate required fields for CREATE
              if (!address || !postalCode || !city || !country) {
                throw new Error('Address, postal code, city and country are required for creating a customer');
              }
              
              // billing_address is REQUIRED by Pennylane API
              const billingAddress = {
                address: address.trim(),
                postal_code: postalCode.trim(),
                city: city.trim(),
                country_alpha2: country.trim().toUpperCase()
              };
              
              // Champs spécifiques selon le type
              if (customerType === 'company') {
                const name = this.getNodeParameter('customerName', i) as string;
                
                // Validate required fields for company
                if (!name) {
                  throw new Error('Company name is required for creating a company customer');
                }
                
                // For company: name + billing_address required
                createData = { 
                  name: name.trim(),
                  billing_address: billingAddress
                };
                
                // Optional fields
                if (email && email.trim() !== '') {
                  (createData as any).emails = [email.trim()];
                }
                if (phone && phone.trim() !== '') {
                  (createData as any).phone = phone.trim();
                }
                
                const siret = this.getNodeParameter('customerSiret', i) as string;
                const vatNumber = this.getNodeParameter('customerVatNumber', i) as string;
                
                if (siret && siret.trim() !== '') {
                  (createData as any).reg_no = siret.trim();
                }
                if (vatNumber && vatNumber.trim() !== '') {
                  (createData as any).vat_number = vatNumber.trim();
                }
                
                // Use company-specific endpoint
                responseData = await pennylaneApiRequest.call(this, 'POST', '/company_customers', createData);
              } else {
                // For individual: first_name + last_name + billing_address required
                const firstName = this.getNodeParameter('customerFirstName', i) as string;
                const lastName = this.getNodeParameter('customerLastName', i) as string;
                
                // Validate required fields for individual
                if (!firstName || !lastName) {
                  throw new Error('First name and last name are required for creating an individual customer');
                }
                
                createData = { 
                  first_name: firstName.trim(),
                  last_name: lastName.trim(),
                  billing_address: billingAddress
                };
                
                // Optional fields
                if (email && email.trim() !== '') {
                  (createData as any).emails = [email.trim()];
                }
                if (phone && phone.trim() !== '') {
                  (createData as any).phone = phone.trim();
                }
                
                // Use individual-specific endpoint
                responseData = await pennylaneApiRequest.call(this, 'POST', '/individual_customers', createData);
              }
              break;
            } else if (resource === 'supplier') {
              const name = this.getNodeParameter('supplierName', i) as string;
              const email = this.getNodeParameter('supplierEmail', i) as string;
              const phone = this.getNodeParameter('supplierPhone', i) as string;
              const address = this.getNodeParameter('supplierAddress', i) as string;
              const siret = this.getNodeParameter('supplierSiret', i) as string;
              const vatNumber = this.getNodeParameter('supplierVatNumber', i) as string;
              const paymentTerms = this.getNodeParameter('supplierPaymentTerms', i) as string;
              
              createData = { name };
              
              // Ajouter les champs optionnels seulement s'ils sont fournis
              if (email && email.trim() !== '') {
                (createData as any).email = email.trim();
              }
              if (phone && phone.trim() !== '') {
                (createData as any).phone = phone.trim();
              }
              if (address && address.trim() !== '') {
                (createData as any).address = address.trim();
              }
              if (siret && siret.trim() !== '') {
                (createData as any).siret = siret.trim();
              }
              if (vatNumber && vatNumber.trim() !== '') {
                (createData as any).vat_number = vatNumber.trim();
              }
              if (paymentTerms) {
                (createData as any).payment_terms = paymentTerms;
              }
            } else if (resource === 'category') {
              const label = this.getNodeParameter('categoryLabel', i) as string;
              const category_group_id = this.getNodeParameter('categoryGroupId', i) as number;
              createData = { label, category_group_id };
            } else if (resource === 'journal') {
              const code = this.getNodeParameter('journalCode', i) as string;
              const label = this.getNodeParameter('journalLabel', i) as string;
              createData = { code, label };
            } else if (resource === 'ledgerAccount') {
              const number = this.getNodeParameter('accountNumber', i) as string;
              const label = this.getNodeParameter('accountLabel', i) as string;
              createData = { number, label };
            } else if (resource === 'product') {
              const label = this.getNodeParameter('productLabel', i) as string;
              let unit = this.getNodeParameter('productUnit', i) as string;
              const currency = this.getNodeParameter('productCurrency', i) as string;
              const vat_rate = this.getNodeParameter('vatRate', i) as string;
              
              // Gestion de l'unité personnalisée
              if (unit === 'custom') {
                unit = this.getNodeParameter('productUnitCustom', i) as string;
              }
              
              // Gestion du prix (euros ou cents)
              const priceInputMethod = this.getNodeParameter('priceInputMethod', i) as string;
              let price_before_tax: string;
              
              if (priceInputMethod === 'euros') {
                const priceInCurrency = this.getNodeParameter('productPriceEuros', i) as number;
                // Convertir devise en cents (x100)
                price_before_tax = Math.round(priceInCurrency * 100).toString();
              } else {
                price_before_tax = (this.getNodeParameter('productPrice', i) as number).toString();
              }
              
              createData = { label, unit, currency, price_before_tax, vat_rate };
            } else if (resource === 'customerInvoice') {
              const creationMethod = this.getNodeParameter('invoiceCreationMethod', i) as string;
              const invoiceDate = this.getNodeParameter('invoiceDate', i) as string;
              const invoiceDeadlineRaw = this.getNodeParameter('invoiceDeadline', i) as string;
              const draft = this.getNodeParameter('invoiceDraft', i) as boolean;
              const date = invoiceDate.split('T')[0]; // Convertir la date au format YYYY-MM-DD
              const deadline = invoiceDeadlineRaw.split('T')[0]; // Convertir la date au format YYYY-MM-DD
              const customer_id = this.getNodeParameter('invoiceCustomerId', i) as number;
              const latestFinalizedInvoiceDate = draft === false
                ? await getLatestFinalizedInvoiceDate(this, customer_id)
                : null;
              const invoiceIssueDate = resolveInvoiceIssueDate(date, draft, latestFinalizedInvoiceDate);
              
              // Champs optionnels communs
              const invoiceTemplateId = this.getNodeParameter('invoiceTemplateId', i) as number;
              const currency = this.getNodeParameter('invoiceCurrency', i) as string;
              const language = this.getNodeParameter('invoiceLanguage', i) as string;
              const pdf_invoice_subject = this.getNodeParameter('invoiceSubject', i) as string;
              const pdf_description = this.getNodeParameter('invoiceDescription', i) as string;
              const pdf_invoice_free_text = this.getNodeParameter('invoiceFreeText', i) as string;
              const special_mention = this.getNodeParameter('invoiceSpecialMention', i) as string;
              const label = this.getNodeParameter('invoiceLabel', i) as string;
              const external_reference = this.getNodeParameter('invoiceExternalReference', i) as string;
              const transactionReferenceInput = this.getNodeParameter('invoiceTransactionReference', i, {}) as any;
              const transactionReferenceValues = transactionReferenceInput.values || transactionReferenceInput;
              
              // Gestion du discount structuré
              const discountType = this.getNodeParameter('invoiceDiscountType', i) as string;
              let discount: any = null;
              if (discountType === 'absolute') {
                const discountAmount = this.getNodeParameter('invoiceDiscountAmount', i) as number;
                discount = {
                  type: 'absolute',
                  value: discountAmount.toString()
                };
              } else if (discountType === 'relative') {
                const discountPercent = this.getNodeParameter('invoiceDiscountPercent', i) as number;
                discount = {
                  type: 'relative',
                  value: discountPercent.toString()
                };
              }
              
              // Invoice line sections (pour méthodes advanced et dynamic)
              let invoice_line_sections: any[] | null = null;
              if (creationMethod === 'advanced' || creationMethod === 'dynamic') {
                const sectionsRaw = this.getNodeParameter('invoiceLineSections', i) as string;
                if (sectionsRaw && sectionsRaw.trim() !== '' && sectionsRaw.trim() !== '[]') {
                  invoice_line_sections = typeof sectionsRaw === 'string' ? JSON.parse(sectionsRaw) : sectionsRaw;
                }
              }
              
              if (creationMethod === 'simple') {
                // Méthode simple : une seule ligne
                const product_id = this.getNodeParameter('invoiceProductId', i) as number;
                const quantity = this.getNodeParameter('invoiceQuantity', i) as number;
                
                createData = {
                  date: invoiceIssueDate,
                  deadline,
                  draft,
                  customer_id,
                  currency,
                  language,
                  invoice_lines: [{
                    product_id,
                    quantity: quantity.toString(),
                  }]
                };
                
                // Ajouter les champs optionnels s'ils sont fournis
                if (invoiceTemplateId && invoiceTemplateId > 0) {
                  (createData as any).customer_invoice_template_id = invoiceTemplateId;
                }
                if (pdf_invoice_subject && pdf_invoice_subject.trim() !== '') {
                  (createData as any).pdf_invoice_subject = pdf_invoice_subject.trim();
                }
                if (pdf_description && pdf_description.trim() !== '') {
                  (createData as any).pdf_description = pdf_description.trim();
                }
                if (pdf_invoice_free_text && pdf_invoice_free_text.trim() !== '') {
                  (createData as any).pdf_invoice_free_text = pdf_invoice_free_text.trim();
                }
                if (special_mention && special_mention.trim() !== '') {
                  (createData as any).special_mention = special_mention.trim();
                }
                if (label && label.trim() !== '') {
                  (createData as any).label = label.trim();
                }
                if (external_reference && external_reference.trim() !== '') {
                  (createData as any).external_reference = external_reference.trim();
                }
                if (discount) {
                  (createData as any).discount = discount;
                }
                appendTransactionReferenceToCreatePayload(createData as Record<string, any>, transactionReferenceValues);
              } else if (creationMethod === 'advanced') {
                // Méthode avancée : lignes multiples via JSON
                const invoiceLinesRaw = this.getNodeParameter('invoiceLines', i) as string;
                
                const invoice_lines = typeof invoiceLinesRaw === 'string' 
                  ? JSON.parse(invoiceLinesRaw) 
                  : invoiceLinesRaw;
                
                createData = {
                  date: invoiceIssueDate,
                  deadline,
                  draft,
                  customer_id,
                  currency,
                  language,
                  invoice_lines
                };
                
                // Ajouter les champs optionnels s'ils sont fournis
                if (invoiceTemplateId && invoiceTemplateId > 0) {
                  (createData as any).customer_invoice_template_id = invoiceTemplateId;
                }
                if (pdf_invoice_subject && pdf_invoice_subject.trim() !== '') {
                  (createData as any).pdf_invoice_subject = pdf_invoice_subject.trim();
                }
                if (pdf_description && pdf_description.trim() !== '') {
                  (createData as any).pdf_description = pdf_description.trim();
                }
                if (pdf_invoice_free_text && pdf_invoice_free_text.trim() !== '') {
                  (createData as any).pdf_invoice_free_text = pdf_invoice_free_text.trim();
                }
                if (special_mention && special_mention.trim() !== '') {
                  (createData as any).special_mention = special_mention.trim();
                }
                if (label && label.trim() !== '') {
                  (createData as any).label = label.trim();
                }
                if (external_reference && external_reference.trim() !== '') {
                  (createData as any).external_reference = external_reference.trim();
                }
                
                // Ajouter discount structuré si spécifié
                if (discount) {
                  (createData as any).discount = discount;
                }
                
                // Ajouter invoice_line_sections si spécifié
                if (invoice_line_sections) {
                  (createData as any).invoice_line_sections = invoice_line_sections;
                }
                appendTransactionReferenceToCreatePayload(createData as Record<string, any>, transactionReferenceValues);
              } else if (creationMethod === 'dynamic') {
                // Méthode dynamique : fixedCollection avec boutons Add/Remove
                const invoiceLinesDynamic = this.getNodeParameter('invoiceLinesDynamic', i) as any;
                
                const linesArray = invoiceLinesDynamic.lines || [];
                
                const invoice_lines = linesArray.map((lineData: any) => {
                  const line: any = {
                    product_id: lineData.product_id,
                    quantity: lineData.quantity.toString(),
                    raw_currency_unit_price: lineData.raw_currency_unit_price.toString(),
                    unit: lineData.unit === 'custom' ? lineData.customUnit : lineData.unit,
                    vat_rate: lineData.vat_rate
                  };
                  
                  // Ajouter label si fourni
                  if (lineData.label && lineData.label.trim() !== '') {
                    line.label = lineData.label.trim();
                  }
                  
                  // Ajouter discount si fourni
                  if (lineData.discount_amount && lineData.discount_amount > 0) {
                    line.discount_amount = lineData.discount_amount.toString();
                  }
                  
                  // Ajouter description si fournie
                  if (lineData.description && lineData.description.trim() !== '') {
                    line.description = lineData.description.trim();
                  }
                  
                  // Ajouter substance si fourni
                  if (lineData.substance && lineData.substance.trim() !== '') {
                    line.substance = lineData.substance;
                  }
                  
                  // Ajouter ledger_account_id si fourni
                  if (lineData.ledger_account_id && lineData.ledger_account_id > 0) {
                    line.ledger_account_id = lineData.ledger_account_id;
                  }
                  
                  // Ajouter section_rank si fourni
                  if (lineData.section_rank && lineData.section_rank > 0) {
                    line.section_rank = lineData.section_rank;
                  }
                  
                  return line;
                });
                
                createData = {
                  date: invoiceIssueDate,
                  deadline,
                  draft,
                  customer_id,
                  currency,
                  language,
                  invoice_lines
                };
                
                // Ajouter les champs optionnels s'ils sont fournis
                if (invoiceTemplateId && invoiceTemplateId > 0) {
                  (createData as any).customer_invoice_template_id = invoiceTemplateId;
                }
                if (pdf_invoice_subject && pdf_invoice_subject.trim() !== '') {
                  (createData as any).pdf_invoice_subject = pdf_invoice_subject.trim();
                }
                if (pdf_description && pdf_description.trim() !== '') {
                  (createData as any).pdf_description = pdf_description.trim();
                }
                if (pdf_invoice_free_text && pdf_invoice_free_text.trim() !== '') {
                  (createData as any).pdf_invoice_free_text = pdf_invoice_free_text.trim();
                }
                if (special_mention && special_mention.trim() !== '') {
                  (createData as any).special_mention = special_mention.trim();
                }
                if (label && label.trim() !== '') {
                  (createData as any).label = label.trim();
                }
                if (external_reference && external_reference.trim() !== '') {
                  (createData as any).external_reference = external_reference.trim();
                }
                
                // Ajouter discount structuré si spécifié
                if (discount) {
                  (createData as any).discount = discount;
                }
                
                // Ajouter invoice_line_sections si spécifié
                if (invoice_line_sections) {
                  (createData as any).invoice_line_sections = invoice_line_sections;
                }
                appendTransactionReferenceToCreatePayload(createData as Record<string, any>, transactionReferenceValues);
              } else if (creationMethod === 'json') {
                // Méthode JSON complète : utiliser directement le JSON fourni
                const completeJsonRaw = this.getNodeParameter('invoiceCompleteJson', i) as string;
                const completeData = typeof completeJsonRaw === 'string' 
                  ? JSON.parse(completeJsonRaw) 
                  : completeJsonRaw;
                
                // Remplacer les valeurs du formulaire si nécessaire (les valeurs du JSON prennent le dessus si déjà présentes)
                createData = {
                  currency,
                  language,
                  ...completeData,
                  date: invoiceIssueDate,
                  deadline,
                  draft,
                  customer_id
                };
                appendTransactionReferenceToCreatePayload(createData as Record<string, any>, transactionReferenceValues);
              }
            } else if (resource === 'sepaMandate') {
              const customer_id = this.getNodeParameter('mandateCustomerId', i) as number;
              const iban = this.getNodeParameter('mandateIban', i) as string;
              createData = { customer_id, iban };
            } else if (resource === 'eInvoiceImport') {
              const eInvoiceDataRaw = this.getNodeParameter('eInvoiceData', i) as string;
              createData = typeof eInvoiceDataRaw === 'string' ? JSON.parse(eInvoiceDataRaw) : eInvoiceDataRaw;
            } else {
              throw new Error(`Create operation not supported for ${resource}. Supported resources: suppliers, categories, journals, ledgerAccounts, products, customerInvoices, sepaMandates, eInvoiceImport.`);
            }
            
            responseData = await pennylaneApiRequest.call(this, 'POST', `/${endpoint}`, createData);
            break;

          case 'update':
            let updateId: string;
            if (resource === 'customer') {
              updateId = this.getNodeParameter('customerId', i) as string;
            } else if (resource === 'supplier') {
              updateId = this.getNodeParameter('supplierId', i) as string;
            } else if (resource === 'product') {
              updateId = this.getNodeParameter('productId', i) as string;
            } else if (resource === 'customerInvoice') {
              updateId = this.getNodeParameter('customerInvoiceId', i) as string;
            } else if (resource === 'supplierInvoice') {
              updateId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
            } else if (resource === 'category') {
              updateId = this.getNodeParameter('categoryId', i) as string;
            // NOTE: sepaMandate removed from UPDATE due to HTML response issue
            } else {
              updateId = this.getNodeParameter('resourceId', i) as string;
            }
            
            let updateData: object = {};
            
            if (resource === 'customer') {
              // For UPDATE, we need to determine customer type and use appropriate endpoint
              const customerType = this.getNodeParameter('customerType', i) as string;
              updateData = {};
              
              // Common optional fields
              const email = this.getNodeParameter('customerEmail', i) as string;
              const phone = this.getNodeParameter('customerPhone', i) as string;
              const address = this.getNodeParameter('customerAddress', i) as string;
              const postalCode = this.getNodeParameter('customerPostalCode', i) as string;
              const city = this.getNodeParameter('customerCity', i) as string;
              const country = this.getNodeParameter('customerCountry', i) as string;
              
              if (email && email.trim() !== '') {
                (updateData as any).emails = [email.trim()];
              }
              if (phone && phone.trim() !== '') {
                (updateData as any).phone = phone.trim();
              }
              
              // billing_address (optional, but if provided must be complete)
              if (address && postalCode && city && country) {
                (updateData as any).billing_address = {
                  address: address.trim(),
                  postal_code: postalCode.trim(),
                  city: city.trim(),
                  country_alpha2: country.trim().toUpperCase()
                };
              }
              
              if (customerType === 'company') {
                const name = this.getNodeParameter('customerName', i) as string;
                if (name && name.trim() !== '') {
                  (updateData as any).name = name.trim();
                }
                
                const siret = this.getNodeParameter('customerSiret', i) as string;
                const vatNumber = this.getNodeParameter('customerVatNumber', i) as string;
                
                if (siret && siret.trim() !== '') {
                  (updateData as any).reg_no = siret.trim();
                }
                if (vatNumber && vatNumber.trim() !== '') {
                  (updateData as any).vat_number = vatNumber.trim();
                }
                
                // Use company-specific endpoint
                responseData = await pennylaneApiRequest.call(this, 'PUT', `/company_customers/${updateId}`, updateData);
                break;
              } else {
                const firstName = this.getNodeParameter('customerFirstName', i) as string;
                const lastName = this.getNodeParameter('customerLastName', i) as string;
                
                if (firstName && firstName.trim() !== '') {
                  (updateData as any).first_name = firstName.trim();
                }
                if (lastName && lastName.trim() !== '') {
                  (updateData as any).last_name = lastName.trim();
                }
                
                // Use individual-specific endpoint
                responseData = await pennylaneApiRequest.call(this, 'PUT', `/individual_customers/${updateId}`, updateData);
                break;
              }
            } else if (resource === 'supplier') {
              const name = this.getNodeParameter('supplierName', i) as string;
              updateData = { name };
            } else if (resource === 'category') {
              const label = this.getNodeParameter('categoryLabel', i) as string;
              updateData = { label };
            } else if (resource === 'customerInvoice') {
              // Pour les factures, on peut mettre à jour certains champs
              updateData = { label: "Updated invoice" };
            } else if (resource === 'product') {
              // Product UPDATE: all fields are optional
              updateData = {};
              
              const label = this.getNodeParameter('productLabel', i) as string;
              if (label && label.trim() !== '') {
                (updateData as any).label = label.trim();
              }
              
              let unit = this.getNodeParameter('productUnit', i) as string;
              if (unit && unit.trim() !== '') {
                // Handle custom unit
                if (unit === 'custom') {
                  const customUnit = this.getNodeParameter('productUnitCustom', i) as string;
                  if (customUnit && customUnit.trim() !== '') {
                    (updateData as any).unit = customUnit.trim();
                  }
                } else {
                  (updateData as any).unit = unit.trim();
                }
              }
              
              const currency = this.getNodeParameter('productCurrency', i) as string;
              if (currency && currency.trim() !== '') {
                (updateData as any).currency = currency.trim();
              }
              
              const vatRate = this.getNodeParameter('vatRate', i) as string;
              if (vatRate && vatRate.trim() !== '') {
                (updateData as any).vat_rate = vatRate.trim();
              }
              
              // Handle price (euros or cents)
              const priceInputMethod = this.getNodeParameter('priceInputMethod', i) as string;
              if (priceInputMethod === 'euros') {
                const priceInCurrency = this.getNodeParameter('productPriceEuros', i) as number;
                if (priceInCurrency !== undefined && priceInCurrency !== null) {
                  // Convert currency to cents (x100)
                  (updateData as any).price_before_tax = Math.round(priceInCurrency * 100).toString();
                }
              } else {
                const priceInCents = this.getNodeParameter('productPrice', i) as number;
                if (priceInCents !== undefined && priceInCents !== null) {
                  (updateData as any).price_before_tax = priceInCents.toString();
                }
              }
            // NOTE: sepaMandate removed from UPDATE due to HTML response issue
            } else if (resource === 'supplierInvoice') {
              // Supplier invoice UPDATE: use JSON input
              const updateDataRaw = this.getNodeParameter('updateInvoiceData', i) as string;
              updateData = typeof updateDataRaw === 'string' ? JSON.parse(updateDataRaw) : updateDataRaw;
            } else {
              throw new Error(`Update operation not supported for ${resource}. Supported resources: customers, suppliers, categories, customerInvoices, products, supplierInvoices.`);
            }
            
            responseData = await pennylaneApiRequest.call(this, 'PUT', `/${endpoint}/${updateId}`, updateData);
            break;
          
          // === SUPPLIER INVOICE WRITE OPERATIONS ===
          
          case 'importInvoice':
            if (resource === 'supplierInvoice') {
              const importDataRaw = this.getNodeParameter('importInvoiceData', i) as string;
              const importData = typeof importDataRaw === 'string' ? JSON.parse(importDataRaw) : importDataRaw;
              responseData = await pennylaneApiRequest.call(this, 'POST', '/supplier_invoices/import', importData);
            }
            break;
            
          case 'categorizeInvoice':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              const categoriesDataRaw = this.getNodeParameter('categoriesData', i) as string;
              const categoriesData = typeof categoriesDataRaw === 'string' ? JSON.parse(categoriesDataRaw) : categoriesDataRaw;
              responseData = await pennylaneApiRequest.call(this, 'PUT', `/supplier_invoices/${invoiceId}/categories`, { categories: categoriesData });
            }
            break;

          case 'markAsPaid':
            if (resource === 'customerInvoice') {
              const invoiceId = this.getNodeParameter('customerInvoiceId', i) as string;
              const endpoint = buildCustomerInvoiceMarkAsPaidEndpoint(invoiceId);
              responseData = await pennylaneApiRequest.call(this, 'PUT', endpoint, {});
            }
            break;
            
          case 'updatePaymentStatus':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              const paymentStatus = this.getNodeParameter('paymentStatus', i) as string;
              responseData = await pennylaneApiRequest.call(this, 'PUT', `/supplier_invoices/${invoiceId}/payment_status`, { payment_status: paymentStatus });
            }
            break;
            
          case 'validateAccounting':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              responseData = await pennylaneApiRequest.call(this, 'PUT', `/supplier_invoices/${invoiceId}/validate_accounting`, {});
            }
            break;
            
          case 'linkPurchaseRequest':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              const purchaseRequestId = this.getNodeParameter('purchaseRequestId', i) as string;
              responseData = await pennylaneApiRequest.call(this, 'POST', `/supplier_invoices/${invoiceId}/linked_purchase_requests`, { purchase_request_id: purchaseRequestId });
            }
            break;
            
          case 'updateEInvoiceStatus':
            if (resource === 'supplierInvoice') {
              const invoiceId = this.getNodeParameter('subResourceSupplierInvoiceId', i) as string;
              const eInvoiceStatus = this.getNodeParameter('eInvoiceStatus', i) as string;
              const reason = this.getNodeParameter('eInvoiceReason', i, undefined) as string | undefined;
              
              const requestBody: any = { status: eInvoiceStatus };
              if (reason && (eInvoiceStatus === 'disputed' || eInvoiceStatus === 'refused')) {
                requestBody.reason = reason;
              }
              
              responseData = await pennylaneApiRequest.call(this, 'PUT', `/supplier_invoices/${invoiceId}/e_invoice_status`, requestBody);
            }
            break;

          case 'delete':
            let deleteId: string;
        if (resource === 'customer') {
              deleteId = this.getNodeParameter('customerId', i) as string;
            } else if (resource === 'supplier') {
              deleteId = this.getNodeParameter('supplierId', i) as string;
            } else if (resource === 'product') {
              deleteId = this.getNodeParameter('productId', i) as string;
            } else if (resource === 'customerInvoice') {
              deleteId = this.getNodeParameter('customerInvoiceId', i) as string;
            } else if (resource === 'sepaMandate') {
              deleteId = this.getNodeParameter('mandateId', i) as string;
            } else {
              deleteId = this.getNodeParameter('resourceId', i) as string;
            }
            
            if (resource === 'customerInvoice') {
              // DELETE pour les factures brouillons
              responseData = await pennylaneApiRequest.call(this, 'DELETE', `/customer_invoices/${deleteId}`);
            } else if (resource === 'sepaMandate') {
              // DELETE pour les mandats SEPA
              responseData = await pennylaneApiRequest.call(this, 'DELETE', `/customer_mandates/${deleteId}`);
            } else {
              throw new Error(`Delete operation not supported for ${resource}. Supported resources: customerInvoices, sepaMandates.`);
            }
            break;

          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        // Split automatique pour les opérations GET ALL qui retournent des items
        if (operation === 'getAll' && responseData && responseData.items && Array.isArray(responseData.items)) {
          const shouldSplit = ['payment', 'customerInvoice', 'supplierInvoice', 'customer', 'supplier', 'product', 'transaction', 'category', 'ledgerEntryLine', 'journal'].includes(resource);
          
          if (shouldSplit && responseData.items.length > 0) {
            console.log(`📦 Split ${resource} GET ALL: ${responseData.items.length} items -> ${responseData.items.length} outputs`);
            
            // Chaque item devient un output séparé
            for (const item of responseData.items) {
              returnData.push({
                json: {
                  ...item,
                  // Métadonnées optionnelles de l'agrégation (si présentes)
                  ...(responseData.source && { _source: responseData.source }),
                  ...(responseData.total_payments && { _total_payments: responseData.total_payments }),
                  ...(responseData.generated_at && { _generated_at: responseData.generated_at }),
                },
              });
            }
          } else {
            // Pas de split, retourner la réponse complète
            returnData.push({
              json: responseData || { message: 'Operation completed' },
            });
          }
        } else {
          // Toutes les autres opérations (GET, CREATE, UPDATE, DELETE)
          returnData.push({
            json: responseData || { message: 'Operation completed' },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error instanceof Error ? error.message : String(error) },
          });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  }
}
