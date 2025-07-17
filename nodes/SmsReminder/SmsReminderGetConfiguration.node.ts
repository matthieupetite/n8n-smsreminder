import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class SmsReminderGetConfiguration implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get User Configuration',
		name: 'smsReminderGetConfiguration',
		group: ['SmsReminder'],
		icon: 'file:SmsReminder.svg',
		version: 1,
		description: 'Sms Reminder Node for n8n',
		defaults: {
			name: 'SMS Reminder',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
		Logger.info(`Executing get User Configuration with credentials: ${JSON.stringify(credentials)}`);
		Logger.info(`Using SMS Reminder API URL: ${credentials.domain}/api/user/userstoprocess`);

		try {
			// Loop through each item in the input data
			// and make an API request for each userId
			// to retrieve their configuration.
			// The response will be stored in the items array.
			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

				const userId = this.getNodeParameter('userId', itemIndex) as string;
				const apiUrl = `${credentials.domain}/api/configuration?userId=${userId}`;
				const response = await this.helpers.request({
							method: 'GET',
							url: apiUrl,
							headers: {
									'WorkerSecret': `${credentials.token}`,
									'Content-Type': 'application/json',
							},
				});
				const configuration = JSON.parse(response);
				Logger.info(`Retrieved configuration for userId: ${userId}`);
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
				Logger.info(`Configuration for userId ${userId}: ${JSON.stringify(configuration)}`);

			}

		} catch (error) {
				if (this.continueOnFail()) {
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
		return [items];
	}
}
