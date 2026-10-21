interface ScrollViewport {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

export const defaultJumpToEndThreshold = 120;

export function createChatScroll(onFollowChange: (following: boolean) => void = () => {}, getThreshold = () => defaultJumpToEndThreshold) {
  const atEnd = (viewport: ScrollViewport) => viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= getThreshold();
  let following = true;
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
    if (following === value) return;
    following = value;
    onFollowChange(value);
  };
  const layout = (viewport: ScrollViewport, dragging = false) => {
    if (viewport.clientHeight <= 0) return;
    if (movedUp(viewport, dragging) && !atEnd(viewport)) follow(false);
    if (atEnd(viewport)) follow(true);
    if (following) viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    remember(viewport);
  };
  return {
    layout,
    pause(viewport: ScrollViewport) {
      if (viewport.clientHeight > 0) follow(atEnd(viewport));
    },
    scroll(viewport: ScrollViewport, dragging = false) {
      if (viewport.clientHeight <= 0) return;
      if (atEnd(viewport)) follow(true);
      else if (movedUp(viewport, dragging) && !atEnd(viewport)) follow(false);
      remember(viewport);
    },
    jump(viewport: ScrollViewport) {
      follow(true);
      layout(viewport);
    },
  };
}
