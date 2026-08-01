# Sanctuary Pergolas Guided Design Conversation Homepage

## Product, UX and Implementation Specification

**Repository:** `velt-design/sanctuary`  
**Status:** Authoritative implementation brief for an experimental homepage route  
**Recommended preview route:** `/home-guided`  
**Date:** 1 August 2026  
**Primary owner:** Sanctuary marketing website  
**Current live homepage:** Must remain unchanged until the experimental route passes the acceptance gates in this document

---

## 1. Purpose

Create an experimental alternative to the current Sanctuary Pergolas homepage by duplicating the current homepage implementation and progressively transforming it into a longer, calmer and more useful guided design conversation.

The new homepage should help each visitor identify the most relevant Sanctuary pathway through a short sequence of one-question-at-a-time choices.

The experience must:

- feel like a refined design conversation rather than a questionnaire;
- present no competing primary calls to action;
- use two or three clear options at each step;
- lead most visitors to a useful result in three selections;
- use large project imagery when visual comparison improves understanding;
- use large typography when the distinction is conceptual rather than visual;
- minimise visible copy and simultaneous choice;
- preserve Sanctuary's premium, architectural and technically credible positioning;
- use the same Foundation UI, content sources, motion language and interaction quality as the rest of the marketing site;
- direct each final result to a dedicated landing page, not to an individual project;
- use completed projects as evidence within those landing pages;
- preserve the current live homepage until the experimental route has been validated.

This is a focused homepage and pathway project. It is not a full-site redesign.

---

## 2. Product vision

The homepage should function as a **guided project matcher**.

It should progressively answer:

1. Who is the visitor planning for?
2. What are they trying to create?
3. What matters most within that project?
4. Which Sanctuary pathway is the best starting point?
5. Which dedicated landing page should they visit next?

The experience should not claim to determine a final technical solution. It should identify the visitor's **best-fit starting point** and explain why it appears relevant.

### Desired feeling

The interaction should feel:

- calm;
- editorial;
- visually generous;
- specific;
- direct;
- low effort;
- high confidence;
- premium because it is clear and controlled.

It should not feel:

- like a quote calculator;
- like a lead-generation quiz;
- like a catalogue configurator;
- like a chatbot;
- like a carousel of promotional cards;
- overly animated;
- overly technical;
- artificially personalised.

---

## 3. Primary success outcome

A first-time visitor should be able to reach a relevant Sanctuary pathway in approximately three choices without needing to understand:

- Sanctuary's internal service structure;
- pergola industry terminology;
- roof-system terminology;
- the difference between service pages and guide pages;
- which completed project they should select;
- whether they are expected to know the final design.

The final result must lead to one of five stable landing-page destinations:

1. Residential pergola planning
2. Outdoor rooms
3. Bespoke and difficult-site pergolas
4. Commercial pergolas
5. Architect, designer and builder collaboration

The third answer can refine the emphasis, project order and enquiry context on the destination page, but it must not create a large set of near-duplicate landing pages.

---

## 4. Experience principles

### 4.1 Progressive specificity

Begin with the visitor's role, then move to the intended outcome, then to the most important project condition.

Do not ask technical material questions before the user has expressed an outcome.

### 4.2 One decision at a time

Only the current question should command attention.

Previous answers should collapse into a quiet editable summary. Future questions must not be rendered visibly before they are relevant.

### 4.3 Maximum of three options

Each question should contain two or three options. Do not add an "Other" option unless testing proves it is necessary.

### 4.4 Outcome language before product language

Ask about:

- daylight;
- shade;
- shelter;
- intended use;
- house connection;
- levels;
- coordination;
- project stage.

Do not initially ask users to choose:

- acrylic;
- insulated panel;
- timber sarking;
- gable;
- mono-pitch;
- box perimeter;
- structural system.

Those directions should appear in the recommendation or dedicated landing page.

### 4.5 One primary action

Before the result, the only dominant actions are the answer options.

At the result, there is one primary CTA to the dedicated landing page.

Quiet controls are permitted for:

- Change answer
- Start again
- Browse the menu
- Return using browser Back

### 4.6 Evidence, not decoration

Images should help visitors distinguish:

- a straightforward cover from an outdoor room;
- standard geometry from a difficult site;
- residential from commercial scale;
- different uses and levels of integration.

Do not use imagery merely to fill space.

### 4.7 Preserve honest uncertainty

Use language such as:

- Best starting point
- Likely direction
- Relevant examples
- Worth considering
- Final design depends on the measured site

Do not imply that three answers determine the final roof or structure.

---

## 5. Route and release strategy

### 5.1 Experimental route

Create a new non-indexed route:

`/home-guided`

Recommended implementation structure:

```text
apps/marketing/app/home-guided/page.tsx
apps/marketing/app/_home-guided/GuidedHomepage.tsx
apps/marketing/app/_home-guided/GuidedConversation.tsx
apps/marketing/app/_home-guided/guidedConversation.ts
apps/marketing/app/_home-guided/guidedHomepage.module.css
apps/marketing/app/_home-guided/GuidedHomepageTracker.tsx
apps/marketing/app/_home-guided/guidedConversation.test.ts
```

Names may be aligned with repository conventions after inspection, but the guided homepage must have one clear owner.

### 5.2 Duplicate before transforming

The first implementation step must duplicate the current homepage owner and establish the preview route with no intentional visual regression.

Use the current homepage as the visual and technical starting point, including:

