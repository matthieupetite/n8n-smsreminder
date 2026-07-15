import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class PennylaneApi implements ICredentialType {
  name: string = 'pennylaneApi';
  displayName: string = 'Pennylane API';
  properties: INodeProperties[] = [
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      default: '',
      required: true,
    },
    {
      displayName: 'Company ID',
      name: 'companyId',
      type: 'string',
      default: '',
      required: false,
    },
  ];
}
