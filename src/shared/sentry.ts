import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

// Error monitoring is opt-in: nothing is sent unless SENTRY_DSN is set.
export const initSentry = () => {
  if (!process.env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
    // No request bodies/cookies/IPs: they can hold passwords and personal data.
    sendDefaultPii: false,
  });
  return true;
};

// Reports unexpected errors (non-HTTP or 5xx) to Sentry, then defers to
// Nest's default handling for the response.
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) Sentry.captureException(exception);
    super.catch(exception, host);
  }
}
