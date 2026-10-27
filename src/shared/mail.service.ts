import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { smtpConfigured } from './mail.config';

export const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

export const frontendUrl = () =>
  process.env.FRONTEND_URL || 'http://localhost:3000';

export interface EmailContent {
  subject: string;
  heading: string;
  // Already-escaped HTML paragraphs (build them with escapeHtml on user data).
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

// Plain-text alternative (better deliverability, readable in any client).
const toText = ({ heading, paragraphs, cta, footnote }: EmailContent) =>
  [
    heading,
    '',
    ...paragraphs.map((p) =>
      p
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    ),
    ...(cta ? ['', `${cta.label}: ${cta.url}`] : []),
    ...(footnote ? ['', footnote] : []),
    '',
    'Udomi me - https://udomi-me.com',
  ].join('\n');

// The only place that sends email (via @nestjs-modules/mailer + SMTP).
// No-op until SMTP is configured, and never throws — callers don't handle
// delivery errors.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailer: MailerService) {}

  isConfigured() {
    return smtpConfigured();
  }

  async send(
    to: { email: string; name: string },
    content: EmailContent,
    lang: 'hr' | 'en' = 'hr',
  ): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      await this.mailer.sendMail({
        to: { name: to.name, address: to.email },
        subject: content.subject,
        template: 'email',
        context: { ...content, lang },
        text: toText(content),
      });
    } catch (e) {
      this.logger.error(
        `Email to ${to.email} failed: ${(e as Error)?.message ?? e}`,
      );
    }
  }
}
