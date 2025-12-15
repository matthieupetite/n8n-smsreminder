import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PixabayApi implements ICredentialType {
	name = 'pixabayApi';
	displayName = 'Pixabay API';

	documentationUrl = 'https://pixabay.com/api/docs/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			typeOptions: {
				password: true,
			},
		},
	];

	// This allows the credential to be used by other parts of n8n
	// stating how this credential is injected as part of the request
	// An example is the Http Request node that can make generic calls
	// reusing this credential
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				key: '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://pixabay.com',
			url: '/api',
			qs: {
				key: '={{$credentials.apiKey}}',
				q: 'yellow+flowers',
				image_type: 'photo',
			},
		},
	};
}
