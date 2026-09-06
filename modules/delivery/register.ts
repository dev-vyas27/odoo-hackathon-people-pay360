/**
 * What `delivery` publishes. Called once per process from `lib/bootstrap.ts`.
 *
 * Lazy: `providePort` stores the factory, so no SMTP connection is attempted
 * at import time — only when something actually sends.
 */
import { PORT_KEYS, providePort, type MailerPort } from '@/modules/shared'
import { createMailer } from './infrastructure/nodemailer-mailer'

export function registerDelivery(): void {
  providePort<MailerPort>(PORT_KEYS.mailer, createMailer)
}
