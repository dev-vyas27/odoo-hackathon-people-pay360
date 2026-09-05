/**
 * The ONLY file in the codebase that imports nodemailer.
 *
 * Everything else asks for `MailerPort`. That is what lets a test assert on the
 * message without an SMTP server, and what makes swapping SES or Postmark in
 * later a one-file change.
 *
 * When `SMTP_HOST` is unset it logs to the console instead of sending. That is
 * not a stub — it is the intended behaviour for a demo, where the point is to
 * show the link, not to deliver it. It is also what stops a rehearsal quietly
 * emailing 25 real addresses.
 */
import nodemailer, { type Transporter } from 'nodemailer'
import type { EmailMessage, EmailResult, MailerPort } from '@/modules/shared'

const FROM = process.env.MAIL_FROM ?? 'PeoplePay360 <no-reply@peoplepay360.local>'

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST)
}

let transporter: Transporter | null = null

function transport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      // 465 is implicit TLS; everything else upgrades with STARTTLS.
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  }
  return transporter
}

/**
 * Writes the message to the server log. Used whenever SMTP is not configured.
 *
 * The body is printed in full on purpose: during a demo the set-password link
 * is IN the body, and copying it out of the terminal is the whole point.
 */
const consoleMailer: MailerPort = {
  async send(message: EmailMessage): Promise<EmailResult> {
    console.log(
      [
        '',
        '── email (SMTP not configured, logged instead) ──────────────',
        `  to:      ${message.to}`,
        `  subject: ${message.subject}`,
        '',
        message.text.replace(/^/gm, '  '),
        '─────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    )
    return { to: message.to, sent: true }
  },
}

const smtpMailer: MailerPort = {
  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      await transport().sendMail({
        from: FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      })
      return { to: message.to, sent: true }
    } catch (reason) {
      /**
       * Never throw. A bounced address must not fail the operation that
       * triggered the email — an admin creating an account should get the
       * account, plus a note that the invitation did not go out, not a 500 and
       * no idea whether the account exists.
       */
      const error = reason instanceof Error ? reason.message : 'Unknown mail error'
      console.error(`[mailer] failed to send to ${message.to}: ${error}`)
      return { to: message.to, sent: false, error }
    }
  },
}

export function createMailer(): MailerPort {
  return smtpConfigured() ? smtpMailer : consoleMailer
}

export { consoleMailer }