- Foundation UI components;
- fonts and type hierarchy;
- page width and spacing tokens;
- header treatment;
- hero image handling;
- motion tokens;
- project data;
- enquiry-context helpers;
- analytics consent handling;
- reduced-motion behaviour;
- current responsive architecture.

Do not copy shared UI primitives or project data into the new route.

### 5.3 Live root protection

Do not replace `/` during development.

Do not change current root metadata, redirects or sitemap behaviour as part of the experimental implementation.

The preview route must:

- use `robots: { index: false, follow: false }`;
- be excluded from the sitemap;
- use a self-contained preview title;
- avoid becoming a second indexed homepage;
- retain the normal site layout and global footer.

### 5.4 Promotion strategy

Only after acceptance:

1. promote the guided homepage owner to `/`;
2. retain the previous homepage temporarily at a non-indexed comparison route if product review still needs it;
3. update canonical metadata and route tests;
4. remove the temporary preview route when no longer required.

---

## 6. Page structure

The completed experimental page should contain:

1. Global header
2. Hero and Question 1
3. Quiet previous-answer summary, once applicable
4. Question 2
5. Question 3
6. Final recommendation
7. Minimal supporting reassurance
8. Global footer

The current homepage's static capability, process and multi-CTA sections should not remain as competing downstream sections once the guided flow is complete.

The experimental route may retain selected current homepage elements during early development, but the final version should be one coherent conversation rather than a conventional homepage followed by a quiz.

---

## 7. Opening hero

Do not add a separate "Begin" screen or button.

The first question should be available immediately.

### Recommended opening copy

**Eyebrow**

`Fixed-roof pergola design and build in Auckland`

**Primary heading**

`What are you planning?`

**Optional supporting line**

`Choose the closest starting point. We'll show you the most relevant approach.`

Keep this line to one short sentence. It may be omitted if the choices are self-explanatory.

### Hero treatment

Use the current homepage's visual language as the baseline:

- full-width completed-project imagery;
- controlled dark gradient;
- strong white typography;
- quiet project attribution;
- full-width mobile option controls;
- no visible `Start your project` button within the hero;
- no project-link CTA competing with Question 1.

The desktop header CTA should be suppressed on `/home-guided` while preserving the brand and menu. The mobile header already prioritises the menu. Implement this as a narrow route-aware option rather than a second header component.

---

## 8. Complete question sequence

# Question 1: Audience

## Who are you planning for?

### Option A

**My home**

`A deck, patio, pool area or outdoor living space.`

Value: `home`

### Option B

**A business or venue**

`Hospitality, workplace, recreation or another shared site.`

Value: `business`

### Option C

**A client project**

`For architects, designers and builders.`

Value: `professional`

### Presentation

Type-led.

Use large option rows rather than project images. The distinction is conceptual and does not need visual proof yet.

---

# Homeowner branch

## Question 2

### What are you trying to create?

### Option A

**A straightforward cover**

`A refined, uncomplicated roof over a deck or patio.`

Value: `straightforward-cover`

### Option B

**A complete outdoor room**

`A space for dining, entertaining, cooking or relaxing.`

Value: `outdoor-room`

### Option C

**A solution for a difficult site**

`Unusual geometry, restricted posts, roof connections or changing levels.`

Value: `difficult-site`

### Presentation

Image-led.

Use one governed completed-project image for each option. The three images must communicate materially different project conditions.

Initial image candidates:

- Straightforward cover: a clear residential deck-cover project with conventional geometry
- Outdoor room: Warkworth Outdoor Room or Riverhead Gable Pavilion
- Difficult site: Tindalls Bay Pavilion, Ardmore Box Carport or another governed complex project

Codex must inspect `apps/marketing/data/projects.ts` and select images based on communication purpose, not only aesthetics.

---

## Home branch A: Straightforward cover

### Question 3

## What should the roof improve most?

### Option A

**Shelter without losing daylight**

`Keep the deck bright while adding reliable rain cover.`

Value: `daylight`

### Option B

**More shade and thermal comfort**

`Reduce direct sun and create a more protected space.`

Value: `shade`

### Option C

**A balance of light and shelter**

`Use different roof zones for different parts of the space.`

Value: `balanced`

### Result

Result ID: `residential-cover`

Destination:

`/pergolas-auckland`

Optional validated focus parameter:

- `?focus=daylight`
- `?focus=shade`
- `?focus=balanced`

### Result explanation templates

**Daylight**

`A residential pergola with acrylic or mixed roofing is a useful starting point when shelter and natural light both matter.`

**Shade**

`A more solid or insulated roof direction is worth exploring when shade and thermal comfort lead the brief.`

**Balanced**

`A combination roof is worth exploring when different parts of the space need different light and shelter conditions.`

All language remains conditional.

---

## Home branch B: Complete outdoor room

### Question 3

## How do you want to use the space?

### Option A

**Everyday dining and relaxing**

`A comfortable extension of daily home life.`

Value: `everyday`

### Option B

**Cooking and entertaining**

`A complete setting for guests, food, lighting or a fireplace.`

Value: `entertaining`

### Option C

**Poolside use and changing weather**

`Shelter, privacy and seasonal flexibility around the pool.`

Value: `poolside`

### Result

Result ID: `outdoor-room`

Destination:

`/outdoor-rooms-auckland`

Optional validated use parameter:

- `?use=everyday`
- `?use=entertaining`
- `?use=poolside`

### Result explanation templates

**Everyday**

`Your best starting point is an outdoor room planned around furniture, circulation and daily use.`

**Entertaining**

`Your best starting point is an integrated outdoor room where roofing, lighting, services and key features are planned together.`

**Poolside**

