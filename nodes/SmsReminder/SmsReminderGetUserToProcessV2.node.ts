import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class SmsReminderGetUserToProcessV2 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get User to Process V2',
		name: 'smsReminderGetUserToProcessV2',
		group: ['output', 'input', 'transform'],
		icon: 'file:SmsReminder.svg',
		version: 1,
		description: 'Fetches users to process with per-user scheduling info (V2 — returns userId, calendarId, reminderDelayHours)',
		defaults: {
			name: 'SMS Reminder V2',
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
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('smsReminderApi');
		const apiUrl = `${credentials.domain}/api/user/userstoprocessv2`;

		Logger.info(`[SmsReminderGetUserToProcessV2] Starting execution`);
		Logger.info(`[SmsReminderGetUserToProcessV2] API URL: ${apiUrl}`);

		try {
			Logger.info(`[SmsReminderGetUserToProcessV2] Sending GET request to ${apiUrl}`);
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
			Logger.info(`[SmsReminderGetUserToProcessV2] Request completed in ${duration}ms`);
			Logger.debug(`[SmsReminderGetUserToProcessV2] Response received: ${JSON.stringify(response)}`);

			const parsedResponse = JSON.parse(response);

			if (parsedResponse && Array.isArray(parsedResponse.users)) {
				const userCount = parsedResponse.users.length;
				Logger.info(`[SmsReminderGetUserToProcessV2] Found ${userCount} user-schedule entries to process`);

				const now = new Date(Date.now());
				const processDate = now.toISOString();
				// Round down to the current whole hour (e.g. 13:32 → 13:00)
				const roundedNow = new Date(now);
				roundedNow.setMinutes(0, 0, 0);
				const processRoundedToHourDate = roundedNow.toISOString();

				// Each item is a (userId, calendarId, reminderDelayHours) tuple.
				// A user with 2 active delays appears twice — n8n iterates linearly.
				const userItems: INodeExecutionData[] = parsedResponse.users.map(
					(entry: { userId: string; calendarId: string; reminderDelayHours: number }) => {
						// Compute the appointment window this reminder should target:
						//   begin = roundedNow + reminderDelayHours
						//   end   = begin + 1 hour − 1 minute (to avoid overlap with next window)
						const beginDate = new Date(roundedNow.getTime() + entry.reminderDelayHours * 60 * 60 * 1000);
						const endDate = new Date(beginDate.getTime() + 59 * 60 * 1000); // +59 min

						return {
							json: {
								userId: entry.userId,
								calendarId: entry.calendarId,
								reminderDelayHours: entry.reminderDelayHours,
								processDate,
								processRoundedToHourDate,
								appointmentWindowStart: beginDate.toISOString(),
								appointmentWindowEnd: endDate.toISOString(),
							},
						};
					},
				);

				Logger.info(`[SmsReminderGetUserToProcessV2] Successfully created ${userItems.length} items`);
				return [userItems];
			} else {
				Logger.error(`[SmsReminderGetUserToProcessV2] Invalid response format: "users" array not found`);
				Logger.error(`[SmsReminderGetUserToProcessV2] Response received: ${JSON.stringify(response)}`);
				throw new NodeOperationError(
					this.getNode(),
					'Invalid response format: "users" array not found.',
				);
			}
		} catch (error) {
			Logger.error(`[SmsReminderGetUserToProcessV2] Failed to retrieve users to process`);
			Logger.error(`[SmsReminderGetUserToProcessV2] URL: ${apiUrl}`);
			Logger.error(`[SmsReminderGetUserToProcessV2] Error: ${error.message}`);
			if (error.response) {
				Logger.error(`[SmsReminderGetUserToProcessV2] Response status: ${error.response.status}`);
				Logger.error(`[SmsReminderGetUserToProcessV2] Response data: ${JSON.stringify(error.response.data)}`);
			}

			if (this.continueOnFail()) {
				Logger.warn(`[SmsReminderGetUserToProcessV2] Continuing on fail, returning error in item`);
				items.push({ json: this.getInputData(0)[0].json, error, pairedItem: 0 });
			} else {
				if (error.context) {
					error.context.itemIndex = 0;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error, {
					itemIndex: 0,
				});
			}
		}
		return [items];
	}
}
