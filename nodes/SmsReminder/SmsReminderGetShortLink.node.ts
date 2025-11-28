import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class SmsReminderGetShortLink implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get Short Link',
		name: 'smsReminderGetShortLink',
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
				type: 'string',
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

		Logger.info(`[SmsReminderGetShortLink] Starting execution with ${items.length} input items`);
		Logger.debug(`[SmsReminderGetShortLink] Credentials domain: ${credentials.domain}`);

		try {
			// Loop through each item in the input data
			// and make an API request for each userId
			// to retrieve their configuration.
			// The response will be stored in the items array.
			for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

				const userId = this.getNodeParameter('userId', itemIndex)?.toString() ?? '';
				const eventId = this.getNodeParameter('eventId', itemIndex)?.toString() ?? '';
				const eventDate = this.getNodeParameter('eventDate', itemIndex)?.toString() ?? '';
				const phoneNumber = this.getNodeParameter('phoneNumber', itemIndex)?.toString() ?? '';
				const apiUrl = `${credentials.domain}/api/attendeepresence/shortlink?userId=${encodeURIComponent(userId)}&eventId=${encodeURIComponent(eventId)}&startDate=${encodeURIComponent(eventDate).replace(/%20/g, '+')}&phoneNumber=${encodeURIComponent(phoneNumber).replace(/%20/g, '+')}`;

				Logger.info(`[SmsReminderGetShortLink] Processing item ${itemIndex + 1}/${items.length}`);
				Logger.info(`[SmsReminderGetShortLink] API URL: ${apiUrl}`);
				Logger.debug(`[SmsReminderGetShortLink] Parameters - userId: ${userId}, eventId: ${eventId}, eventDate: ${eventDate}, phoneNumber: ${phoneNumber}`);

				try {
					Logger.info(`[SmsReminderGetShortLink] Sending GET request to ${apiUrl}`);
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
					Logger.info(`[SmsReminderGetShortLink] Request completed in ${duration}ms`);
					Logger.debug(`[SmsReminderGetShortLink] Raw response: ${response}`);

					const shortLinkResponse = JSON.parse(response);
					Logger.info(`[SmsReminderGetShortLink] Successfully retrieved short link for userId: ${userId}, eventId: ${eventId}`);
					Logger.debug(`[SmsReminderGetShortLink] Parsed response: ${JSON.stringify(shortLinkResponse)}`);

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

					Logger.debug(`[SmsReminderGetShortLink] Created item with shortLink: ${shortLinkResponse.shortlink}`);

				} catch (error) {
					Logger.error(`[SmsReminderGetShortLink] Request failed for item ${itemIndex + 1}`);
					Logger.error(`[SmsReminderGetShortLink] URL: ${apiUrl}`);
					Logger.error(`[SmsReminderGetShortLink] Parameters - userId: ${userId}, eventId: ${eventId}, eventDate: ${eventDate}, phoneNumber: ${phoneNumber}`);
					Logger.error(`[SmsReminderGetShortLink] Error: ${error.message}`);
					if (error.statusCode) {
						Logger.error(`[SmsReminderGetShortLink] Status code: ${error.statusCode}`);
					}
					if (error.response) {
						Logger.error(`[SmsReminderGetShortLink] Response status: ${error.response.status}`);
						Logger.error(`[SmsReminderGetShortLink] Response data: ${JSON.stringify(error.response.data)}`);
					}
					throw error;
				}
			}

		} catch (error) {
				Logger.error(`[SmsReminderGetShortLink] Execution failed`);
				Logger.error(`[SmsReminderGetShortLink] Error details: ${error.message}`);

				if (this.continueOnFail()) {
					Logger.warn(`[SmsReminderGetShortLink] Continuing on fail, adding error to items`);
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

		Logger.info(`[SmsReminderGetShortLink] Execution completed, returning ${items.length} items`);
		return [items];
	}
}
