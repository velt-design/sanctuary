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

it('retains a staff gutter once through nested locks without adding a second scrollbar allowance',()=>{
  const staff=document.createElement('main');staff.dataset.portalSidebarMode='pinned';document.body.append(staff);
  const nativeStyle=window.getComputedStyle;
  vi.spyOn(window,'getComputedStyle').mockImplementation(element=>element===document.documentElement?{scrollbarGutter:'stable'} as CSSStyleDeclaration:nativeStyle(element));
  vi.spyOn(document.documentElement,'clientWidth','get').mockReturnValue(window.innerWidth-15);
  vi.spyOn(document.body,'getBoundingClientRect').mockReturnValue({width:1009} as DOMRect);
  const scroll=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  document.body.style.paddingRight='4px';
  lockDocumentScroll();lockDocumentScroll();
  expect(document.body.style.width).toBe('1009px');
  expect(document.body.style.paddingRight).toBe('4px');
  unlockDocumentScroll();expect(scroll).not.toHaveBeenCalled();
  unlockDocumentScroll();expect(document.body.style.width).toBe('');
  expect(document.body.style.paddingRight).toBe('4px');expect(scroll).toHaveBeenCalledOnce();
  staff.remove();document.body.removeAttribute('style');vi.restoreAllMocks();
});

it('does not select retained-gutter compensation outside the ordinary staff scroll owner',()=>{
  vi.spyOn(window,'getComputedStyle').mockReturnValue({scrollbarGutter:'stable',paddingRight:'0px'} as CSSStyleDeclaration);
  vi.spyOn(document.documentElement,'clientWidth','get').mockReturnValue(window.innerWidth-15);
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  lockDocumentScroll();expect(document.body.style.width).toBe('100%');expect(document.body.style.paddingRight).toBe('15px');
  unlockDocumentScroll();document.body.removeAttribute('style');vi.restoreAllMocks();
});
