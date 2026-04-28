'use client';

let scrollLockCount = 0;

export function lockDocumentScroll(): void {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    document.documentElement.classList.add('scroll-locked');
    document.body.classList.add('scroll-locked');
  }
  scrollLockCount += 1;
}

export function unlockDocumentScroll(): void {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.documentElement.classList.remove('scroll-locked');
    document.body.classList.remove('scroll-locked');
  }
}
