'use client';

let scrollLockCount = 0;
let restoreScroll: (() => void) | undefined;

export function lockDocumentScroll(): void {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    const x = window.scrollX, y = window.scrollY;
    const html = document.documentElement, body = document.body;
    const properties = ['position', 'top', 'left', 'width', 'height', 'padding-right'];
    const saved = [html, body].map(element => properties.map(name => ({
      name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name),
    })));
    const gap = Math.max(0, window.innerWidth - html.clientWidth);
    const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    // Keep the visible document in place instead of clamping its scrollable height.
    for (const element of [html, body]) element.style.setProperty('height', 'auto', 'important');
    body.style.setProperty('position', 'fixed', 'important');
    body.style.setProperty('top', `${-y}px`, 'important');
    body.style.setProperty('left', `${-x}px`, 'important');
    body.style.setProperty('width', '100%', 'important');
    if (gap) body.style.setProperty('padding-right', `${padding + gap}px`, 'important');
    restoreScroll = () => {
      [html, body].forEach((element, index) => saved[index].forEach(({name, value, priority}) => {
        if (value) element.style.setProperty(name, value, priority); else element.style.removeProperty(name);
      }));
      window.scrollTo({left:x, top:y, behavior:'instant'});
    };
    document.documentElement.classList.add('scroll-locked');
    document.body.classList.add('scroll-locked');
  }
  scrollLockCount += 1;
}

export function unlockDocumentScroll(): void {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.documentElement.classList.remove('scroll-locked');
    document.body.classList.remove('scroll-locked');
    restoreScroll?.();
    restoreScroll = undefined;
  }
}
