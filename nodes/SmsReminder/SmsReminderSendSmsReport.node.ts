import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class SmsReminderSendSmsReport implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Send SMS Report',
		name: 'smsReminderSendSmsReport',
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
				description: 'The ID of the user to send the SMS report',
			},
			{
				displayName: 'Message',
				name: 'messageSent',
				type: 'string',
				default: '',
				required: true,
				description: 'The message to send in the SMS report',
			},
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				required: true,
				description: 'The Phone Number to send in the SMS report',
			},
			{
				displayName: 'Report Date',
				name: 'reportDate',
				type: 'dateTime',
				default: '',
				required: true,
				description: 'The Report date to send in the SMS report',
			},
			{
				displayName: 'Report Status',
				name: 'reportStatus',
				type: 'options',
				default: 'Success',
				options: [
					{ name: 'Success', value: 'Success' },
					{ name: 'Failure', value: 'Failure' }
				],
				required: true,
				description: 'The Report status to send in the SMS report',
			},
			{
				displayName: 'Event ID',
				name: 'eventId',
				type: 'string',
				default: '',
				required: true,
				description: 'The Report EventId to send in the SMS report',
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
				const messageSent = this.getNodeParameter('messageSent', itemIndex) as string;
				const phoneNumber = this.getNodeParameter('phoneNumber', itemIndex) as string;
				const reportDate = this.getNodeParameter('reportDate', itemIndex) as string;
				const reportStatus = this.getNodeParameter('reportStatus', itemIndex) as string;
				const eventId = this.getNodeParameter('eventId', itemIndex) as string;
				Logger.debug(`User ID: ${userId}, Message: ${messageSent}, Phone Number: ${phoneNumber}, Report Date: ${reportDate}, Report Status: ${reportStatus}, Event ID: ${eventId}`);
				const apiUrl = `${credentials.domain}/api/sms`;

				await this.helpers.request({
							method: 'POST',
							url: apiUrl,
							headers: {
								'WorkerSecret': `${credentials.token}`,
								'Content-Type': 'application/json',
							},
							body: {
								userid: userId,
								message: messageSent,
								phonenumber: phoneNumber,
								messagereportdate : reportDate,
								status: reportStatus,
								eventid: eventId,
							},
							json: true,
				});
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
