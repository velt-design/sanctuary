import { expect,it,vi } from 'vitest';
import { lockDocumentScroll,unlockDocumentScroll } from './scrollLock';

it('keeps the document stationary through nested overlays and restores its position and styles',()=>{
  const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  vi.spyOn(window,'scrollY','get').mockReturnValue(505);
  vi.spyOn(document.documentElement,'clientWidth','get').mockReturnValue(window.innerWidth-16);
  document.body.style.position='relative';document.body.style.paddingRight='4px';
  lockDocumentScroll();lockDocumentScroll();
  expect(document.body.style.top).toBe('-505px');
  expect(document.body.style.height).toBe('auto');
  expect(document.body.style.paddingRight).toBe('20px');
  unlockDocumentScroll();expect(document.body.style.position).toBe('fixed');expect(scroll).not.toHaveBeenCalled();
  unlockDocumentScroll();expect(document.body.style.position).toBe('relative');
  expect(document.body.style.paddingRight).toBe('4px');expect(document.body.style.top).toBe('');
  expect(document.body.classList.contains('scroll-locked')).toBe(false);
  expect(scroll).toHaveBeenCalledWith({left:0,top:505,behavior:'instant'});
  unlockDocumentScroll();expect(scroll).toHaveBeenCalledTimes(1);
  document.body.removeAttribute('style');vi.restoreAllMocks();
});
