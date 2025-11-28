import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class SmsReminderGetUserToProcess implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get User to Process',
		name: 'smsReminderGetUserToProcess',
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
		],
	};

	// The execute method will go here
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('smsReminderApi');
		const apiUrl = `${credentials.domain}/api/user/userstoprocess`;

		Logger.info(`[SmsReminderGetUserToProcess] Starting execution`);
		Logger.info(`[SmsReminderGetUserToProcess] API URL: ${apiUrl}`);
		Logger.debug(`[SmsReminderGetUserToProcess] Credentials domain: ${credentials.domain}`);

		try {
				Logger.info(`[SmsReminderGetUserToProcess] Sending GET request to ${apiUrl}`);
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
				Logger.info(`[SmsReminderGetUserToProcess] Request completed in ${duration}ms`);
				Logger.debug(`[SmsReminderGetUserToProcess] Response received: ${JSON.stringify(response)}`);
					// Vérifier que la réponse contient un tableau "users"
				if (response && Array.isArray(JSON.parse(response).users)) {
						const parsedResponse = JSON.parse(response);
						const userCount = parsedResponse.users.length;
						Logger.info(`[SmsReminderGetUserToProcess] Found ${userCount} users to process`);

						// Créer une liste d'items à partir des "users"
						const userItems = parsedResponse.users.map((userId: string) => ({
								json: {
									userId: userId,
									processDate: new Date(Date.now()).toISOString(), // Ajout de la date de traitement
									processRoundedToHourDate: new Date(Date.now()).toISOString().split('T')[0] + 'T' + new Date(Date.now()).toISOString().split('T')[1].split(':')[0] + ':00:00.000Z', // Arrondi à l'heure
								} // Chaque item contient un champ "userId"
						}));

						Logger.info(`[SmsReminderGetUserToProcess] Successfully created ${userItems.length} items`);
						// Retourner la liste d'items
						return [userItems];

				} else {
						Logger.error(`[SmsReminderGetUserToProcess] Invalid response format: "users" array not found`);
						Logger.error(`[SmsReminderGetUserToProcess] Response received: ${JSON.stringify(response)}`);
						throw new NodeOperationError(this.getNode(), 'Invalid response format: "users" array not found.');
				}

		} catch (error) {
				Logger.error(`[SmsReminderGetUserToProcess] Failed to retrieve users to process`);
				Logger.error(`[SmsReminderGetUserToProcess] URL: ${apiUrl}`);
				Logger.error(`[SmsReminderGetUserToProcess] Error: ${error.message}`);
				if (error.response) {
					Logger.error(`[SmsReminderGetUserToProcess] Response status: ${error.response.status}`);
					Logger.error(`[SmsReminderGetUserToProcess] Response data: ${JSON.stringify(error.response.data)}`);
				}

				if (this.continueOnFail()) {
					Logger.warn(`[SmsReminderGetUserToProcess] Continuing on fail, returning error in item`);
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
