/**
 * Class merging.
 *
 * Re-exported from shadcn's compiled `cn` package so the whole codebase shares
 * ONE merge engine. The generated components in components/ui import "cn"
 * directly; everything we write imports it from here via the alias in
 * components.json. Two different tailwind-merge implementations in one app
 * eventually disagree about which class wins, and that bug is miserable to find.
 */
export { cn } from 'cn'
