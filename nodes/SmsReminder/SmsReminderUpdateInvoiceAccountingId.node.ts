import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger,
	NodeOperationError,
} from 'n8n-workflow';

export class SmsReminderUpdateInvoiceAccountingId implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Update Invoice Accounting ID',
		name: 'smsReminderUpdateInvoiceAccountingId',
		group: ['transform'],
		icon: 'file:SmsReminder.svg',
		version: 1,
		description: 'Stores the accounting system invoice ID on a SMS Agenda invoice',
		defaults: {
			name: 'Update Invoice Accounting ID',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'smsReminderApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['apiKey'],
					},
				},
			},
		],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'API Key',
						value: 'apiKey',
					},
				],
				default: 'apiKey',
			},
			{
				displayName: 'Invoice ID',
				name: 'invoiceId',
				type: 'string',
				default: '',
				required: true,
				description: 'UUID of the SMS Agenda invoice to update',
			},
			{
				displayName: 'Accounting System Invoice ID',
				name: 'accountingSystemInvoiceId',
				type: 'string',
				default: '',
				required: true,
				description: 'PennyLane invoice number (or other accounting system reference) to persist on the invoice',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('smsReminderApi');

		Logger.info(`[UpdateInvoiceAccountingId] Starting execution with ${items.length} input items`);

		for (let i = 0; i < items.length; i++) {
			const invoiceId = this.getNodeParameter('invoiceId', i) as string;
			const accountingSystemInvoiceId = this.getNodeParameter('accountingSystemInvoiceId', i) as string;
			const url = `${credentials.domain}/api/invoices/${invoiceId}/accounting`;

			Logger.info(`[UpdateInvoiceAccountingId] PATCH ${url} for invoice ${invoiceId}`);

			try {
				await this.helpers.request({
					method: 'PATCH',
					url,
					headers: {
						'WorkerSecret': `${credentials.token}`,
						'Content-Type': 'application/json',
					},
					body: { accountingSystemInvoiceId },
					json: true,
				});

				items[i] = {
					json: { ...items[i].json, accountingSystemInvoiceIdStored: true },
					pairedItem: i,
				};

				Logger.info(`[UpdateInvoiceAccountingId] Successfully updated accounting ID for invoice ${invoiceId}`);
			} catch (error) {
				Logger.error(`[UpdateInvoiceAccountingId] Failed for invoice ${invoiceId}: ${(error as Error).message}`);
				if (this.continueOnFail()) {
					items[i] = {
						json: {
							...items[i].json,
							accountingSystemInvoiceIdStored: false,
							error: (error as Error).message,
						},
						pairedItem: i,
					};
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				}
			}
		}

		return [items];
	}
}