`Your best starting point is a poolside outdoor room with shelter, changing edges and privacy considered as one design.`

---

## Home branch C: Difficult site

### Question 3

## What is driving the complexity?

### Option A

**The house or roof connection**

`Existing eaves, openings, cladding or an unusual roofline.`

Value: `connection`

### Option B

**Posts, spans or changing levels**

`Restricted structure, circulation, views or difficult geometry.`

Value: `structure`

### Option C

**Plans and project coordination**

`An architect-led renovation or work involving other consultants and trades.`

Value: `coordination`

### Result

Result ID: `bespoke`

Destination:

`/custom-pergolas-auckland`

Optional validated constraint parameter:

- `?constraint=connection`
- `?constraint=structure`
- `?constraint=coordination`

### Result explanation templates

**Connection**

`A bespoke pergola pathway is the best starting point when the house connection must be resolved as part of the design.`

**Structure**

`A bespoke pergola pathway is the best starting point when posts, spans, levels or circulation cannot follow a conventional layout.`

**Coordination**

`A bespoke pergola pathway is the best starting point when the pergola must coordinate with plans, consultants or a wider project.`

---

# Business and venue branch

## Question 2

### What kind of place is it?

### Option A

**Hospitality or customer-facing venue**

`Restaurants, cafes, accommodation or public-facing spaces.`

Value: `hospitality`

### Option B

**Workplace or shared site**

`Covered routes, courtyards, staff areas or common spaces.`

Value: `workplace`

### Option C

**Recreation or specialist setting**

`Sport, entertainment, community or another specialist environment.`

Value: `recreation`

### Presentation

Image-led.

Use governed commercial imagery with clear differences in scale and use.

Initial candidates:

- Hospitality: Good Home Commercial Terrace
- Workplace: KiwiRail Platform
- Recreation: Lilliput Mini Golf

---

## Business Question 3

### How should Sanctuary be involved?

### Option A

**Lead the design and delivery**

`Develop and deliver the complete pergola scope.`

Value: `lead`

### Option B

**Work within an existing team**

`Coordinate with architects, engineers, builders or consultants.`

Value: `collaborate`

### Option C

**Establish feasibility and scope**

`Review the site, intended use and likely delivery pathway.`

Value: `feasibility`

### Result

Result ID: `commercial`

Destination:

`/commercial-pergolas-auckland`

Optional validated parameters:

- `?sector=hospitality|workplace|recreation`
- `&role=lead|collaborate|feasibility`

### Result explanation logic

Combine the selected sector and role into one concise sentence.

Examples:

`A commercial design-and-build pathway is the best starting point for a hospitality venue that needs Sanctuary to lead the pergola scope.`

`The commercial collaboration pathway is the best starting point for a workplace project already supported by consultants.`

`An early commercial feasibility review is the best starting point for a recreation project that still needs its scope defined.`

Do not create nine separate commercial pages.

---

# Architect, designer and builder branch

## Question 2

### What stage is the project at?

### Option A

**Early feasibility or concept**

`The pergola scope is still being shaped.`

Value: `concept`

### Option B

**Developed design or tender**

`Drawings, scope or pricing information are being prepared.`

Value: `developed`

### Option C

**Coordination and delivery**

`The project is moving toward fabrication and installation.`

Value: `delivery`

### Presentation

Type-led.

---

## Professional Question 3

### What do you need from Sanctuary?

### Option A

**Design input and buildability**

`Help resolving form, structure, roofing or interfaces.`

Value: `design-input`

### Option B

**Scope, pricing and responsibilities**

`Clear inclusions, boundaries and delivery roles.`

Value: `scope`

### Option C

**Supply, installation and coordination**

`Delivery within the wider project programme.`

Value: `delivery-coordination`

### Result

Result ID: `professional`

Destination:

`/architects-designers-builders`

Optional validated parameters:

- `?stage=concept|developed|delivery`
- `&need=design-input|scope|delivery-coordination`

### Result explanation logic

Examples:

`Professional collaboration is the best starting point for early design work that needs pergola buildability input.`

`Professional collaboration is the best starting point when a developed project needs scope, pricing and responsibilities confirmed.`

`Professional collaboration is the best starting point when supply, installation and programme coordination are now the priority.`

---

## 9. Final recommendation screen

The result should appear on the same page after the third answer.

### Required content

1. Eyebrow: `Your best starting point`
2. Result heading
3. One concise fit explanation
4. One relevant completed-project image
5. Optional quiet evidence line
6. One primary CTA
7. One quiet `Change answers` action

### Example

**Your best starting point**

# Complete outdoor room

`Your answers suggest a project where the roof, layout, services and changing edges should be considered together.`

Quiet evidence:

`Relevant to: cooking and entertaining`

Primary CTA:

`Explore outdoor rooms`

Secondary control:

`Change answers`

### CTA labels

- Residential cover: `Explore residential pergolas`
- Outdoor room: `Explore outdoor rooms`
- Bespoke: `Explore bespoke pergolas`
- Commercial: `Explore commercial projects`
- Professional: `Explore professional collaboration`

Do not add project links to the result screen. Relevant projects belong on the dedicated landing page.

---

## 10. Dedicated landing-page strategy

Use the existing stable landing pages wherever possible:

| Guided result | Destination route |
|---|---|
| Residential cover | `/pergolas-auckland` |
| Outdoor room | `/outdoor-rooms-auckland` |
| Bespoke or difficult site | `/custom-pergolas-auckland` |
| Commercial | `/commercial-pergolas-auckland` |
| Professional | `/architects-designers-builders` |

