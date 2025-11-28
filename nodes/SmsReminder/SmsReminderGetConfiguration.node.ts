import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import {NodeOperationError } from 'n8n-workflow';

export class SmsReminderGetConfiguration implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get User Configuration',
		name: 'smsReminderGetConfiguration',
		group: ['output','input','transform'],
		icon: 'file:SmsReminder.svg',
		version: 1,
		description: 'Sms Reminder Node for n8n',
		defaults: {
			name: 'SMS Reminder',
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
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'API Key',
						value: 'apiKey',
					}
				],
				default: 'apiKey',
			},
				{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the user to retrieve appointments or configuration for',
			},
		],
	};

	// The execute method will go here
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('smsReminderApi');

		Logger.info(`[SmsReminderGetConfiguration] Starting execution with ${items.length} input items`);
		Logger.debug(`[SmsReminderGetConfiguration] Credentials domain: ${credentials.domain}`);

		try {
			// Loop through each item in the input data
			// and make an API request for each userId
			// to retrieve their configuration.
			// The response will be stored in the items array.
			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

				const userId = this.getNodeParameter('userId', itemIndex) as string;
				const apiUrl = `${credentials.domain}/api/configuration?userId=${userId}`;

				Logger.info(`[SmsReminderGetConfiguration] Processing item ${itemIndex + 1}/${items.length}`);
				Logger.info(`[SmsReminderGetConfiguration] API URL: ${apiUrl}`);
				Logger.debug(`[SmsReminderGetConfiguration] User ID: ${userId}`);

				try {
					Logger.info(`[SmsReminderGetConfiguration] Sending GET request to ${apiUrl}`);
					const startTime = Date.now();

					const response = await this.helpers.request({
								method: 'GET',
								url: apiUrl,
								headers: {
										'WorkerSecret': `${credentials.token}`,
										'Content-Type': 'application/json',
								},
					});

					const duration = Date.now() - startTime;
					Logger.info(`[SmsReminderGetConfiguration] Request completed in ${duration}ms`);
					Logger.debug(`[SmsReminderGetConfiguration] Raw response: ${response}`);

					const configuration = JSON.parse(response);
					Logger.info(`[SmsReminderGetConfiguration] Successfully retrieved configuration for userId: ${userId}`);
					Logger.debug(`[SmsReminderGetConfiguration] Parsed configuration: ${JSON.stringify(configuration)}`);

					items[itemIndex] = {
						json: {
							userId: items[itemIndex].json.userId || userId,
							configurationId: configuration.Id,
							messageTemplate: configuration.messageTemplate,
							useai: Boolean(configuration.useai) || false,
							profession: configuration.profession || 'Unknown',
						},
						pairedItem: itemIndex,
					};

					Logger.debug(`[SmsReminderGetConfiguration] Created item for userId ${userId}: ${JSON.stringify(items[itemIndex].json)}`);

				} catch (error) {
					Logger.error(`[SmsReminderGetConfiguration] Request failed for item ${itemIndex + 1}`);
					Logger.error(`[SmsReminderGetConfiguration] URL: ${apiUrl}`);
					Logger.error(`[SmsReminderGetConfiguration] User ID: ${userId}`);
					Logger.error(`[SmsReminderGetConfiguration] Error: ${error.message}`);
					if (error.statusCode) {
						Logger.error(`[SmsReminderGetConfiguration] Status code: ${error.statusCode}`);
					}
					if (error.response) {
						Logger.error(`[SmsReminderGetConfiguration] Response status: ${error.response.status}`);
						Logger.error(`[SmsReminderGetConfiguration] Response data: ${JSON.stringify(error.response.data)}`);
					}
					throw error;
				}
			}

		} catch (error) {
				Logger.error(`[SmsReminderGetConfiguration] Execution failed`);
				Logger.error(`[SmsReminderGetConfiguration] Error details: ${error.message}`);

				if (this.continueOnFail()) {
					Logger.warn(`[SmsReminderGetConfiguration] Continuing on fail, adding error to items`);
					items.push({ json: this.getInputData(0)[0].json, error, pairedItem: 0 });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = 0;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex:0,
					});
				}
		}

		Logger.info(`[SmsReminderGetConfiguration] Execution completed, returning ${items.length} items`);
		return [items];
	}
}
