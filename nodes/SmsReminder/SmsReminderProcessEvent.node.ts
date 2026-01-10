import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class SmsReminderProcessEvent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Process Event',
		name: 'smsReminderProcessEvent',
		group: ['output','input','transform'],
		icon: 'file:SmsReminder.svg',
		version: 1,
		description: 'Process events for SMS Reminder',
		defaults: {
			name: 'SMS Reminder: Process Event',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'smsReminderApi',
				required: true,
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
					}
				],
				default: 'apiKey',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		Logger.info(`[SmsReminderProcessEvent] Starting execution with ${items.length} items`);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];
				Logger.debug(`[SmsReminderProcessEvent] Processing item ${itemIndex}: ${JSON.stringify(item.json)}`);

				// Pass through the item unchanged for now
				// You can add specific processing logic here as needed
				returnData.push({
					json: item.json,
					pairedItem: itemIndex,
				});

			} catch (error) {
				Logger.error(`[SmsReminderProcessEvent] Error processing item ${itemIndex}: ${error.message}`);

				if (this.continueOnFail()) {
					Logger.warn(`[SmsReminderProcessEvent] Continuing on fail, returning error in item`);
					returnData.push({
						json: { error: error.message },
						pairedItem: itemIndex
					});
				} else {
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		Logger.info(`[SmsReminderProcessEvent] Execution completed with ${returnData.length} items`);
		return [returnData];
	}
}
