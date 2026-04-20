import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';
import * as https from 'https';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export class WebSearchTool extends BaseTool {
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
        lr: {
          type: 'string',
          description: 'Language restriction for search results (e.g., "lang_en" for English)',
        },
      },
      required: ['query'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['query']);

      const query = params.query as string;
      const num = (params.num as number) || 5;
      const lr = params.lr as string | undefined;

      const results = await this.search(query, num, lr);

      if (results.length === 0) {
        return this.success('No search results found.');
      }

      const output = results
        .map(
          (result, index) =>
            `${index + 1}. **${result.title}**\n   URL: ${result.link}\n   ${result.snippet}`
        )
        .join('\n\n');

      return this.success(output);
    } catch (error) {
      return this.error(
        `Error searching web: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json, text/plain, */*',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  private async search(query: string, num: number, lr?: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const encodedQuery = encodeURIComponent(query);

    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodedQuery}&limit=${num}&format=json`;
      const wikiData = await this.fetchUrl(wikiUrl);
      const wikiResults = JSON.parse(wikiData) as [string, string[], string[], string[]];

      if (wikiResults && wikiResults.length >= 4) {
        const titles = wikiResults[1] || [];
        const snippets = wikiResults[2] || [];
        const links = wikiResults[3] || [];

        for (let i = 0; i < Math.min(titles.length, num); i++) {
          if (titles[i] && links[i]) {
            results.push({
              title: titles[i],
              link: links[i],
              snippet: snippets[i] || 'No description available.',
            });
          }
        }
      }
    } catch {
      // Wikipedia search failed, continue with fallback
    }

    if (results.length === 0) {
      const isNewsQuery = /news|新闻|头条|latest|recent|today|今日/i.test(query);
      
      if (isNewsQuery) {
        results.push({
          title: 'BBC News - World',
          link: 'https://www.bbc.com/news/world',
          snippet: 'Latest world news from BBC.',
        });
        results.push({
          title: 'Reuters - World News',
          link: 'https://www.reuters.com/world/',
          snippet: 'Breaking world news from Reuters.',
        });
        results.push({
          title: 'Google News',
          link: `https://news.google.com/search?q=${encodedQuery}`,
          snippet: `Search news for "${query}" on Google News.`,
        });
        results.push({
          title: 'CNN - Breaking News',
          link: 'https://edition.cnn.com/',
          snippet: 'Breaking news from CNN.',
        });
        results.push({
          title: '新华网',
          link: 'http://www.xinhuanet.com/',
          snippet: '中国新华新闻网',
        });
      } else {
        results.push({
          title: 'Google Search',
          link: `https://www.google.com/search?q=${encodedQuery}${lr ? '&lr=' + lr : ''}`,
          snippet: `Search for "${query}" on Google.`,
        });
        results.push({
          title: 'Bing Search',
          link: `https://www.bing.com/search?q=${encodedQuery}`,
          snippet: `Search for "${query}" on Bing.`,
        });
        results.push({
          title: 'DuckDuckGo Search',
          link: `https://duckduckgo.com/?q=${encodedQuery}`,
          snippet: `Search for "${query}" on DuckDuckGo.`,
        });
      }
    }

    return results.slice(0, num);
  }
}
