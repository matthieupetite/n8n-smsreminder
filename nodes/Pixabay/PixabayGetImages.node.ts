import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	LoggerProxy as Logger
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class PixabayGetImages		 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pixabay: Get Images',
		name: 'pixabayGetImages',
		group: ['output','input','transform'],
		icon: 'file:Pixabay.svg',
		version: 1,
		description: 'Pixabay Get Images Node for n8n',
		defaults: {
			name: 'Pixabay Get Images',
		},
		inputs: ['main'],
		outputs: ['main'],

		credentials: [
			{
				name: 'pixabayApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['token'],
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
						name: 'Token',
						value: 'token',
					}
				],
				default: 'token',
			},
			{
				displayName: 'Search Query',
				name: 'q',
				type: 'string',
				default: '',
				placeholder: 'yellow+flower',
				description: 'A URL encoded search term. If omitted, all images are returned. Max 100 characters.',
			},
			{
				displayName: 'Language',
				name: 'lang',
				type: 'options',
				options: [
					{ name: 'Bulgarian', value: 'bg' },
					{ name: 'Chinese', value: 'zh' },
					{ name: 'Czech', value: 'cs' },
					{ name: 'Danish', value: 'da' },
					{ name: 'Dutch', value: 'nl' },
					{ name: 'English', value: 'en' },
					{ name: 'Finnish', value: 'fi' },
					{ name: 'French', value: 'fr' },
					{ name: 'German', value: 'de' },
					{ name: 'Greek', value: 'el' },
					{ name: 'Hungarian', value: 'hu' },
					{ name: 'Indonesian', value: 'id' },
					{ name: 'Italian', value: 'it' },
					{ name: 'Japanese', value: 'ja' },
					{ name: 'Korean', value: 'ko' },
					{ name: 'Norwegian', value: 'no' },
					{ name: 'Polish', value: 'pl' },
					{ name: 'Portuguese', value: 'pt' },
					{ name: 'Romanian', value: 'ro' },
					{ name: 'Russian', value: 'ru' },
					{ name: 'Slovak', value: 'sk' },
					{ name: 'Spanish', value: 'es' },
					{ name: 'Swedish', value: 'sv' },
					{ name: 'Thai', value: 'th' },
					{ name: 'Turkish', value: 'tr' },
					{ name: 'Vietnamese', value: 'vi' },
				],
				default: 'en',
				description: 'Language code of the language to be searched in',
			},
			{
				displayName: 'Image ID',
				name: 'id',
				type: 'string',
				default: '',
				description: 'Retrieve individual images by ID',
			},
			{
				displayName: 'Image Type',
				name: 'image_type',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Photo', value: 'photo' },
					{ name: 'Illustration', value: 'illustration' },
					{ name: 'Vector', value: 'vector' },
				],
				default: 'all',
				description: 'Filter results by image type',
			},
			{
				displayName: 'Orientation',
				name: 'orientation',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Horizontal', value: 'horizontal' },
					{ name: 'Vertical', value: 'vertical' },
				],
				default: 'all',
				description: 'Whether an image is wider than it is tall, or taller than it is wide',
			},
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				options: [
					{ name: 'Animals', value: 'animals' },
					{ name: 'Backgrounds', value: 'backgrounds' },
					{ name: 'Buildings', value: 'buildings' },
					{ name: 'Business', value: 'business' },
					{ name: 'Computer', value: 'computer' },
					{ name: 'Education', value: 'education' },
					{ name: 'Fashion', value: 'fashion' },
					{ name: 'Feelings', value: 'feelings' },
					{ name: 'Food', value: 'food' },
					{ name: 'Health', value: 'health' },
					{ name: 'Industry', value: 'industry' },
					{ name: 'Music', value: 'music' },
					{ name: 'Nature', value: 'nature' },
					{ name: 'People', value: 'people' },
					{ name: 'Places', value: 'places' },
					{ name: 'Religion', value: 'religion' },
					{ name: 'Science', value: 'science' },
					{ name: 'Sports', value: 'sports' },
					{ name: 'Transportation', value: 'transportation' },
					{ name: 'Travel', value: 'travel' },
				],
				default: 'nature',
				description: 'Filter results by category',
			},
			{
				displayName: 'Minimum Width',
				name: 'min_width',
				type: 'number',
				default: 0,
				description: 'Minimum image width',
			},
			{
				displayName: 'Minimum Height',
				name: 'min_height',
				type: 'number',
				default: 0,
				description: 'Minimum image height',
			},
			{
				displayName: 'Colors',
				name: 'colors',
				type: 'multiOptions',
				options: [
					{ name: 'Black', value: 'black' },
					{ name: 'Blue', value: 'blue' },
					{ name: 'Brown', value: 'brown' },
					{ name: 'Gray', value: 'gray' },
					{ name: 'Grayscale', value: 'grayscale' },
					{ name: 'Green', value: 'green' },
					{ name: 'Lilac', value: 'lilac' },
					{ name: 'Orange', value: 'orange' },
					{ name: 'Pink', value: 'pink' },
					{ name: 'Red', value: 'red' },
					{ name: 'Transparent', value: 'transparent' },
					{ name: 'Turquoise', value: 'turquoise' },
					{ name: 'White', value: 'white' },
					{ name: 'Yellow', value: 'yellow' },
				],
				default: [],
				description: 'Filter images by color properties',
			},
			{
				displayName: 'Editors Choice',
				name: 'editors_choice',
				type: 'boolean',
				default: false,
				description: 'Whether to select images that have received an Editor\'s Choice award',
			},
			{
				displayName: 'Safe Search',
				name: 'safesearch',
				type: 'boolean',
				default: false,
				description: 'Whether only images suitable for all ages should be returned',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Popular', value: 'popular' },
					{ name: 'Latest', value: 'latest' },
				],
				default: 'popular',
				description: 'How the results should be ordered',
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				description: 'Page number for paginated results',
			},
			{
				displayName: 'Per Page',
				name: 'per_page',
				type: 'number',
				typeOptions: {
					minValue: 3,
					maxValue: 200,
				},
				default: 20,
				description: 'Number of results per page (3-200)',
			},
			{
				displayName: 'JSONP Callback',
				name: 'callback',
				type: 'string',
				default: '',
				description: 'JSONP callback function name',
			},
			{
				displayName: 'Pretty Print',
				name: 'pretty',
				type: 'boolean',
				default: false,
				description: 'Whether to indent JSON output (should not be used in production)',
			},
		],
	};

	// The execute method will go here
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('pixabayApi');
		const returnData: INodeExecutionData[] = [];

		Logger.info(`[Pixabay] Starting execution with ${items.length} input items`);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// Build query parameters
				const qs: { [key: string]: string | number | boolean } = {
					key: credentials.apiKey as string,
				};

				// Get all parameters
				const q = this.getNodeParameter('q', itemIndex, '') as string;
				const lang = this.getNodeParameter('lang', itemIndex, 'en') as string;
				const id = this.getNodeParameter('id', itemIndex, '') as string;
				const imageType = this.getNodeParameter('image_type', itemIndex, 'all') as string;
				const orientation = this.getNodeParameter('orientation', itemIndex, 'all') as string;
				const category = this.getNodeParameter('category', itemIndex, '') as string;
				const minWidth = this.getNodeParameter('min_width', itemIndex, 0) as number;
				const minHeight = this.getNodeParameter('min_height', itemIndex, 0) as number;
				const colors = this.getNodeParameter('colors', itemIndex, []) as string[];
				const editorsChoice = this.getNodeParameter('editors_choice', itemIndex, false) as boolean;
				const safesearch = this.getNodeParameter('safesearch', itemIndex, false) as boolean;
				const order = this.getNodeParameter('order', itemIndex, 'popular') as string;
				const page = this.getNodeParameter('page', itemIndex, 1) as number;
				const perPage = this.getNodeParameter('per_page', itemIndex, 20) as number;
				const callback = this.getNodeParameter('callback', itemIndex, '') as string;
				const pretty = this.getNodeParameter('pretty', itemIndex, false) as boolean;

				// Add parameters to query string if they have values
				if (q) qs.q = q;
				if (lang !== 'en') qs.lang = lang;
				if (id) qs.id = id;
				if (imageType !== 'all') qs.image_type = imageType;
				if (orientation !== 'all') qs.orientation = orientation;
				if (category) qs.category = category;
				if (minWidth > 0) qs.min_width = minWidth;
				if (minHeight > 0) qs.min_height = minHeight;
				if (colors.length > 0) qs.colors = colors.join(',');
				if (editorsChoice) qs.editors_choice = 'true';
				if (safesearch) qs.safesearch = 'true';
				if (order !== 'popular') qs.order = order;
				if (page !== 1) qs.page = page;
				if (perPage !== 20) qs.per_page = perPage;
				if (callback) qs.callback = callback;
				if (pretty) qs.pretty = 'true';

				Logger.info(`[Pixabay] Processing item ${itemIndex + 1}/${items.length}`);
				Logger.debug(`[Pixabay] Query parameters: ${JSON.stringify(qs)}`);

				const startTime = Date.now();

				// Make API request
				const response = await this.helpers.request({
					method: 'GET',
					uri: 'https://pixabay.com/api/',
					qs,
					json: true,
				});

				const duration = Date.now() - startTime;
				Logger.info(`[Pixabay] API request completed in ${duration}ms`);
				Logger.info(`[Pixabay] Found ${response.totalHits} total hits, returning ${response.hits?.length || 0} images`);

				// Add each image as a separate output item
				if (response.hits && Array.isArray(response.hits)) {
					for (const hit of response.hits) {
						returnData.push({
							json: {
								...items[itemIndex].json,
								...hit,
								_meta: {
									total: response.total,
									totalHits: response.totalHits,
									page: page,
									perPage: perPage,
								},
							},
							pairedItem: itemIndex,
						});
					}
				} else {
					// If no hits, return the response as-is
					returnData.push({
						json: {
							...items[itemIndex].json,
							response,
						},
						pairedItem: itemIndex,
					});
				}

				Logger.info(`[Pixabay] Item ${itemIndex + 1} processed successfully`);

			} catch (error) {
				Logger.error(`[Pixabay] Error processing item ${itemIndex + 1}`);
				Logger.error(`[Pixabay] Error details: ${error.message}`);
				if (error.statusCode) {
					Logger.error(`[Pixabay] Status code: ${error.statusCode}`);
				}
				if (error.response) {
					Logger.error(`[Pixabay] Response: ${JSON.stringify(error.response)}`);
				}

				if (this.continueOnFail()) {
					Logger.warn(`[Pixabay] Continuing on fail, adding error to return data`);
					returnData.push({
						json: {
							...items[itemIndex].json,
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

		Logger.info(`[Pixabay] Execution completed, returning ${returnData.length} items`);
		return [returnData];
	}
}
