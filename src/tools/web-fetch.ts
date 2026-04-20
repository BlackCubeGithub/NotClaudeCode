import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';
import * as https from 'https';

export class WebFetchTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'WebFetch',
    description:
      'Fetches the content of a URL and converts HTML to markdown for analysis.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch content from.',
        },
      },
      required: ['url'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      this.validateRequiredParams(params, ['url']);

      const url = params.url as string;

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return this.error('Invalid URL. Must start with http:// or https://');
      }

      const content = await this.fetchUrl(url);
      const markdown = this.htmlToMarkdown(content);

      const truncated = markdown.length > 5000 ? markdown.substring(0, 5000) + '\n\n... (content truncated)' : markdown;

      return this.success(truncated);
    } catch (error) {
      return this.error(
        `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location;
            if (location) {
              this.fetchUrl(location).then(resolve).catch(reject);
              return;
            }
          }

          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  private htmlToMarkdown(html: string): string {
    let content = html;

    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    content = content.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentDivMatch = content.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (articleMatch) {
      content = articleMatch[1];
    } else if (mainMatch) {
      content = mainMatch[1];
    } else if (contentDivMatch) {
      content = contentDivMatch[1];
    }

    content = content.replace(/<h1[^>]*>([^<]+)<\/h1>/gi, '\n# $1\n\n');
    content = content.replace(/<h2[^>]*>([^<]+)<\/h2>/gi, '\n## $1\n\n');
    content = content.replace(/<h3[^>]*>([^<]+)<\/h3>/gi, '\n### $1\n\n');
    content = content.replace(/<h4[^>]*>([^<]+)<\/h4>/gi, '\n#### $1\n\n');
    content = content.replace(/<h5[^>]*>([^<]+)<\/h5>/gi, '\n##### $1\n\n');
    content = content.replace(/<h6[^>]*>([^<]+)<\/h6>/gi, '\n###### $1\n\n');

    content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n\n');
    content = content.replace(/<br\s*\/?>/gi, '\n');
    content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    content = content.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n$1\n');
    content = content.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n$1\n');

    content = content.replace(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)');
    content = content.replace(/<strong[^>]*>([^<]+)<\/strong>/gi, '**$1**');
    content = content.replace(/<b[^>]*>([^<]+)<\/b>/gi, '**$1**');
    content = content.replace(/<em[^>]*>([^<]+)<\/em>/gi, '*$1*');
    content = content.replace(/<i[^>]*>([^<]+)<\/i>/gi, '*$1*');
    content = content.replace(/<code[^>]*>([^<]+)<\/code>/gi, '`$1`');

    content = content.replace(/<[^>]+>/g, '');

    content = content.replace(/&nbsp;/g, ' ');
    content = content.replace(/&amp;/g, '&');
    content = content.replace(/&lt;/g, '<');
    content = content.replace(/&gt;/g, '>');
    content = content.replace(/&quot;/g, '"');
    content = content.replace(/&#39;/g, "'");

    content = content.replace(/\n{3,}/g, '\n\n');
    content = content.replace(/[ \t]+/g, ' ');
    content = content.trim();

    if (title) {
      content = `# ${title}\n\n${content}`;
    }

    return content;
  }
}
