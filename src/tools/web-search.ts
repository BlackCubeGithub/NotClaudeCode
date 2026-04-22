import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';
import { fetchJsonWithRetry } from '../utils/retry';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
  answer?: string;
}

export class WebSearchTool extends BaseTool {
  private apiKey: string | undefined;

  constructor() {
    super();
    this.apiKey = process.env.TAVILY_API_KEY;
  }

  definition: ToolDefinition = {
    name: 'WebSearch',
    description:
      'This tool can be used to search the internet, which should be used with caution, as frequent searches result in a bad user experience and excessive costs.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to execute.',
        },
        num: {
          type: 'number',
          description: 'Maximum number of search results to return. Default is 5.',
        },
      },
      required: ['query'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['query']);

      if (!this.apiKey) {
        return this.error(
          'TAVILY_API_KEY is not set. Please set it in your environment or .env file.'
        );
      }

      const query = params.query as string;
      const num = (params.num as number) || 5;

      const data = await fetchJsonWithRetry<TavilyResponse>(
        'https://api.tavily.com/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: Math.min(num, 10),
            include_answer: true,
            include_raw_content: false,
          }),
        },
        {
          maxRetries: 3,
          timeout: 30000,
        }
      );

      const lines: string[] = [];

      if (data.answer) {
        lines.push(`## Answer\n${data.answer}\n`);
      }

      if (data.results && data.results.length > 0) {
        lines.push('## Search Results\n');
        for (let i = 0; i < data.results.length; i++) {
          const result = data.results[i];
          lines.push(`### ${i + 1}. ${result.title}`);
          lines.push(`URL: ${result.url}`);
          lines.push(`\n${result.content}\n`);
        }
      }

      if (lines.length === 0) {
        return this.success('No results found.');
      }

      return this.success(lines.join('\n'));
    } catch (error) {
      return this.error(
        `Error searching web: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
