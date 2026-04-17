import { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Smart auto-scroll: only scrolls if user is near the bottom.
 * Shows a "new messages" indicator when user has scrolled up.
 */
export function useSmartScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const checkIfAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const threshold = 150;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setHasNewMessages(false);
  }, []);

  // On scroll, track if user is at bottom
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewMessages(false);
  }, [checkIfAtBottom]);

  // When deps change (new messages), auto-scroll if at bottom, otherwise show indicator
  useEffect(() => {
    if (isAtBottom) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } else {
      setHasNewMessages(true);
    }
  }, deps);

  return { containerRef, handleScroll, scrollToBottom, hasNewMessages };
}