Do not create a separate page for every third-answer variation.

### 10.1 Guided context on destination pages

Each destination page should remain complete and useful when opened directly.

When a valid guided parameter is present, add a small context component immediately after the hero:

**Example**

`Your starting point`

`Shelter without losing daylight`

`We'll show relevant acrylic and mixed-roof examples first. Final roofing depends on the house, orientation and measured site.`

Include a quiet link:

`Change answers`

This returns to the guided homepage with the prior answer state restored.

### 10.2 Context must not create SEO duplication

- Base route remains canonical.
- Query variants must not create alternate canonicals.
- Unknown values are ignored.
- No free text is accepted.
- No personal information is stored in the URL.
- The base page remains the primary indexed content.
- Guided context enhances order and emphasis but does not hide essential content.

### 10.3 Project evidence

Each landing page should contain at least three relevant completed projects.

Initial governed project groups:

**Residential cover**

- Dairy Flat Estate
- Mt Maunganui Box
- St Heliers Townhouse or another clear conventional residential example

**Outdoor room**

- Warkworth Outdoor Room
- Riverhead Gable Pavilion
- Tindalls Bay Pavilion

**Bespoke**

- Tindalls Bay Pavilion
- Ardmore Box Carport
- Warkworth Outdoor Room or another technically complex governed project

**Commercial**

- Good Home Commercial Terrace
- Lilliput Mini Golf
- KiwiRail Platform

**Professional**

Reuse the currently governed professional evidence set from `/architects-designers-builders`.

The final project selection must be verified against `apps/marketing/data/projects.ts`.

### 10.4 Landing-page first layer

Each destination should provide, in this order:

1. Clear pathway proposition
2. Guided context, when present
3. Who this pathway suits
4. Three relevant completed projects
5. Likely design or delivery directions
6. One principal constraint or qualification
7. Concise process
8. One consistent enquiry action
9. Optional supporting depth
10. Contextual enquiry form or route

The same CTA label may repeat after evidence and at the end. Do not introduce competing CTA destinations.

---

## 11. Visual design specification

### 11.1 General character

Use the current marketing Foundation UI.

Preserve:

- Instrument Sans display typography;
- Inter body typography;
- current canvas and inverse surfaces;
- existing olive and burgundy accents according to current tokens;
- crisp architectural rules;
- square controls;
- generous but disciplined spacing;
- large completed-project imagery;
- restrained uppercase metadata;
- existing focus-ring treatment;
- existing pressed-state vocabulary.

Do not introduce:

- gradients unrelated to the current hero treatment;
- rounded quiz cards;
- pills as primary choices;
- playful icons;
- illustrative mascots;
- progress bars with gamified styling;
- chat bubbles;
- glossy animation;
- new design-system tokens without need.

### 11.2 Type-led question layout

Use for:

- audience;
- commercial delivery role;
- professional project stage;
- professional need.

Desktop:

- one question heading;
- three large horizontal or columnar choices;
- all choices visible without excessive scrolling.

Mobile:

- full-width option rows;
- minimum 64 px height, preferably 88–112 px where copy allows;
- large option label;
- one short supporting sentence;
- current selection visibly distinct;
- no icons required.

### 11.3 Image-led question layout

Use for:

- residential project type;
- commercial site type;
- other choices only when the image materially improves comprehension.

Desktop:

- three-column grid;
- consistent image framing;
- large media area;
- option label and one sentence.

Mobile:

- one-column stack;
- approximately 4:3 or 16:10 media ratio;
- no horizontal carousel;
- no swipe dependency;
- each card is one large target;
- image, title and supporting copy move as one interactive unit.

Avoid making three portrait cards so tall that the options require excessive searching. The complete set should remain understandable within approximately two to three mobile viewports.

### 11.4 Selected-answer summary

Once a question is answered, collapse it into a quiet summary:

`01  My home  Change`

The summary should:

- remain in DOM order;
- preserve the selected answer;
- provide a 44 px `Change` control;
- avoid repeating supporting copy;
- use a thin rule;
- never look like a second CTA.

### 11.5 Progress

Use restrained textual progress:

`02 / 03`

Do not use a large progress bar.

For business and professional users, the journey is also three questions. The page should not show uncertain or changing totals.

---

## 12. Interaction specification

### 12.1 Selection

Selecting an answer should:

1. visually confirm the selection immediately;
2. store the answer;
3. collapse the completed question;
4. render the next relevant question;
5. update the URL state;
6. move the next question into a comfortable viewport position;
7. announce the new question to assistive technology.

### 12.2 Input semantics

Each question should use:

- `fieldset`;
- a visible or visually hidden `legend`;
- radio-group semantics;
- button-like radio controls or real buttons with complete radio behaviour;
- roving tab index where appropriate;
- Arrow key navigation;
- Home and End keys;
- visible focus;
- `aria-checked`;
- one live region for question/result changes.

Reuse the interaction quality already established in the current homepage's `DesignConversation`.

### 12.3 Focus behaviour

Pointer selection:

- do not unexpectedly move keyboard focus;
- scroll the next question into view only enough to orient the user.

Keyboard selection:

- move focus to the next question heading or first option after the transition;
- preserve visible focus.

Changing an earlier answer:

- remove incompatible later answers;
- return focus to that question;
- update history and URL;
- do not leave stale result content visible.

### 12.4 Motion

Use existing motion tokens.

Recommended behaviour:

- selected-state change: immediate to 120 ms;
- question entrance: approximately 180–260 ms;
- opacity plus a subtle vertical movement no greater than 8 px;
- selected-answer collapse: restrained;
- no full-page wipe;
- no route transition animation;
- no parallax;
- no global smooth scrolling;
- no scroll snapping;
- no decorative delays.

