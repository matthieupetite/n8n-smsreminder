import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger,
	NodeOperationError
} from 'n8n-workflow';

export class SmsReminderSendSmsReport implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Send SMS Report',
		name: 'smsReminderSendSmsReport',
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
		
		Logger.info(`[SmsReminderSendSmsReport] Starting execution with ${items.length} input items`);
		Logger.debug(`[SmsReminderSendSmsReport] Credentials domain: ${credentials.domain}`);

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
				const apiUrl = `${credentials.domain}/api/sms`;
				
				const body = {
					userid: userId,
					message: messageSent,
					phonenumber: phoneNumber,
					messagereportdate : reportDate,
					status: reportStatus,
					eventid: eventId,
				};
				
				Logger.info(`[SmsReminderSendSmsReport] Processing item ${itemIndex + 1}/${items.length}`);
				Logger.info(`[SmsReminderSendSmsReport] API URL: ${apiUrl}`);
				Logger.debug(`[SmsReminderSendSmsReport] Parameters - userId: ${userId}, phoneNumber: ${phoneNumber}, eventId: ${eventId}, status: ${reportStatus}, reportDate: ${reportDate}`);
				Logger.debug(`[SmsReminderSendSmsReport] Request body: ${JSON.stringify(body)}`);

				try {
					Logger.info(`[SmsReminderSendSmsReport] Sending POST request to ${apiUrl}`);
					const startTime = Date.now();
					
					const response = await this.helpers.request({
								method: 'POST',
								url: apiUrl,
								headers: {
									'WorkerSecret': `${credentials.token}`,
									'Content-Type': 'application/json',
								},
								body,
								json: true,
					});
					
					const duration = Date.now() - startTime;
					Logger.info(`[SmsReminderSendSmsReport] Report sent successfully in ${duration}ms`);
					Logger.debug(`[SmsReminderSendSmsReport] Response: ${JSON.stringify(response)}`);
					Logger.info(`[SmsReminderSendSmsReport] Item ${itemIndex + 1} processed successfully`);
					
				} catch (error) {
					Logger.error(`[SmsReminderSendSmsReport] Failed to send SMS report for item ${itemIndex + 1}`);
					Logger.error(`[SmsReminderSendSmsReport] API URL: ${apiUrl}`);
					Logger.error(`[SmsReminderSendSmsReport] Request body: ${JSON.stringify(body)}`);
					Logger.error(`[SmsReminderSendSmsReport] Error: ${error.message}`);
					if (error.statusCode) {
						Logger.error(`[SmsReminderSendSmsReport] Status code: ${error.statusCode}`);
					}
					if (error.response) {
						Logger.error(`[SmsReminderSendSmsReport] Response status: ${error.response.status}`);
						Logger.error(`[SmsReminderSendSmsReport] Response data: ${JSON.stringify(error.response.data)}`);
					}
					throw error;
				}
			}

		} catch (error) {
				Logger.error(`[SmsReminderSendSmsReport] Execution failed`);
				Logger.error(`[SmsReminderSendSmsReport] Error details: ${error.message}`);
				
				if (this.continueOnFail()) {
					Logger.warn(`[SmsReminderSendSmsReport] Continuing on fail, adding error to items`);
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
		
		Logger.info(`[SmsReminderSendSmsReport] Execution completed, returning ${items.length} items`);
		return [items];
	}
}
