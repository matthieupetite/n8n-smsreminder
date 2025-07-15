import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class SmsReminderSendSms implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Send SMS',
		name: 'smsReminderSendSms',
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
				displayName: 'Sms Api URL',
				name: 'smsApiUrl',
				type: 'string',
				default: 'http://smssenderapi-smssenderapi-service.smssenderapi.svc.cluster.local/sms',
				required: true,
				description: 'The URL of the SMS API to send the SMS',
			},
			{
				displayName: 'Message',
				name: 'messageToSend',
				type: 'string',
				default: '',
				required: true,
				description: 'The message to send',
			},
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				default: '',
				required: true,
				description: 'The Phone Number to send the SMS',
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

				const messageSent = this.getNodeParameter('messageToSend', itemIndex) as string;
				const phoneNumber = this.getNodeParameter('phoneNumber', itemIndex) as string;
				const smsApiUrl =  this.getNodeParameter('smsApiUrl', itemIndex) as string;

				const body = {
					message: messageSent,
					phoneNumber: phoneNumber,
				};
				try {
					const response = await this.helpers.request({
						method: 'POST',
						uri: smsApiUrl,
						body,
						json: true,
					});

					if (response.status === 'success') {
						items[itemIndex] = {
							json: {
								...items[itemIndex].json,
								messageSent,
								phoneNumber,
								status: 'Success',
								statusDate: new Date().toISOString(),
							},
							pairedItem: itemIndex,
						};
					} else {
						items[itemIndex] = {
							json: {
								...items[itemIndex].json,
								messageSent,
								phoneNumber,
								status: 'Failure',
								statusDate: new Date().toISOString(),
							},
							pairedItem: itemIndex,
						};
					}
				} catch (error) {
					items[itemIndex] = {
							json: {
								...items[itemIndex].json,
								messageSent,
								phoneNumber,
								status: 'Failure',
								statusDate: new Date().toISOString(),
							},
							pairedItem: itemIndex,
						};
				}
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
