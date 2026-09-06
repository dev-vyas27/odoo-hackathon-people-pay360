


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
      
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    })
  }
  return transporter
}



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
        ...(message.attachments?.length
          ? [
              '',
              `  attachments: ${message.attachments
                .map((a) => `${a.filename} (${a.content.byteLength} bytes)`)
                .join(', ')}`,
            ]
          : []),
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
        
        
        attachments: message.attachments?.map((file) => ({
          filename: file.filename,
          content: Buffer.from(file.content),
          contentType: file.contentType,
        })),
      })
      return { to: message.to, sent: true }
    } catch (reason) {
      


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
