export function UnreadDot({ visible }: { visible: boolean }) {
  if (!visible) return null
  return <span aria-label="未读" className="absolute right-2 top-2 z-10 h-2 w-2 rounded-full bg-red-500" title="未读" />
}