Respect `prefers-reduced-motion` by removing movement and smooth local scrolling.

### 12.5 Native scrolling

The page remains a standard document.

A local `scrollIntoView` may be used to orient the visitor after a selection. It must not lock or override normal touch scrolling.

---

## 13. State, URL and browser history

### 13.1 State goals

The experience must support:

- browser Back through previous answers;
- browser Forward through restored answers;
- refresh without losing a completed path;
- return from a destination page to the completed recommendation;
- direct links to a valid conversation state;
- invalid parameters failing safely to the nearest valid state.

### 13.2 Recommended URL state

Use validated non-personal query parameters.

Examples:

```text
/home-guided?audience=home
/home-guided?audience=home&goal=outdoor-room
/home-guided?audience=home&goal=outdoor-room&use=entertaining
/home-guided?audience=business&sector=hospitality&role=lead
/home-guided?audience=professional&stage=concept&need=design-input
```

Every selection should create a history entry without scrolling the page to the top.

Use the repository's established validated-query and `scroll: false` patterns where appropriate.

### 13.3 Validation

Create pure resolver functions that:

- accept only known enum values;
- remove incompatible downstream values;
- resolve the current question;
- resolve the completed result;
- build the destination URL;
- build the return-to-conversation URL.

Do not infer arbitrary combinations.

### 13.4 Optional session persistence

Session storage may preserve the last completed state when the visitor later returns to `/home-guided` without parameters.

URL state remains authoritative.

Storage failure must not break the experience.

---

## 14. Content model

Keep journey content separate from the rendering component.

Recommended model:

```ts
type GuidedAudience = 'home' | 'business' | 'professional';

type GuidedResultId =
  | 'residential-cover'
  | 'outdoor-room'
  | 'bespoke'
  | 'commercial'
  | 'professional';

type GuidedQuestion = {
  id: string;
  eyebrow?: string;
  title: string;
  treatment: 'type-led' | 'image-led';
  options: GuidedOption[];
};

type GuidedOption = {
  value: string;
  label: string;
  description: string;
  image?: ProjectMedia;
};

type GuidedResult = {
  id: GuidedResultId;
  title: string;
  explanation: string;
  image: ProjectMedia;
  destination: string;
  ctaLabel: string;
};
```

Use project media by reference from the governed project catalogue. Do not duplicate image paths and alt text when they can be resolved from project data.

### Variant name

Use a stable analytics and DOM variant identifier:

`guided_design_conversation_home_v1`

---

## 15. No-JavaScript and resilience

Do not render the complete hidden conversation tree in the initial HTML.

Without JavaScript, provide a concise fallback with five pathway links:

- Residential pergolas
- Outdoor rooms
- Bespoke pergolas
- Commercial pergolas
- Architects, designers and builders

The fallback should contain one short explanation per route and no project galleries.

The normal JavaScript experience should render only:

- completed summaries;
- the current question;
- the result when complete.

Do not request branch images before the branch is selected.

---

## 16. Header and navigation

The guided homepage should preserve:

- Sanctuary brand;
- menu access;
- mobile menu focus containment;
- Escape behaviour;
- scroll locking;
- browser Back behaviour;
- current interaction tokens.

To prevent competing CTAs:

- suppress the desktop `Start your project` header CTA on `/home-guided`;
- keep the menu available;
- do not remove access to other site routes;
- do not create a separate guided-home header component.

Implement this as a narrow route-aware presentation condition in the shared header.

---

## 17. Landing-page context component

Create one shared, optional component for guided context.

Recommended ownership:

```text
apps/marketing/components/guided-journey/GuidedJourneyContext.tsx
apps/marketing/lib/guidedJourneyContext.ts
```

Responsibilities:

- validate known focus parameters;
- provide the human-readable selected focus;
- provide one short explanation;
- provide the return URL;
- optionally provide a governed project-order preference;
- expose non-personal analytics properties;
- render nothing when no valid context is present.

The component must not:

- alter the page canonical;
- duplicate the hero;
- create a second H1;
- hide the base page's core content;
- use free-text query values;
- force client-side layout shift.

Prefer server-rendering the contextual first layer where compatible with current route architecture. If client enhancement is used, reserve layout space or render a stable default to avoid CLS.

---

## 18. Enquiry context

The guided journey should preserve enough non-personal context to understand which pathway produced an enquiry.

Minimum required analytics context:

- experience variant;
- audience;
- pathway result;
- final focus;
- destination;
- source route.

For form and lead attribution, use the current enquiry context architecture where possible.

Do not place:

- name;
- phone;
- email;
- address;
- free-text project details;
- file names

in the URL or analytics.

A later bounded change may extend the validated enquiry context with:

- `source_experience: guided-home-v1`
- `source_pathway`
- `source_focus`

This should be backward-compatible and is not required to block the first visual prototype.

---

## 19. Analytics plan

Reuse the current consent-aware `dataLayer` pattern.

Do not add a new analytics vendor.

### Events

#### `guided_home_view`

Measure when the interactive experience is available.

Properties:

- `homepage_variant`
- `viewport_category`
- `source_path`

Decision supported:

- compare reach and completion by device class.

#### `guided_home_answer`

Measure one accepted answer.

Properties:

- `question_id`
- `answer_id`
- `step_number`
- `audience`
- `homepage_variant`
- `viewport_category`

Decision supported:

- identify unclear questions or options with abnormal abandonment.

