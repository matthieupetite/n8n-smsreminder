import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class SmsReminderSendSms implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Send SMS',
		name: 'smsReminderSendSms',
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

		Logger.info(`[SmsReminderSendSms] Starting execution with ${items.length} input items`);
		Logger.debug(`[SmsReminderSendSms] Credentials domain: ${credentials.domain}`);

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

				Logger.info(`[SmsReminderSendSms] Processing item ${itemIndex + 1}/${items.length}`);
				Logger.info(`[SmsReminderSendSms] SMS API URL: ${smsApiUrl}`);
				Logger.debug(`[SmsReminderSendSms] Phone number: ${phoneNumber}`);
				Logger.debug(`[SmsReminderSendSms] Message length: ${messageSent.length} characters`);
				Logger.debug(`[SmsReminderSendSms] Request body: ${JSON.stringify(body)}`);

				try {
					Logger.info(`[SmsReminderSendSms] Sending POST request to ${smsApiUrl}`);
					const startTime = Date.now();

					const response = await this.helpers.request({
						method: 'POST',
						uri: smsApiUrl,
						body,
						json: true,
					});

					const duration = Date.now() - startTime;
					Logger.info(`[SmsReminderSendSms] SMS sent successfully in ${duration}ms`);
					Logger.debug(`[SmsReminderSendSms] Response: ${JSON.stringify(response)}`);

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

					Logger.info(`[SmsReminderSendSms] Item ${itemIndex + 1} marked as Success`);

				} catch (error) {
					Logger.error(`[SmsReminderSendSms] Failed to send SMS for item ${itemIndex + 1}`);
					Logger.error(`[SmsReminderSendSms] SMS API URL: ${smsApiUrl}`);
					Logger.error(`[SmsReminderSendSms] Phone number: ${phoneNumber}`);
					Logger.error(`[SmsReminderSendSms] Message: ${messageSent}`);
					Logger.error(`[SmsReminderSendSms] Error: ${error.message}`);
					if (error.statusCode) {
						Logger.error(`[SmsReminderSendSms] Status code: ${error.statusCode}`);
					}
					if (error.response) {
						Logger.error(`[SmsReminderSendSms] Response status: ${error.response.status}`);
						Logger.error(`[SmsReminderSendSms] Response data: ${JSON.stringify(error.response.data)}`);
					}

					Logger.warn(`[SmsReminderSendSms] Item ${itemIndex + 1} marked as Failure`);

					items[itemIndex] = {
							json: {
								...items[itemIndex].json,
								messageSent,
								phoneNumber,
								status: 'Failure',
								statusDate: new Date().toISOString(),
								errorMessage: error.message,
							},
							pairedItem: itemIndex,
						};
				}
			}

		} catch (error) {
				Logger.error(`[SmsReminderSendSms] Execution failed`);
				Logger.error(`[SmsReminderSendSms] Error details: ${error.message}`);

				if (this.continueOnFail()) {
					Logger.warn(`[SmsReminderSendSms] Continuing on fail, adding error to items`);
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

		Logger.info(`[SmsReminderSendSms] Execution completed, returning ${items.length} items`);
		return [items];
	}
}
