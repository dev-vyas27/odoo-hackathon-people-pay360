


export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  return new URL(request.url).origin
}
