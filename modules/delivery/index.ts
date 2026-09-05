/**
 * Public surface of the "delivery" module.
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * Owner: Dev A — see docs/plans/DEV-A-platform.md.
 *
 * Delivery owns outbound communication: email now, payslip PDFs next. Callers
 * never import this for sending — they resolve `MailerPort` from the container,
 * which is what keeps `nodemailer` in exactly one file.
 */
export { registerDelivery } from './register'
