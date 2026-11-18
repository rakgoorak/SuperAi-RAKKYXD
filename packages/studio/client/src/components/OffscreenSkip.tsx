import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

/**
 * Long chats stay smooth: a message far outside the scroll area (more than ~2 screens away) is
 * kept in the page but not drawn (`content-visibility: hidden` at its last measured height), so
 * the browser only lays out and paints what is near the screen. Its text is still in the DOM, so
 * search, copy and jump-to-message keep working, and menus inside a message never get clipped
 * because a message is only skipped while it is out of view.
 */
export const OffscreenRoot = createContext<RefObject<HTMLElement | null> | null>(null);

const MARGIN = '1600px 0px';

export function OffscreenSkip({ children }: { children: ReactNode }) {
  const root = useContext(OffscreenRoot);
  const element = useRef<HTMLDivElement>(null);
  const [skipped, setSkipped] = useState<number | null>(null);
  useEffect(() => {
    const node = element.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSkipped(null);
      else setSkipped(Math.max(1, Math.round(entry.boundingClientRect.height)));
    }, { root: root?.current || null, rootMargin: MARGIN });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root]);
  return <div ref={element} className="offscreen-skip"
    style={skipped ? { contentVisibility: 'hidden', containIntrinsicSize: `auto ${skipped}px` } : undefined}>{children}</div>;
}
