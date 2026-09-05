/**
 * Public surface of the "delivery" module.
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * CLIENT-SAFE: pure document vocabulary only. Anything that touches pdfkit, the
 * AWS SDK or a request lives in `@/modules/delivery/server`.
 */
export {
  buildPayslipDocument,
  fileNameFor,
  formatDay,
  maskAccount,
  storageKeyFor,
  type CompanyIdentity,
  type DocumentField,
  type DocumentLine,
  type DocumentTotals,
  type PayslipDocument,
  type PayslipDocumentInput,
} from "./domain/payslip-document";

export { amountInWords } from "./domain/money-words";

/** Publishes MailerPort. `lib/bootstrap.ts` calls this once per process. */
export { registerDelivery } from "./register";
