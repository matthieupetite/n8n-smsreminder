import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class SmsReminderGetShortLink implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get Short Link',
		name: 'smsReminderGetShortLink',
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
			{
				displayName: 'Event ID',
				name: 'eventId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ID of the event to retrieve the short link for',
			},
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				required: true,
				description: 'The phone number to retrieve the short link for',
			},
			{
				displayName: 'Event Date',
				name: 'eventDate',
				type: 'dateTime',
				default: '',
				required: true,
				description: 'The date of the event to retrieve the short link for',
			}
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
				const eventId = this.getNodeParameter('eventId', itemIndex) as string;
				const eventDate = this.getNodeParameter('eventDate', itemIndex) as string;
				const phoneNumber = this.getNodeParameter('phoneNumber', itemIndex) as string;
				const apiUrl = `${credentials.domain}/api/attendeepresence/shortlink?userId=${userId}&eventId=${eventId}&eventDate=${eventDate}&phoneNumber=${phoneNumber}`;
				const response = await this.helpers.request({
							method: 'GET',
							url: apiUrl,
							headers: {
									'WorkerSecret': `${credentials.token}`,
									'Content-Type': 'application/json',
							},
				});
				const shortLinkResponse = JSON.parse(response);
				Logger.info(`Retrieved configuration for userId: ${userId}`);
				items[itemIndex] = {
					json: {
						userId: userId,
						eventId: eventId,
						eventDate: eventDate,
						phoneNumber: phoneNumber,
						shortLink: shortLinkResponse.shortlink,
					},
					pairedItem: itemIndex,
				};
				Logger.info(`ShortLink for userId ${userId}: ${JSON.stringify(shortLinkResponse)}`);

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
