import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SmsReminderApi implements ICredentialType {
	name = 'smsReminderApi';
	displayName = 'SMS Reminder API';

	documentationUrl = 'https://matthieupetite.github.io/n8n-smsreminder/';

	properties: INodeProperties[] = [
		// The credentials to get from user and save encrypted.
		// Properties can be defined exactly in the same way
		// as node properties.
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			default: 'BOlA`Itn[YeQ[1VH^E0Q3t86K?$<YE]A}Dpk|$uo|br*\'Cu+TPvqx^`V`Tl75V',
			typeOptions: {
				password: true,
			}
		},
		{
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: 'https://admin.codeers.net',
		},
	];

	// This allows the credential to be used by other parts of n8n
	// stating how this credential is injected as part of the request
	// An example is the Http Request node that can make generic calls
	// reusing this credential
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				WorkerSecret: '={{$credentials.token}}',
			},
		},
	};

	// The block below tells how this credential can be tested
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials?.domain}}',
			url: '/api/worker/status',
		},
	};
}