#### `guided_home_question_view`

Measure when a new question becomes the active decision.

Properties:

- `question_id`
- `step_number`
- prior selected IDs

Decision supported:

- calculate question-to-question continuation.

#### `guided_home_result_view`

Measure one completed recommendation.

Properties:

- `result_id`
- `focus_id`
- `audience`
- `answer_path`
- `homepage_variant`

Decision supported:

- understand pathway demand and result completion rate.

#### `guided_home_result_click`

Measure the primary destination CTA.

Properties:

- `result_id`
- `focus_id`
- `destination`
- `homepage_variant`

Decision supported:

- measure result-to-landing-page progression.

#### `guided_home_change_answer`

Measure editing an earlier answer.

Properties:

- `question_id`
- `previous_answer_id`
- `step_number`

Decision supported:

- identify unclear or low-confidence distinctions.

#### `guided_home_reset`

Measure explicit restart.

Decision supported:

- identify journeys that fail to produce confidence.

### Funnel measures

Track:

1. Guided homepage views
2. First answer rate
3. Question 2 continuation
4. Result completion
5. Result CTA rate
6. Landing-page enquiry CTA rate
7. Form start rate
8. Successful enquiry rate
9. Pathway-specific conversion rate
10. Return-to-guided-home rate

Do not use raw scroll depth as a success metric.

---

## 20. Performance requirements

### 20.1 No new heavy dependency

Do not add Framer Motion, a carousel library, a state-management package or another UI library.

Use React, current Foundation components and CSS.

### 20.2 Branch payload

Only the current branch should render.

Do not include every branch's full image markup in hidden DOM.

### 20.3 Image loading

- Keep the hero image eager and correctly sized.
- Load image-led question media only when that question becomes relevant.
- Use governed alt text.
- Use accurate `sizes`.
- Avoid loading destination-page project galleries from the homepage.
- Prefetch the final destination through the primary Next link where appropriate.

### 20.4 Performance budgets

The experimental route should:

- add no more than approximately 15 KB gzip of route-specific JavaScript over the current homepage without written justification;
- produce no horizontal document overflow;
- keep measured CLS at or below 0.05 in the production build;
- avoid a mobile lab LCP regression greater than 10% from the current homepage baseline;
- introduce no long main-thread task above 200 ms during a normal three-answer journey;
- retain immediate pressed-state feedback;
- perform no network request for unselected branch images.

These are implementation targets, not claims about field performance.

---

## 21. Accessibility requirements

Meet WCAG 2.2 AA principles where applicable.

Required:

- one H1;
- logical heading order;
- semantic question groups;
- meaningful option names;
- visible focus;
- 44 px minimum touch targets;
- no colour-only selected state;
- live announcement of the active question;
- live announcement of the final result;
- keyboard Arrow, Home and End support;
- reduced-motion support;
- no focus trap;
- no hidden focusable branch content;
- no inaccessible image-only options;
- 200% zoom without horizontal document scrolling;
- portrait and landscape support;
- result CTA with a specific accessible name;
- `Change answer` controls that identify the question being changed.

Recommended announcement:

`Question 2 of 3. What are you trying to create?`

Result announcement:

`Your best starting point is Complete outdoor room.`

---

## 22. Responsive requirements

Test at minimum:

- 320 × 700
- 360 × 800
- 375 × 812
- 390 × 844
- 430 × 932
- short-height mobile viewport
- representative tablet
- 1024 px compact desktop
- 1440 px desktop

### Mobile goals

- Question 1 is understandable within the first viewport.
- Option text never overlays an important image detail.
- No choice relies on hover.
- Type-led options remain easy to scan.
- Image-led cards remain large enough to communicate the project.
- The result CTA remains visible without being sticky.
- Browser chrome changes do not clip the hero or active question.
- Safe-area insets are respected where relevant.

### Desktop goals

- The experience remains one coherent conversation.
- Do not spread a single question across excessive empty space.
- Image-led options can use a three-column composition.
- Type-led options should feel editorial, not like a form table.
- The current question remains the clear dominant object.

---

## 23. Testing requirements

### 23.1 Unit tests

Cover:

- every valid answer branch;
- all five result IDs;
- invalid parameter removal;
- incompatible downstream-answer removal;
- destination URL construction;
- return URL construction;
- result explanation selection;
- no dead ends;
- no question with more than three options.

### 23.2 Component tests

Cover:

- initial question;
- answer selection;
- selected summary;
- change-answer behaviour;
- result rendering;
- keyboard navigation;
- live-region output;
- reduced-motion class or behaviour;
- no unselected branch media markup.

### 23.3 Playwright

Create a focused spec, for example:

`playwright/marketing.guided-homepage.spec.ts`

Cover:

1. Route is noindex and excluded from sitemap.
2. Current `/` remains unchanged.
3. All three top-level audience paths complete.
4. Every homeowner branch resolves.
5. Business sector and role resolve.
6. Professional stage and need resolve.
7. Browser Back and Forward step through answers.
8. Refresh restores the URL state.
9. Changing Question 1 clears incompatible later answers.
10. Result CTA reaches the correct dedicated landing page.
11. Destination page shows valid guided context.
12. Invalid context is ignored.
13. Mobile has no horizontal overflow.
14. Every option is at least 44 px.
15. Focus order is logical.
16. Reduced motion removes movement.
17. Unselected branch images are not requested.
18. Header CTA is suppressed on the guided route.
19. Global menu still works.
20. No duplicate IDs or page errors.

### 23.4 Visual review

Capture:

