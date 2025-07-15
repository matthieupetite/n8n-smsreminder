import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class SmsReminderGetUserToProcess implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SMSReminder: Get User to Process',
		name: 'smsReminderGetUserToProcess',
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
		],
	};

	// The execute method will go here
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('smsReminderApi');
		Logger.info(`Executing get User to process with credentials: ${JSON.stringify(credentials)}`);
		Logger.info(`Using SMS Reminder API URL: ${credentials.domain}/api/user/userstoprocess`);
		const apiUrl = `${credentials.domain}/api/user/userstoprocess`;
		try {
				const response = await this.helpers.request({
						method: 'GET',
						url: apiUrl,
						headers: {
								'WorkerSecret': `${credentials.token}`,
								'Content-Type': 'application/json',
						},
				});

				Logger.debug(`Response from ${apiUrl}: ${JSON.stringify(response)}`);
					// Vérifier que la réponse contient un tableau "users"
				if (response && Array.isArray(JSON.parse(response).users)) {
						// Créer une liste d'items à partir des "users"
						const userItems = JSON.parse(response).users.map((userId: string) => ({
								json: {
									userId: userId,
									processDate: new Date(Date.now()).toISOString(), // Ajout de la date de traitement
									processRoundedToHourDate: new Date(Date.now()).toISOString().split('T')[0] + 'T' + new Date(Date.now()).toISOString().split('T')[1].split(':')[0] + ':00:00.000Z', // Arrondi à l'heure
								} // Chaque item contient un champ "userId"
						}));

						// Retourner la liste d'items
						return [userItems];

				} else {
						throw new NodeOperationError(this.getNode(), 'Invalid response format: "users" array not found.');
				}

		} catch (error) {
				Logger.error(`Failed to retrieve user to process. URL: ${apiUrl}, Error: ${error.response?.data || error.message}`);
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
