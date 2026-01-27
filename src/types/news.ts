export interface NewsItem {
  title: string;
  link: string;
  pubDate: Date;
  contentSnippet?: string;
  source: string;
}

export interface RSSFeed {
  url: string;
  name: string;
}

export interface TelegramMessage {
  text: string;
  parse_mode: 'Markdown' | 'HTML';
}
