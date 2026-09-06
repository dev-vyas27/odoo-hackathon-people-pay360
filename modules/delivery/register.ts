


import { PORT_KEYS, providePort, type MailerPort } from '@/modules/shared'
import { createMailer } from './infrastructure/nodemailer-mailer'

export function registerDelivery(): void {
  providePort<MailerPort>(PORT_KEYS.mailer, createMailer)
}
