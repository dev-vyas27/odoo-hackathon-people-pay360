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

/**
 * `export { registerDelivery } from "./register"` was here and broke the build:
 * `modules/delivery/register.ts` has never existed on any branch, and nothing
 * imports `registerDelivery` — `lib/bootstrap.ts` included.
 *
 * Removed rather than stubbed, because there is currently nothing for it to do:
 * `PORT_KEYS` declares no delivery port, and `composition.ts` only RESOLVES
 * ports this module consumes (payslipQuery, employeeLookup, payslipRenderer,
 * documentStorage). Delivery is a pure consumer today.
 *
 * Dev A: if delivery is meant to publish a port, add the key to
 * `port-keys.ts`, write the register function, and call it from `bootstrap.ts`
 * — all three, or it stays unwired.
 */
