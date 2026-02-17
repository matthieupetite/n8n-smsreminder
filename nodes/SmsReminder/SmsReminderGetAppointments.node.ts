import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger,
	NodeOperationError
} from 'n8n-workflow';

export class SmsReminderGetAppointments implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get User Appointments',
		name: 'smsReminderGetAppointments',
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
				description: 'The ID of the user to retrieve appointments',
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
				required: true,
				description: 'The search date from which to retrieve appointments',
			},
			{
				displayName: 'End Date',
				name: 'endDate',
				type: 'dateTime',
				default: '',
				required: true,
				description: 'The search date until which to retrieve appointments',
			},
		],
	};

	// The execute method will go here
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('smsReminderApi');
		const returnData: INodeExecutionData[] = [];

		Logger.info(`[SmsReminderGetAppointments] Starting execution with ${items.length} input items`);
		Logger.debug(`[SmsReminderGetAppointments] Credentials domain: ${credentials.domain}`);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Loop through each item in the input data
				// and make an API request for each userId
				// to retrieve their configuration.
				// The response will be stored in the items array.

				const userId = this.getNodeParameter('userId', itemIndex) as string;
				const startDate = this.getNodeParameter('startDate', itemIndex) as string;
				const endDate = this.getNodeParameter('endDate', itemIndex) as string;

				const apiUrl = `${credentials.domain}/api/appointments/getallbydate?userId=${userId}&startDate=${startDate}&endDate=${endDate}`;

				Logger.info(`[SmsReminderGetAppointments] Processing item ${itemIndex + 1}/${items.length}`);
				Logger.info(`[SmsReminderGetAppointments] API URL: ${apiUrl}`);
				Logger.debug(`[SmsReminderGetAppointments] Parameters - userId: ${userId}, startDate: ${startDate}, endDate: ${endDate}`);

				try {
					Logger.info(`[SmsReminderGetAppointments] Sending GET request to ${apiUrl}`);
					const startTime = Date.now();

					const response = await this.helpers.request({
						method: 'GET',
						url: apiUrl,
						headers: {
							WorkerSecret: `${credentials.token}`,
							'Content-Type': 'application/json',
						},
						json: true,
					});

					const duration = Date.now() - startTime;
					Logger.info(`[SmsReminderGetAppointments] Request completed in ${duration}ms`);
					Logger.debug(`[SmsReminderGetAppointments] Raw API response: ${JSON.stringify(response)}`);
					// Parse response and create individual items for each phone number
					// const parsedResponse = JSON.parse(response);
					const appointmentsItems: INodeExecutionData[] = response.items?.flatMap((appointment: any) =>
						appointment.attendeePhoneNumberList?.map((phoneNumber: string) => ({
							json: {
								eventId: appointment.id,
								title: appointment.title,
								description: appointment.description,
								date: appointment.date,
								attendeePhoneNumber: phoneNumber,
								userId: appointment.userId
							},
							pairedItem: itemIndex
						})) || []
					) || [];

					Logger.info(`[SmsReminderGetAppointments] Found ${response.items?.length || 0} appointments, created ${appointmentsItems.length} items (one per phone number)`);

					// Add all appointment items to return data
					returnData.push(...appointmentsItems);
				} catch (error) {
					// if the error is Http Error 404 we continue without adding items
					if (error.statusCode === 404) {
						Logger.warn(`[SmsReminderGetAppointments] No appointments found (404) for userId: ${userId} between ${startDate} and ${endDate}`);
						continue; // Continue to next item instead of returning
					}

					Logger.error(`[SmsReminderGetAppointments] Request failed for item ${itemIndex + 1}`);
					Logger.error(`[SmsReminderGetAppointments] URL: ${apiUrl}`);
					Logger.error(`[SmsReminderGetAppointments] Error: ${error.message}`);
					if (error.statusCode) {
						Logger.error(`[SmsReminderGetAppointments] Status code: ${error.statusCode}`);
					}
					if (error.response) {
						Logger.error(`[SmsReminderGetAppointments] Response status: ${error.response.status}`);
						Logger.error(`[SmsReminderGetAppointments] Response data: ${JSON.stringify(error.response.data)}`);
					}

					throw error; // Re-throw other errors
				}
			} catch (error) {
				Logger.error(`[SmsReminderGetAppointments] Error processing item ${itemIndex + 1}`);
				Logger.error(`[SmsReminderGetAppointments] Error details: ${error.message}`);

				if (this.continueOnFail()) {
					Logger.warn(`[SmsReminderGetAppointments] Continuing on fail, adding error to return data`);
					returnData.push({
						json: {
							...items[itemIndex].json,
							error: error.message
						},
						pairedItem: itemIndex
					});
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex: itemIndex,
					});
				}
			}
		}

		Logger.info(`[SmsReminderGetAppointments] Execution completed, returning ${returnData.length} total items`);
		return [returnData];
	}
}
