import { MailerOptions } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

// Email is on once an SMTP host, a From address and credentials are all
// configured — so prefilled settings without the secret can't switch on
// email-verification enforcement while every send fails. SMTP_NO_AUTH=true
// skips the credential check (local catchers like Mailpit). Any SMTP provider
// works; production uses Mailjet (in-v3.mailjet.com:587, user = API key,
// pass = secret key). Until then a JSON transport is wired but never used:
// MailService.isConfigured() short-circuits every send.
export const smtpConfigured = () =>
  !!process.env.SMTP_HOST &&
  !!process.env.MAIL_FROM &&
  ((!!process.env.SMTP_USER && !!process.env.SMTP_PASS) ||
    process.env.SMTP_NO_AUTH === 'true');

export const mailerOptions = (): MailerOptions => {
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    transport: smtpConfigured()
      ? {
          host: process.env.SMTP_HOST,
          port,
          // 465 = implicit TLS; 587/25 upgrade via STARTTLS.
          secure: process.env.SMTP_SECURE
            ? process.env.SMTP_SECURE === 'true'
            : port === 465,
          requireTLS: port === 587,
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        }
      : { jsonTransport: true },
    defaults: {
      from: process.env.MAIL_FROM,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
    },
    template: {
      // Copied next to the compiled file by nest-cli.json "assets".
      dir: join(__dirname, 'mail-templates'),
      adapter: new HandlebarsAdapter(),
      options: { strict: true },
    },
  };
};
