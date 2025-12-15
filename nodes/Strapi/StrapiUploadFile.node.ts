import {
	ICredentialDataDecryptedObject,
	ICredentialsDecrypted,
	ICredentialTestFunctions,
    IDataObject,
    IExecuteFunctions,
    INodeCredentialTestResult,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    IRequestOptions,
    LoggerProxy as Logger,
    NodeConnectionTypes,
    NodeOperationError
} from 'n8n-workflow';
import { getToken } from './GenericFunctions';
import { removeTrailingSlash } from '../utilities/utilities';

export class StrapiUploadFile implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Strapi: Upload File',
        name: 'strapiUploadFile',
        group: ['output', 'input', 'transform'],
        icon: 'file:Strapi.svg', // You may want to create a Strapi.svg icon
        version: 1,
        description: 'Download file from URL and upload to Strapi',
        defaults: {
            name: 'Strapi Upload File',
        },
				usableAsTool: true,
        inputs: [NodeConnectionTypes.Main],
				outputs: [NodeConnectionTypes.Main],
        credentials: [
					{
						name: 'strapiApi',
						required: true,
						testedBy: 'strapiApiTest',
						displayOptions: {
							show: {
								authentication: ['password'],
							},
						},
					},
					{
						name: 'strapiTokenApi',
						required: true,
						displayOptions: {
							show: {
								authentication: ['Token','token'],
							},
						},
					},
				],
        properties: [
						{
							displayName: 'Authentication',
							name: 'authentication',
							type: 'options',
							options: [
								{
									name: 'Username & Password',
									value: 'password',
								},
								{
									name: 'API Token',
									value: 'token',
								},
							],
							default: 'password',
						},
            {
                displayName: 'File URL',
                name: 'fileUrl',
                type: 'string',
                default: '',
                required: true,
                description: 'The URL of the file to download and upload to Strapi',
            },
            {
                displayName: 'File Name',
                name: 'fileName',
                type: 'string',
                default: '',
                description: 'Optional: Specify a custom file name. If not provided, it will be extracted from the URL.',
            },
            {
                displayName: 'Reference ID',
                name: 'refId',
                type: 'string',
                default: '',
                description: 'Optional: The ID of the entry to which the file should be related',
            },
            {
                displayName: 'Reference',
                name: 'ref',
                type: 'string',
                default: '',
                description: 'Optional: The content type name (e.g., "api::article.article")',
            },
            {
                displayName: 'Field',
                name: 'field',
                type: 'string',
                default: '',
                description: 'Optional: The field name in the content type',
            },
        ],

    };

		methods = {
			credentialTest: {
				async strapiApiTest(
					this: ICredentialTestFunctions,
					credential: ICredentialsDecrypted,
				): Promise<INodeCredentialTestResult> {
					const credentials = credential.data as IDataObject;
					let options: IRequestOptions = {};

					const url = removeTrailingSlash(credentials.url as string);

					options = {
						headers: {
							'content-type': 'application/json',
						},
						method: 'POST',
						body: {
							identifier: credentials.email,
							password: credentials.password,
						},
						uri: credentials.apiVersion === 'v4' ? `${url}/api/auth/local` : `${url}/auth/local`,
						json: true,
					};

					try {
						await this.helpers.request(options);
						return {
							status: 'OK',
							message: 'Authentication successful',
						};
					} catch (error) {
						return {
							status: 'Error',
							message: `Auth settings are not valid: ${error}`,
						};
					}
				},
			},
		};

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
				const headers: IDataObject = {};
				const authenticationMethod = this.getNodeParameter('authentication', 0);

				let credentials: ICredentialDataDecryptedObject;

				if (authenticationMethod === 'password') {
					credentials = await this.getCredentials('strapiApi');
					const { jwt } = await getToken.call(this);
					headers.Authorization = `Bearer ${jwt}`;
				} else {
					credentials = await this.getCredentials('strapiTokenApi');
					Logger.debug(`[StrapiUploadFile] Using API Token authentication`);
					Logger.debug(`[StrapiUploadFile] Token present: ${!!credentials.apiToken}`);
					headers.Authorization = `Bearer ${credentials.apiToken}`;
				}
				this.logger.info(JSON.stringify(headers));

        Logger.info(`[StrapiUploadFile] Starting execution with ${items.length} input items`);
        Logger.debug(`[StrapiUploadFile] Credentials url: ${credentials.url}`);
				Logger.debug(`[StrapiUploadFile] Using authentication method: ${authenticationMethod}`);
				Logger.debug(`[StrapiUploadFile] Authorization header set: ${!!headers.Authorization}`);
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const fileUrl = this.getNodeParameter('fileUrl', itemIndex) as string;
                const customFileNameRaw = this.getNodeParameter('fileName', itemIndex, '') as string | number;
                const refId = this.getNodeParameter('refId', itemIndex, '') as string;
                const ref = this.getNodeParameter('ref', itemIndex, '') as string;
                const field = this.getNodeParameter('field', itemIndex, '') as string;

                // Convert customFileName to string and trim
                const customFileName = customFileNameRaw ? String(customFileNameRaw).trim() : '';

                Logger.info(`[StrapiUploadFile] Processing item ${itemIndex + 1}/${items.length}`);
                Logger.info(`[StrapiUploadFile] File URL: ${fileUrl}`);
                Logger.info(`[StrapiUploadFile] Custom file name: ${customFileName || 'auto-detect'}`);

                // Step 1: Download the file from the URL
                Logger.info(`[StrapiUploadFile] Downloading file from ${fileUrl}`);
                const downloadStartTime = Date.now();

                const fileBuffer = await this.helpers.request({
                    method: 'GET',
                    url: fileUrl,
                    encoding: null, // Important: tells request to return a Buffer
                    json: false,
                });

                const downloadDuration = Date.now() - downloadStartTime;
                Logger.info(`[StrapiUploadFile] File downloaded in ${downloadDuration}ms, size: ${fileBuffer.length} bytes`);

                // Extract filename from URL if not provided
                let fileName = customFileName;
                if (!fileName) {
                    const urlParts = fileUrl.split('/');
                    fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
                    if (!fileName) {
                        fileName = 'uploaded-file'; // Fallback if extraction fails
                    }
                    Logger.debug(`[StrapiUploadFile] Auto-detected filename: ${fileName}`);
                }

                if (fileName.indexOf('.') === -1) {
                    fileName += '.jpg'; // Default to .jpg if no extension
                    Logger.debug(`[StrapiUploadFile] Appended default extension to filename: ${fileName}`);
                }

                // Step 2: Upload the file to Strapi
                const uploadUrl = `${credentials.url}/api/upload`;
                Logger.info(`[StrapiUploadFile] Uploading file to Strapi: ${uploadUrl}`);


                const ext = fileName.split('.').pop() || 'jpg';
                const contentTypes: { [key: string]: string } = {
                    // Images
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                    'svg': 'image/svg+xml',
                    'bmp': 'image/bmp',
                    'ico': 'image/x-icon',
                    // Documents
                    'pdf': 'application/pdf',
                    'doc': 'application/msword',
                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'xls': 'application/vnd.ms-excel',
                    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'ppt': 'application/vnd.ms-powerpoint',
                    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    // Text
                    'txt': 'text/plain',
                    'csv': 'text/csv',
                    'json': 'application/json',
                    'xml': 'application/xml',
                    // Archives
                    'zip': 'application/zip',
                    'rar': 'application/x-rar-compressed',
                    '7z': 'application/x-7z-compressed',
                    // Audio
                    'mp3': 'audio/mpeg',
                    'wav': 'audio/wav',
                    'ogg': 'audio/ogg',
                    // Video
                    'mp4': 'video/mp4',
                    'avi': 'video/x-msvideo',
                    'mov': 'video/quicktime',
                    'wmv': 'video/x-ms-wmv',
                };

                // Build form data
                const formData: any = {
                    files: {
                        value: fileBuffer,
                        options: {
                            filename: fileName,
                            contentType: ext && contentTypes[ext] ? contentTypes[ext] : 'application/octet-stream',
                        },
                    },
                };

                // Add optional reference fields if provided
                if (refId) {
                    formData.refId = refId;
                    Logger.debug(`[StrapiUploadFile] Added refId: ${refId}`);
                }
                if (ref) {
                    formData.ref = ref;
                    Logger.debug(`[StrapiUploadFile] Added ref: ${ref}`);
                }
                if (field) {
                    formData.field = field;
                    Logger.debug(`[StrapiUploadFile] Added field: ${field}`);
                }

                const uploadStartTime = Date.now();

                Logger.info(`[StrapiUploadFile] Request headers: ${JSON.stringify(headers)}`);

                const response = await this.helpers.request({
                    method: 'POST',
                    url: uploadUrl,
                    headers: headers,
                    formData,
                    json: true,
                });

                const uploadDuration = Date.now() - uploadStartTime;
                Logger.info(`[StrapiUploadFile] Upload completed in ${uploadDuration}ms`);
                Logger.debug(`[StrapiUploadFile] Upload response: ${JSON.stringify(response)}`);

                // Return the Strapi upload response
                returnData.push({
                    json: {
                        ...items[itemIndex].json,
                        uploadedFile: response,
                        originalUrl: fileUrl,
                        fileName: fileName,
                        fileSize: fileBuffer.length,
                        uploadSuccess: true,
                    },
                    pairedItem: itemIndex,
                });

                Logger.info(`[StrapiUploadFile] Item ${itemIndex + 1} processed successfully`);

            } catch (error) {
                Logger.error(`[StrapiUploadFile] Error processing item ${itemIndex + 1}`);
                Logger.error(`[StrapiUploadFile] Error details: ${error.message}`);
                if (error.statusCode) {
                    Logger.error(`[StrapiUploadFile] Status code: ${error.statusCode}`);
                }
                if (error.response) {
                    Logger.error(`[StrapiUploadFile] Response: ${JSON.stringify(error.response)}`);
                }

                if (this.continueOnFail()) {
                    Logger.warn(`[StrapiUploadFile] Continuing on fail, adding error to return data`);
                    returnData.push({
                        json: {
                            ...items[itemIndex].json,
                            uploadSuccess: false,
                            error: error.message,
                            statusCode: error.statusCode,
                        },
                        pairedItem: itemIndex,
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

        Logger.info(`[StrapiUploadFile] Execution completed, returning ${returnData.length} total items`);
        return [returnData];
    }


}
