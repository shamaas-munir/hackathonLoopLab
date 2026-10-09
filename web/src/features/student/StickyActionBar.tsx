/** Bottom action bar: sticks to the viewport edge on scroll, respects the iOS home indicator. */
export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-print sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:-mx-0 md:rounded-xl md:border md:bg-card/95 md:pb-3 md:shadow-sm">
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
