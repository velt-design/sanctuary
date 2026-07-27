# PDR-01 production evidence

- Date: 27 July 2026
- Pull request: `#29`
- Protected preview release: `947c701d514fc4c9c84ca3980d9dd4fdeeb754df`
- Production release: `a9011d88e0d7f673dfa214b36211116f3c2826a8`
- Production origin: `https://www.sanctuarypergolas.co.nz`

The preview and production audits each passed 24 of 24 normal and
cache-busted primary-route responses with one exact release. Production also
passed 36 of 36 browser cases across 12 routes at 430, 390 and 360 px.

`route-measurements.json` records the route, viewport, release, response,
layout, image, request, target-size and supporting lab timing results.
Screenshots cover the homepage, custom, commercial, professional and Contact
routes at every required width, plus four supporting route states.

Merging `main` triggered the production deployment. No manual cache purge was
needed. No real enquiry was sent, and no personal information or credentials
are stored here. Physical iOS, Android, VoiceOver and TalkBack testing remains
deferred under the later programme gates.
