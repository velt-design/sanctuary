let locks = 0;
let restore: (() => void) | undefined;

/** Shared by native dialogs; nested views must not unlock their parent. */
export function lockPageScroll() {
  if (locks++ === 0) {
    const y = window.scrollY;
    const x = window.scrollX;
    const html = document.documentElement;
    const body = document.body;
    const properties = ['overflow', 'overscroll-behavior', 'position', 'top', 'left', 'width', 'padding-right'];
    const saved = [html, body].map(element => properties.map(name => ({
      name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name),
    })));
    const gap = Math.max(0, window.innerWidth - html.clientWidth);
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    for (const element of [html, body]) {
      element.style.setProperty('overflow', 'hidden', 'important');
      element.style.setProperty('overscroll-behavior', 'none', 'important');
    }
    body.style.setProperty('position', 'fixed', 'important');
    body.style.setProperty('top', `${-y}px`, 'important');
    body.style.setProperty('left', `${-x}px`, 'important');
    body.style.setProperty('width', '100%', 'important');
    if (gap) body.style.setProperty('padding-right', `${padding + gap}px`, 'important');
    restore = () => {
      [html, body].forEach((element, index) => saved[index].forEach(({ name, value, priority }) => {
        if (value) element.style.setProperty(name, value, priority); else element.style.removeProperty(name);
      }));
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) { restore?.(); restore = undefined; }
  };
}
