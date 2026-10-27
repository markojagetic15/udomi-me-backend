---
name: send-email
description: Add or modify a transactional email sent from the Udomi Me backend (e.g. verification, password reset, new notification). Use when asked to send a new email or change an email's content/trigger.
---

# Send a Transactional Email

All sending goes through `MailService` (`src/shared/mail.service.ts`), built on `@nestjs-modules/mailer` (SMTP via nodemailer, configured in `shared/mail.config.ts`). It renders the one branded handlebars layout `shared/mail-templates/email.hbs` plus a plain-text part, is a no-op until `SMTP_HOST`, `MAIL_FROM`, `SMTP_USER` and `SMTP_PASS` are set, and never throws. To test locally without a provider, run Mailpit (`axllent/mailpit`) on the Docker network and point `SMTP_HOST` at it (port 1025, `SMTP_NO_AUTH=true`).

1. Add the copy to `src/services/notification/email-copy.ts` — a function `(lang: 'hr' | 'en', data) => EmailContent` with **both languages**. Escape every user-provided value with `escapeHtml` (paragraphs are raw HTML). Links use `frontendUrl()` and must point at a real frontend route.
2. Send it:
   - **User-facing event that should also appear in the bell** → `notificationService.notify(user, '<type>', data)` (add the type to `NotificationType` in `domain/notification/Notification.entity.ts`, the copy key must equal the type, and render it in the frontend's `notificationView.tsx`). It respects `user.email_notifications` and `user.language`.
   - **Account email (no in-app notification)** → `mail.send({ email, name }, emailCopy.x(lang, data), lang)`, like verification/reset in `AuthService`.
3. Don't send per-message spam: see `MessagingService.post` for the "only if the recipient has nothing unread yet" pattern.
