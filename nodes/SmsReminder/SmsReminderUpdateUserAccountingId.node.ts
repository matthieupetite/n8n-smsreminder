import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger,
	NodeOperationError,
} from 'n8n-workflow';

export class SmsReminderUpdateUserAccountingId implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Update User Accounting ID',
		name: 'smsReminderUpdateUserAccountingId',
		group: ['transform'],
		icon: 'file:SmsReminder.svg',
		version: 1,
		description: 'Stores the accounting system customer ID on a SMS Agenda user',
		defaults: {
			name: 'Update User Accounting ID',
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
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				description: 'UUID of the SMS Agenda user to update',
			},
			{
				displayName: 'Accounting System Customer ID',
				name: 'accountingSystemCustomerId',
				type: 'string',
				default: '',
				required: true,
				description: 'PennyLane (or other accounting system) customer ID to persist on the user',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('smsReminderApi');

		Logger.info(`[UpdateUserAccountingId] Starting execution with ${items.length} input items`);

		for (let i = 0; i < items.length; i++) {
			const userId = this.getNodeParameter('userId', i) as string;
			const accountingSystemCustomerId = this.getNodeParameter('accountingSystemCustomerId', i) as string;
			const url = `${credentials.domain}/api/users/${userId}/accounting`;

			Logger.info(`[UpdateUserAccountingId] PATCH ${url} for user ${userId}`);

			try {
				await this.helpers.request({
					method: 'PATCH',
					url,
					headers: {
						'WorkerSecret': `${credentials.token}`,
						'Content-Type': 'application/json',
					},
					body: { accountingSystemCustomerId },
					json: true,
				});

				items[i] = {
					json: { ...items[i].json, accountingSystemCustomerIdStored: true },
					pairedItem: i,
				};

				Logger.info(`[UpdateUserAccountingId] Successfully updated accounting ID for user ${userId}`);
			} catch (error) {
				Logger.error(`[UpdateUserAccountingId] Failed for user ${userId}: ${(error as Error).message}`);
				if (this.continueOnFail()) {
					items[i] = {
						json: {
							...items[i].json,
							accountingSystemCustomerIdStored: false,
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
