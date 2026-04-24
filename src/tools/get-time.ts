import { BaseTool } from './base';
import { ToolDefinition, ToolResult } from '../types';

export class GetTimeTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'GetTime',
    description:
      'Get the current date and time. Use this tool when you need to know the current date or time, especially for time-sensitive queries.',
    parameters: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'Optional timezone (e.g., "Asia/Shanghai", "America/New_York"). Defaults to local timezone.',
        },
        format: {
          type: 'string',
          enum: ['iso', 'locale', 'date', 'time', 'full'],
          description: 'Output format: iso (ISO 8601), locale (local format), date (date only), time (time only), full (full info). Default is full.',
        },
      },
      required: [],
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const now = new Date();
      const format = (params.format as string) || 'full';
      const timezone = params.timezone as string | undefined;

      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekday = weekdays[now.getDay()];

      let result: string;

      switch (format) {
        case 'iso':
          result = now.toISOString();
          break;

        case 'locale':
          result = now.toLocaleString();
          break;

        case 'date':
          result = `${year}-${month}-${day}`;
          break;

        case 'time':
          result = `${hours}:${minutes}:${seconds}`;
          break;

        case 'full':
        default: {
          const lines: string[] = [];
          lines.push(`📅 Date: ${year}-${month}-${day}`);
          lines.push(`🕐 Time: ${hours}:${minutes}:${seconds}`);
          lines.push(`📆 Day: ${weekday}`);
          lines.push(`🌍 Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
          lines.push(`📝 ISO: ${now.toISOString()}`);
          
          if (timezone) {
            try {
              const tzDate = now.toLocaleString('en-US', { timeZone: timezone });
              lines.push(`📍 ${timezone}: ${tzDate}`);
            } catch {
              lines.push(`⚠️ Invalid timezone: ${timezone}`);
            }
          }
          
          result = lines.join('\n');
          break;
        }
      }

      return this.success(result);
    } catch (error) {
      return this.error(
        `Error getting time: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
