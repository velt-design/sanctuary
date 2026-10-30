import {expect,it} from 'vitest';
import {compactPdfFitScale,compactPdfViewportHeight} from './QuotePdfInlinePreview';

it.each([
  ['ordinary A3 landscape',685,600,1190.551,841.89],
  ['large desktop A3 landscape',685,1000,1190.551,841.89],
  ['ordinary portrait financial page',685,632,595.28,841.89],
  ['enlarged viewport',1337,760,1190.551,841.89],
])('fits the complete %s inside its scroll viewport including page padding',(_label,clientWidth,clientHeight,pageWidth,pageHeight)=>{
  const viewport=document.createElement('div');
  Object.defineProperties(viewport,{clientWidth:{value:clientWidth},clientHeight:{value:clientHeight},offsetWidth:{value:clientWidth+15}});
  const scale=compactPdfFitScale(viewport,pageWidth,pageHeight);
  expect(Math.floor(pageWidth*scale)+32).toBeLessThanOrEqual(clientWidth);
  expect(Math.floor(pageHeight*scale)+32).toBeLessThanOrEqual(clientHeight);
  const naturalHeight=compactPdfViewportHeight(viewport,pageWidth,pageHeight);
  expect(naturalHeight).toBe(Math.floor(pageHeight*scale)+32);
  expect(naturalHeight).toBeLessThanOrEqual(clientHeight);
  expect(scale).toBeGreaterThan(0);
  if(clientHeight===1000)expect(Math.floor(pageWidth*scale)+32).toBeGreaterThanOrEqual(clientWidth-1);
});

it('removes tall A3 blank space and grows again for portrait, resize and enlarged Fit from independent available height',()=>{
  const tall={clientWidth:685,clientHeight:910};
  const landscape=compactPdfViewportHeight(tall,1190.551,841.89);
  expect(landscape).toBe(493);
  const portrait=compactPdfViewportHeight(tall,595.28,841.89);
  expect(portrait).toBeGreaterThan(landscape+350);
  expect(portrait).toBeLessThanOrEqual(tall.clientHeight);
  expect(compactPdfViewportHeight(tall,1190.551,841.89)).toBe(landscape);
  const enlarged=compactPdfViewportHeight({clientWidth:1337,clientHeight:910},1190.551,841.89);
  expect(enlarged).toBeGreaterThan(landscape+350);
  const resized=compactPdfViewportHeight({clientWidth:685,clientHeight:400},1190.551,841.89);
  expect(resized).toBeLessThanOrEqual(400);
  expect(compactPdfViewportHeight(tall,1190.551,841.89)).toBe(landscape);
});

it('keeps explicit zoom relative to whole-page fit instead of reducing the zoom to fit',()=>{
  const viewport={clientWidth:685,clientHeight:600},pageWidth=1190.551,pageHeight=841.89;
  const fit=compactPdfFitScale(viewport,pageWidth,pageHeight);
  expect(Math.floor(pageWidth*fit*1.25)+32).toBeGreaterThan(viewport.clientWidth);
  const fixedViewportHeight=compactPdfViewportHeight(viewport,pageWidth,pageHeight);
  expect(Math.floor(pageHeight*fit*1.25)+32).toBeGreaterThan(fixedViewportHeight);
});
