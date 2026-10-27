---
name: send-email
description: Add or modify a transactional email sent from the Udomi Me backend (e.g. verification, password reset, new notification). Use when asked to send a new email or change an email's content/trigger.
---

# Send a Transactional Email

All email code currently lives inline in `src/services/auth/auth.service.ts` — there is no dedicated email/mail module. Two patterns exist; pick based on whether the email needs rich/managed templating:

## Pattern A — inline HTML (used for verification email, and as the reset-password fallback)

```ts
await this.sendEmail(
  { email: user.email, name: `${user.first_name} ${user.last_name}` },
  'Subject line',
  `<div style="font-family:sans-serif;max-width:480px;margin:auto">...</div>`,
);
```

`sendEmail()` is a private method on `AuthService` — if you need it from another service, either move it to a shared helper or duplicate the MailerSend boilerplate (there's no existing shared email module to import from). It silently no-ops if `MAILERSEND_API_KEY` is unset, and catches/logs (never throws) on send failure — callers never need to handle an email-send error.

## Pattern B — MailerSend template (used for password reset when `MAILERSEND_TEMPLATE_ID` is set)

```ts
const emailParams = new EmailParams()
  .setFrom(sentFrom)
  .setTo([new Recipient(user.email, name)])
  .setTemplateId(process.env.MAILERSEND_TEMPLATE_ID)
  .setPersonalization([{ email: user.email, data: { name, account_name, support_email, token } }]);
await mailerSend.email.send(emailParams);
```

The actual email body/design lives in the MailerSend dashboard, not in this repo — `data` keys must match the template's merge-field names exactly (currently `name`, `account_name`, `support_email`, `token`).

## Either way

- Links back to the frontend use `process.env.FRONTEND_URL || 'http://localhost:3000'`, pointing at a frontend route (e.g. `/verify-email?token=...`) — the frontend must have a matching route that reads `?token=` and calls the corresponding backend endpoint.
- New env vars for a new template (e.g. a new `MAILERSEND_*_TEMPLATE_ID`) must be documented in `CLAUDE.md`'s required `.env` list and in the root docker-compose/deployment env if this ships to production.