- first question at 390 px;
- homeowner image-led Question 2 at 390 px;
- one type-led Question 3;
- one recommendation;
- commercial path;
- professional path;
- 1440 px equivalents.

Review:

- image crops;
- text line breaks;
- option balance;
- spatial rhythm;
- transition quality;
- visible hierarchy;
- CTA competition;
- footer transition.

### 23.5 Usability testing

Recommended sample:

6–8 participants:

- 3 first-time homeowners;
- 1 straightforward price-conscious homeowner;
- 1 design-conscious homeowner;
- 1 commercial operator;
- 1 architect, designer or builder;
- at least one returning visitor profile.

Core tasks:

- Find the right path for a conventional deck cover.
- Find the right path for a timber-lined outdoor room.
- Find the right path for a difficult roof connection.
- Find the commercial route for a restaurant.
- Find the collaboration route for an architect.
- Change an earlier answer.
- Return from the landing page.
- Explain what Sanctuary is likely to do next.

Success criteria:

- correct path reached without moderator help;
- result reached in three choices;
- no confusion between `straightforward` and `low quality`;
- no assumption that the recommendation is a final technical design;
- result CTA destination is expected;
- participants can explain why the suggested page is relevant.

---

## 24. Implementation programme

Implement the work as **four sequential, bounded PRs**, followed by one substantial validation and refinement PR.

This structure is intentional. PRs 1–4 establish the complete end-to-end experience in controlled stages. PR 5 then evaluates and refines the whole journey as one connected system:

`guided homepage → recommendation → dedicated landing page → relevant projects → enquiry`

Do not combine PRs 1–4 into one undifferentiated change. Each PR must remain independently reviewable, retain a green baseline and leave the repository in a coherent state. The complete product-quality judgement is reserved for PR 5.

### Programme rules

- Complete PRs 1–4 in order.
- Do not begin a later PR until the preceding PR meets its minimum acceptance gates.
- Preserve the live `/` homepage throughout PRs 1–4.
- Run focused automated checks in every PR rather than deferring all testing to PR 5.
- Record visual evidence at the end of PR 3 before integrating destination pages.
- Use PR 5 to refine copy, imagery, pacing, responsive composition and destination continuity across the full journey.
- Do not use PR 5 to reopen sound architecture without evidence from testing.

# PR 1: Establish the experimental owner

### Scope

- Duplicate the current homepage owner into a new guided-home owner.
- Add `/home-guided`.
- Keep `/` unchanged.
- Add noindex and sitemap exclusion.
- Preserve current shared UI rather than duplicating it.
- Add route identity and baseline tests.

### Minimum acceptance gate before PR 2

- Experimental route renders.
- Current homepage has no visual or semantic change.
- Marketing typecheck and production build pass.
- Preview route is not indexable and is excluded from the sitemap.
- No shared component, project-data or design-token duplication is introduced.

---

# PR 2: Guided conversation foundation

### Scope

- Create the config-driven question tree.
- Implement URL state and pure resolver functions.
- Implement all type-led questions.
- Implement selected summaries.
- Implement Back, Forward, refresh and change-answer behaviour.
- Implement the concise no-JavaScript fallback.
- Add consent-aware analytics events.
- Wire all five results to their dedicated existing landing-page routes without yet adding destination-page contextualisation.

### Minimum acceptance gate before PR 3

- All five results resolve in three choices.
- Every valid branch has automated coverage.
- No dead ends or incompatible persisted states remain.
- URL state is validated and personal information is excluded.
- Keyboard, focus and live-region behaviour pass focused tests.
- Refresh, Back and Forward restore the expected state.
- Only the active branch is rendered.

---

# PR 3: Image-led decisions and complete visual experience

### Scope

- Add governed project imagery to homeowner Question 2 and business Question 2.
- Refine the duplicated hero into Question 1.
- Remove competing homepage CTAs.
- Add final recommendation imagery.
- Apply restrained transition behaviour using existing motion tokens.
- Suppress the shared desktop header CTA only on the guided route.
- Complete responsive composition at all required widths.
- Refine selected-answer summaries, progress treatment and the result state.

### Minimum acceptance gate before PR 4

- Product-owner visual review is completed for representative mobile and desktop captures.
- Images communicate the intended distinctions rather than merely decorating the choices.
- No unselected branch image requests occur.
- No new animation or UI dependency is introduced.
- Reduced-motion behaviour passes.
- No horizontal overflow, duplicate IDs or undersized primary targets occur.
- The route-specific JavaScript and LCP/CLS budgets remain within the specification.
- The experience feels calm and coherent before destination-page work begins.

---

# PR 4: Dedicated landing-page continuation

### Scope

- Add the shared guided-context resolver and component.
- Integrate it with the five destination pages.
- Validate all focus, use, constraint, sector, role, stage and need parameters.
- Add return-to-conversation links with prior state restored.
- Reorder or emphasise governed project evidence where the selected context materially improves relevance.
- Preserve complete direct-entry versions of every landing page.
- Preserve base canonicals and avoid new duplicate pages.
- Carry appropriate non-personal analytics and enquiry context.

### Minimum acceptance gate before PR 5

- Every result lands on the correct dedicated page.
- Guided context appears immediately after the hero where valid.
- Direct visits remain complete and understandable.
- Invalid context disappears safely.
- Canonicals remain the base routes.
- No duplicate landing pages are created.
- Relevant completed projects appear as evidence and are ordered appropriately.
- Returning to `/home-guided` restores the completed recommendation.
- Enquiry pathways retain the correct audience and source context.

---

# PR 5: Comprehensive validation and refinement

