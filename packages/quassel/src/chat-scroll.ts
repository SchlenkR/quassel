interface ScrollViewport {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export const defaultJumpToEndThreshold = 120;

export function createChatScroll(onFollowChange: (following: boolean) => void = () => {}, getThreshold = () => defaultJumpToEndThreshold) {
  const atEnd = (viewport: ScrollViewport) => viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= getThreshold();
  let following = true;
  // A user gesture upward holds the pause; only a downward move or a jump releases it.
  let held = false;
  let heldTop = 0;
  let lastTop = 0;
  let lastHeight = 0;
  let lastClientHeight = 0;

  const movedUp = (viewport: ScrollViewport, dragging: boolean) => viewport.scrollTop < lastTop
    && (dragging || viewport.scrollHeight === lastHeight && viewport.clientHeight === lastClientHeight);
  const remember = (viewport: ScrollViewport) => {
    lastTop = viewport.scrollTop;
    lastHeight = viewport.scrollHeight;
    lastClientHeight = viewport.clientHeight;
  };
  const follow = (value: boolean) => {
    if (value) held = false;
    if (following === value) return;
    following = value;
    onFollowChange(value);
  };
  const layout = (viewport: ScrollViewport, dragging = false) => {
    if (viewport.clientHeight <= 0) return;
    if (movedUp(viewport, dragging) && !atEnd(viewport)) follow(false);
    if (viewport.scrollHeight <= viewport.clientHeight || atEnd(viewport) && !held) follow(true);
    if (following) viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    remember(viewport);
  };
  return {
    layout,
    pause(viewport: ScrollViewport) {
      if (viewport.clientHeight <= 0 || viewport.scrollHeight <= viewport.clientHeight) return;
      follow(false);
      held = true;
      heldTop = viewport.scrollTop;
    },
    scroll(viewport: ScrollViewport, dragging = false) {
      if (viewport.clientHeight <= 0) return;
      if (atEnd(viewport) && (!held || viewport.scrollTop > heldTop)) follow(true);
      else if (movedUp(viewport, dragging) && !atEnd(viewport)) follow(false);
      heldTop = viewport.scrollTop;
      remember(viewport);
    },
    jump(viewport: ScrollViewport) {
      follow(true);
      layout(viewport);
    },
  };
}
