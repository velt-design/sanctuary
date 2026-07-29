# Marketing Claims Register

Status: active approval register for public marketing copy.

Public copy must not state a numeric or categorical claim from this register until the evidence, limitation, owner and review date are complete. Internal estimate data, project notes and old sales copy are not approval by themselves.

The July 2026 guide-cluster pass removed ungoverned headline durations, combined warranty durations, category-wide UV and heat outcomes, generic span ranges, numeric wind thresholds, broad maintenance comparisons and absolute wind or rain language from indexable marketing pages. The final refinement also replaced homepage material scores with written considerations, qualified lighting and heater performance, aligned linked project detail with the current project summaries and removed unsupported blind-control detail. A browser regression reads every route in the generated sitemap. Those surfaces now use proposal-stage or exact-product wording until an owner approves evidence here. The outdated brochure endpoint is retired to the governed web guide library rather than treated as current claim evidence.

The 29 July 2026 follow-up retires the separate `/start` and `/start/explore`
flows instead of maintaining a second public conversion system. Claims checks
and manual review continue to cover every public acquisition surface, including
any future noindex entry flow. The retired acrylic v2 route permanently
redirects to the governed primary route and is no longer a second copy surface.
Every Pending or project-specific status below is unchanged.

| Claim area | Public wording status | Evidence required | Important limitation | Approval owner | Review date | Applies to |
| --- | --- | --- | --- | --- | --- | --- |
| Pergola price bands and examples | Pending approval. Do not publish a number. | Dated set of representative projects and current sell pricing, with scope and outliers identified. | State GST treatment, inclusions, exclusions, engineering, consent, site access and accessories beside every band. | Sanctuary commercial lead and finance | Pending | Cost guide and any page mentioning price |
| Service area and Auckland base | Approved for qualitative use. Sanctuary is Auckland based and considers selected projects up to about a three-hour drive away when the project is a good fit. The Auckland address is a staffed base of operations; customers should contact the team before visiting. | Sanctuary leadership confirmation of current travel and office practice. | Do not promise that every project inside the travel area will be accepted, describe the base as a showroom, or guarantee that a particular staff member is available without an appointment. | Sanctuary leadership | 2026-07-29 | Footer, service-area copy, contact details and structured data |
| Louvre supply position | Pending approval. Do not present louvres as a Sanctuary product. | Current product-range decision and any supplier or delivery arrangement. | Separate Sanctuary fixed-roof approaches from external louvre proposals until confirmed. | Sanctuary product and leadership | Pending | Acrylic vs Louvre, forms and product navigation |
| Workmanship warranty | Pending approval. Do not publish a duration. | Current signed warranty terms and exclusions. | Keep workmanship separate from product, coating, electrical and accessory warranties. | Sanctuary leadership and legal | Pending | All service pages, footer and sales material |
| Product and coating warranties | Pending approval. Do not combine into one Sanctuary warranty. | Current manufacturer schedules for each specified product and finish. | Terms vary by product, exposure, installation and maintenance. | Sanctuary product lead | Pending | Product pages and guides |
| Design, manufacture and installation timing | Pending approval. Do not publish a general duration. | Current operational lead-time data by project stage and project type. | Scheduling, design development, approval, material and site readiness can change the programme. | Sanctuary operations | Pending | All service pages and forms |
| Acrylic ultraviolet or heat performance | Pending approval. Do not publish percentages or broad comfort outcomes. | Current manufacturer data for each offered sheet specification. | Product, colour, thickness, orientation and project composition affect the result. | Sanctuary product lead | Pending | Acrylic product and comparison pages |
| Waterproof or all-weather performance | Pending approval. Avoid absolute language. | Product documentation plus defined drainage, junction and operating conditions. | Roofs, open edges, louvres, blinds and unusual weather behave differently. | Sanctuary design and product leads | Pending | Roof, blind and outdoor-room pages |
| Wind, span and structural capacity | Project-specific. Do not publish a general threshold. | Project engineering or approved system documentation for the exact assembly. | Site exposure, geometry, connection, material and loads determine the answer. | Sanctuary design lead and project engineer | Per project | Aluminium, form, custom and commercial pages |
| Coastal suitability and maintenance | Pending approval. Use conditional project language only. | Coating-system documentation and current care schedule by exposure zone. | Finish, cut edges, dissimilar metals, cleaning and local exposure matter. | Sanctuary product lead | Pending | Aluminium and product pages |
| Consent or approval outcome | Project-specific. Do not promise exemption or approval. | Current planning and building-control advice for the actual site and design. | Size, height, boundary, attachment, use and existing conditions can change requirements. | Sanctuary design lead and relevant authority | Per project | All service and guide pages |
| Commercial design-and-build scope | Approved for qualitative use. Sanctuary designs internally, coordinates the project engineer and connected trades, manages the building-consent process where required, project-manages delivery, and builds and installs the pergola. | Sanctuary leadership confirmation of the current delivery model. | Do not imply that external engineers or trades are Sanctuary employees, that every project needs consent, that consent will be granted, or that every venue can operate continuously through installation. | Sanctuary leadership | 2026-07-25 | Commercial page, directory and related sales material |
| Published project dimensions and accessory detail | Use only the current project record and avoid stronger hidden legacy detail. | Approved project file, drawings or as-built record for each published example. | KiwiRail currently records a 30.0 m by 3.0 m plan and 115 m² total area; the basis of the larger total needs confirmation. Screen or blind product and control detail must not be inferred from a generic project tag. | Sanctuary project and marketing leads | Pending for identified records | Project pages and guide evidence cards |

The project record now separates the client constraint, roof approach, optional verified configuration and supported material list from narrative copy. `apps/marketing/data/projects.claims.test.ts` includes those fields in the evidence snapshot. Presentation helpers omit missing year, footprint, pitch, finish or configuration values instead of inferring them; Warkworth is the only current record with a verified `Freestanding` configuration.

## Editorial fallback

When an approved claim is unavailable:

- explain which project variables change the answer;
- state what Sanctuary needs to assess it;
- link to the relevant guide, product or service page;
- avoid a placeholder number or an implied guarantee; and
- record the approval dependency in this register rather than hiding it in page copy.