PR 5 is a deliberately broad finishing pass. It must validate the full system and make evidence-led refinements required to reach the intended 10/10 experience.

### Validation scope

- Complete every homeowner, business and professional branch.
- Test 320, 360, 375, 390 and 430 px mobile widths.
- Test short-height mobile, representative tablet, compact desktop and 1440 px desktop.
- Test browser Back, Forward, refresh, deep links and return from destination pages.
- Complete keyboard-only review.
- Review screen-reader semantics and live announcements.
- Verify reduced-motion behaviour.
- Review every image crop and the communication purpose of each image.
- Review question wording, result wording and landing-page continuation.
- Review touch targets, focus states, pressed states and transition timing.
- Inspect branch-image network requests, route-specific JavaScript, LCP and CLS.
- Validate analytics event shape and non-personal enquiry context.
- Run the full relevant marketing test suite, typecheck and production build.
- Complete lightweight usability testing using the participant and task plan in this document.

### Permitted refinement scope

PR 5 may refine:

- question labels and supporting sentences;
- image selection and object positioning;
- line breaks and typography sizing;
- option proportions and spacing;
- selected-summary treatment;
- animation timing within established tokens;
- recommendation explanations;
- contextual landing-page copy;
- landing-page project order;
- responsive composition;
- focus and announcement details;
- analytics properties where the measurement decision is clear.

### Changes that require separate evidence

Do not use PR 5 to:

- replace the core branching architecture;
- introduce a new design system;
- add a new state-management or animation dependency;
- create new destination pages for individual answer combinations;
- redesign unrelated marketing routes;
- promote the experiment automatically.

### Final acceptance

- No P0 or P1 usability defect remains.
- All five pathways complete without moderator assistance.
- No serious accessibility problem remains in automated and manual review.
- Performance has not materially regressed against the current homepage baseline.
- Users understand that the result is a `best starting point`, not a final technical solution.
- `Straightforward cover` does not read as low quality or budget work.
- Every destination continues the exact conversation the user just completed.
- Relevant projects are visible early on every destination page.
- Browser history and return behaviour feel predictable.
- Product owner approves image selection, copy, pacing, responsive composition and destination relevance.
- A promotion recommendation is documented: promote, refine further or retain as an experiment.

Do not promote automatically merely because automated tests pass.

---

## 25. Definition of done

The guided homepage is ready for promotion only when:

- the current root remained stable during development;
- Question 1 is immediately visible;
- most users reach a result in three selections;
- no question has more than three options;
- no competing primary CTA is visible;
- every result has one dedicated landing-page destination;
- relevant projects are shown on destination pages rather than used as final destinations;
- browser Back, Forward and refresh preserve state;
- changing an answer clears incompatible state;
- the experience is fully keyboard operable;
- focus and live announcements are understandable;
- reduced motion is respected;
- mobile widths from 320 to 430 px have no horizontal overflow;
- no unselected branch image payload is loaded;
- no new heavy dependency was added;
- base landing pages remain useful without guided context;
- query variants do not create SEO duplication;
- analytics contain no personal information;
- marketing tests, typecheck and production build pass;
- user testing finds no repeated pathway confusion;
- the product owner approves the experience as calm, clear, editorial and consistent with Sanctuary's marketing UI.

---

## 26. Explicit non-goals

Do not:

- replace the live homepage in the first implementation;
- redesign the global marketing site;
- create a separate mobile website;
- create a chatbot;
- build an exact technical configurator;
- quote a price from the homepage;
- promise a final roof or structural solution;
- create a separate landing page for every answer combination;
- add a carousel for question options;
- add scroll-jacking or snap scrolling;
- add a new animation library;
- add new analytics vendors;
- move all service content onto the homepage;
- remove the project index, products, guides or normal navigation;
- hide required supporting information merely to make pages shorter;
- create a second header implementation;
- duplicate project data or shared UI.

---

## 27. Product-owner review checklist

### Copy

- Does every option use customer language?
- Does `straightforward cover` feel refined rather than inferior?
- Is any answer technically overconfident?
- Can each support line be read quickly?
- Does each result explain fit without claiming certainty?

### Images

- Does each image communicate the distinction?
- Are straightforward projects represented attractively?
- Do complex projects visibly show why they are complex?
- Is commercial scale obvious?
- Are all mobile crops strong?

### Interaction

- Is the next step obvious without instruction?
- Does the page feel calm rather than empty?
- Is the transition immediate but refined?
- Does changing an answer feel safe?
- Does browser Back behave as expected?

### Destination fit

- Does the dedicated page continue the exact conversation?
- Are relevant projects visible early?
- Is the primary CTA consistent?
- Is the final page still useful when entered directly?

### Brand

- Does it feel like Sanctuary?
- Is it premium because it is controlled and specific?
- Has novelty been avoided where clarity is stronger?
- Does the experience communicate both design capability and practical delivery?

---

## 28. Final implementation judgement

This concept should be implemented as a bounded experimental homepage, not as a speculative rebuild.

The strongest version will:

- reuse the current homepage and Foundation UI;
- remove competing homepage pathways;
- ask one useful question at a time;
- use images only when they clarify the decision;
- use large typography when the distinction is conceptual;
- give a recommendation after three choices;
- lead to one of five stable landing pages;
- continue the chosen context with relevant project evidence;
- preserve direct navigation, accessibility, SEO and native browser behaviour.

The quality target is not `a more impressive quiz`.

The quality target is a calm, highly specific design conversation that makes the website feel as though Sanctuary understands the visitor's project before asking them to enquire.
