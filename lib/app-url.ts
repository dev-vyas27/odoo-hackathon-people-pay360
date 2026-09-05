/**
 * The absolute origin used to build links that leave the application — right
 * now, the set-password link in an invitation email.
 *
 * `APP_URL` wins when set, because that is the only value that is correct
 * behind a proxy or a custom domain. Falling back to the request's own origin
 * keeps local development working with no configuration.
 *
 * The request header is a fallback rather than the primary source on purpose:
 * `Host` is attacker-controlled, and an email whose link points wherever the
 * attacker asked is a password-reset phishing vector. Set APP_URL in anything
 * that is not localhost.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  return new URL(request.url).origin
}
