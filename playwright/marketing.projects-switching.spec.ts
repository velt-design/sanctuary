import { expect, test, type Page } from '@playwright/test';
import { projects } from '../apps/marketing/data/projects';

const initialProject = projects.find(
  ({ slug }) => slug === 'goodhome-commercial-terrace',
)!;
const targetProject = projects[(projects.indexOf(initialProject) + 1) % projects.length]!;
const initialRoute = `/projects/${initialProject.slug}`;
const targetRoute = `/projects/${targetProject.slug}`;
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';

async function dismissConsent(page: Page) {
  const essentialOnly = page.getByRole('button', { name: 'Essential only' });
  if (await essentialOnly.count() && await essentialOnly.isVisible()) {
    await essentialOnly.click();
  }
}

function projectsMain(page: Page) {
  return page.locator('main[data-projects-experience]:visible').last();
}

function projectLink(page: Page, slug: string) {
  return projectsMain(page).locator(
    `[data-project-next][href="/projects/${slug}"]`,
  );
}

async function expectProjectReady(page: Page, slug: string) {
  const main = projectsMain(page);
  await expect(main).toHaveAttribute('data-project-switch-state', 'ready');
  await expect(main.locator('[data-project-case-study]')).toHaveAttribute(
    'data-project-case-study',
    slug,
  );
  await expect.poll(() => main.locator('.project-case-study__hero img').evaluate(
    (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
  )).toBe(true);
}

for (const width of [390, 1440, 1920]) {
 test('named project navigation and history at '+width, async ({page})=>{
  await page.setViewportSize({width,height:900}); await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(initialRoute); await dismissConsent(page); await expectProjectReady(page,initialProject.slug);
  await expect(page.locator('.editorial-project-browser,.project-navigator__panel')).toHaveCount(0);
  await expect(page.locator('[data-all-projects]')).toHaveText('← All projects');
  await expect(projectLink(page,targetProject.slug)).toContainText(targetProject.title);
  await projectLink(page,targetProject.slug).press('Enter'); await expectProjectReady(page,targetProject.slug);
  await expect(page).toHaveTitle(targetProject.title+' Pergola Project | Sanctuary Pergolas');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',publicOrigin+targetRoute);
  await page.goBack(); await expectProjectReady(page,initialProject.slug);
  await page.goForward(); await expectProjectReady(page,targetProject.slug);
  const next=projects[(projects.indexOf(targetProject)+1)%projects.length]!;
  await page.locator('[data-next-project] a').press('Enter'); await expectProjectReady(page,next.slug);
  if (width >= 900) { await expect(page.locator('h1')).toBeFocused(); await page.keyboard.press('Tab'); await expect(page.getByRole('link',{name:'Discover the project'})).toBeFocused(); }
  await expect(page.locator('h1')).toBeInViewport();
 });
}
test('collection filters, view scale and scroll survive All projects and Back',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/projects?audience=residential');await dismissConsent(page);
 const card=page.locator('[data-project-card]').nth(4);await card.scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>window.scrollY);await card.click();
 await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects?audience=residential');
 await page.locator('[data-all-projects]').click();await expect(page.getByLabel('Filter by audience')).toHaveValue('residential');
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeCloseTo(before,0);
 await page.locator('[data-project-card]').nth(4).click();await page.goBack();
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeCloseTo(before,0);
});
test('native links work without JavaScript',async({browser},testInfo)=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:String(testInfo.project.use.baseURL)});const page=await context.newPage();
 await page.goto(initialRoute);await page.locator('[data-project-next]').click();
 await expect(page.locator('h1')).toHaveText(targetProject.title);await page.locator('[data-all-projects]').click();await expect(page.locator('[data-project-card]')).toHaveCount(projects.length);await context.close();
});
test('the current project remains intact until the incoming hero is decoded', async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  const targetHero = targetProject.caseStudyHeroImage ?? targetProject.heroImage;
  const targetFile = targetHero.src.split('/').at(-1)!;
  let delayedTargetRequest = false;
  let releaseTargetRequest = () => undefined;
  const targetRequestGate = new Promise<void>((resolve) => {
    releaseTargetRequest = resolve;
  });

  await page.route('**/_next/image?*', async (route) => {
    const optimizedSource = decodeURIComponent(
      new URL(route.request().url()).searchParams.get('url') ?? '',
    );
    if (optimizedSource.includes(targetFile)) {
      delayedTargetRequest = true;
      await targetRequestGate;
    }
    await route.continue();
  });

  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);
  await page.evaluate((incomingFile) => {
    const runtimeWindow = window as Window & {
      __projectSwitchFrames?: Array<{
        complete: boolean;
        currentSrc: string;
        naturalWidth: number;
      }>;
      __stopProjectSwitchFrames?: () => void;
    };
    runtimeWindow.__projectSwitchFrames = [];
    let active = true;
    const sample = () => {
      const image = document.querySelector<HTMLImageElement>(
        '.project-case-study__hero img',
      );
      if (image) {
        runtimeWindow.__projectSwitchFrames?.push({
          complete: image.complete,
          currentSrc: image.currentSrc.includes(incomingFile) ? incomingFile : image.currentSrc,
          naturalWidth: image.naturalWidth,
        });
      }
      if (active) requestAnimationFrame(sample);
    };
    runtimeWindow.__stopProjectSwitchFrames = () => { active = false; };
    requestAnimationFrame(sample);
  }, targetFile);

  await projectLink(page, targetProject.slug).click();
  await expect.poll(() => delayedTargetRequest).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${initialRoute}$`));
  await expect(projectsMain(page).locator('[data-project-case-study]')).toHaveAttribute(
    'data-project-case-study',
    initialProject.slug,
  );
  const oldHero = projectsMain(page).locator('.project-case-study__hero img');
  expect(await oldHero.evaluate(
    (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
  )).toBe(true);

  releaseTargetRequest();
  await expect(page).toHaveURL(new RegExp(`${targetRoute}$`));
  await expectProjectReady(page, targetProject.slug);
  await page.waitForTimeout(50);
  const frames = await page.evaluate(() => {
    const runtimeWindow = window as Window & {
      __projectSwitchFrames?: Array<{
        complete: boolean;
        currentSrc: string;
        naturalWidth: number;
      }>;
      __stopProjectSwitchFrames?: () => void;
    };
    runtimeWindow.__stopProjectSwitchFrames?.();
    return runtimeWindow.__projectSwitchFrames ?? [];
  });
  const incomingFrames = frames.filter(({ currentSrc }) => currentSrc === targetFile);
  expect(incomingFrames.length).toBeGreaterThan(0);
  expect(incomingFrames.every(({ complete, naturalWidth }) => (
    complete && naturalWidth > 0
  ))).toBe(true);
});

test('modified project clicks retain canonical native-link behavior', async ({ page }) => {
  await page.setViewportSize({ width: 1_440, height: 900 });
  await page.goto(initialRoute);
  await dismissConsent(page);
  await expectProjectReady(page, initialProject.slug);

  const target = projectLink(page, targetProject.slug);
  await expect(target).toHaveAttribute('href', targetRoute);
  const preventedByProjectHandlers = await target.evaluate((anchor) => new Promise<boolean>(
    (resolve) => {
      document.addEventListener('click', (event) => {
        const wasAlreadyPrevented = event.defaultPrevented;
        event.preventDefault();
        resolve(wasAlreadyPrevented);
      }, { once: true });
      anchor.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0,
        cancelable: true,
        ctrlKey: true,
      }));
    },
  ));

  expect(preventedByProjectHandlers).toBe(false);
  await expect(page).toHaveURL(new RegExp(`${initialRoute}$`));
  await expectProjectReady(page, initialProject.slug);
});


for (const width of [390,1440]) test('finder brief survives project switching, enquiry and browser return at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await dismissConsent(page);
 await page.getByRole('radio',{name:/Custom design/}).click();await expect(page).toHaveURL(/project=bespoke/);
 const finderHref=page.url();await page.locator('[data-project-evidence="warkworth-outdoor-room"]').getByRole('link',{name:'View project'}).click();
 await expect(page.locator('[data-project-next]')).toHaveAttribute('href',/project=bespoke/);
 await page.locator('[data-project-next]').click();await expect(page.locator('h1')).toHaveText('Mt Maunganui Box');
 const projectHref=page.url();await page.getByRole('link',{name:/Send project brief/}).click();
 const enquiry=JSON.parse(await page.locator('#contact-form input[name="enquiryContext"]').inputValue());expect(enquiry).toMatchObject({source_project:'mt-maunganui-box',project_direction:'bespoke',source_experience:'project-finder-home-v1'});
 await page.goBack();await expect(page).toHaveURL(projectHref);await expect(page.locator('h1')).toHaveText('Mt Maunganui Box');await page.goBack();await expect(page.locator('h1')).toHaveText('Warkworth Outdoor Room');
 await page.goBack();await expect(page).toHaveURL(finderHref);await expect(page.getByRole('radio',{name:/Custom design/})).toBeChecked();
});

test('photographic next project is one accessible whole-card link',async({page})=>{
 await page.goto(initialRoute);await dismissConsent(page);const card=page.locator('[data-next-project] a');
 await expect(card).toHaveAccessibleName('Next project: '+targetProject.title);await expect(page.locator('[data-next-project] a')).toHaveCount(1);
 await expect(card.locator('a,button,input,select,textarea')).toHaveCount(0);
 await card.locator('img').click({position:{x:20,y:20}});await expectProjectReady(page,targetProject.slug);
});

test('mobile opening prioritises project name and substantial image',async({page})=>{
 await page.setViewportSize({width:390,height:700});await page.emulateMedia({reducedMotion:'reduce'});
 for(const slug of ['tindalls-bay-pavilion','velskov-forest','warkworth-outdoor-room']){
  await page.goto('/projects/'+slug);
  if(slug==='tindalls-bay-pavilion') { await page.getByRole('button',{name:'Essential only'}).waitFor({state:'visible'}); }
  await dismissConsent(page);const nav=page.getByRole('navigation',{name:'Project navigation'});
  expect((await nav.boundingBox())!.height).toBeLessThanOrEqual(58);
  const next=page.locator('[data-project-next]');await expect(next).toHaveAccessibleName(/^Next project: /);
  expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const title=page.locator('h1'),image=page.locator('.project-case-study__hero img'),summary=page.locator('.project-case-study__intro > div').last();
  await expect(image).toBeVisible();const titleBox=(await title.boundingBox())!,imageBox=(await image.boundingBox())!;
  expect(imageBox.y).toBeGreaterThan(titleBox.y+titleBox.height);expect(imageBox.y).toBeLessThan(360);
  expect(Math.min(630,imageBox.y+imageBox.height)-imageBox.y).toBeGreaterThan(220);
  expect((await summary.boundingBox())!.y).toBeGreaterThan(imageBox.y+imageBox.height);
  await page.screenshot({path:'artifacts/marketing-foundation-evolution/project-mobile-'+slug+'.png'});
 }
});


for (const width of [390,1440]) test('collection return belongs only to its navigation chain at '+width,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/projects?audience=residential');await dismissConsent(page);
 const card=page.locator('[data-project-card]').nth(3);await card.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>window.scrollY);await card.click();
 await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects?audience=residential');
 const nextHref=await page.locator('[data-project-next]').getAttribute('href');await page.locator('[data-project-next]').click();await expect(page).toHaveURL(new URL(nextHref!,page.url()).href);
 await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects?audience=residential');
 await page.reload();await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects?audience=residential');
 const detail=page.url();await page.getByRole('link',{name:/Send project brief/}).click();await expect(page.locator('#contact-form')).toBeVisible();await page.goBack();await expect(page).toHaveURL(detail);
 await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects?audience=residential');await page.locator('[data-all-projects]').click();
 await expect(page.getByLabel('Filter by audience')).toHaveValue('residential');await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeCloseTo(scroll,0);
 await page.locator('[data-project-card]').first().click();await page.getByRole('link',{name:'Sanctuary Pergolas home'}).click();
 await page.getByRole('radio',{name:/Custom design/}).click();await page.locator('[data-project-evidence="warkworth-outdoor-room"]').getByRole('link',{name:'View project'}).click();
 await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects');
 const independentNext=await page.locator('[data-project-next]').getAttribute('href');await page.locator('[data-project-next]').click();await expect(page).toHaveURL(new URL(independentNext!,page.url()).href);await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects');
 await page.locator('[data-all-projects]').click();await expect(page).toHaveURL(new URL('/projects',page.url()).href);await expect(page.getByLabel('Filter by audience')).toHaveValue('all');
 expect(await page.evaluate(()=>window.scrollY)).toBeLessThan(100);
 await page.goto('/projects/dairy-flat-estate');await expect(page.locator('[data-all-projects]')).toHaveAttribute('href','/projects');
});
