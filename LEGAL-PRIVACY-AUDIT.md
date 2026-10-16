# SEVEN privacy/legal implementation audit — 2026-10-16

This is an engineering audit and implementation record, not legal advice or a certification of compliance. Applicable law depends on the operator, audience, countries served and actual practices. The social-media video's dollar figures are not automatic fines for every app/user/message.

## Implemented technical changes

- Optional operational analytics now require an explicit device-local opt-in. No consent means no visitor ID creation, analytics requests or server-side event/download writes. Missing privacy code/storage fails closed. Existing visitor IDs are removed when analytics are off.
- DNT and Global Privacy Control override opt-in. Revocation stops future optional events, clears buffered optional playback counters and removes the local visitor ID. It does not promise deletion of historical aggregates or already-completed requests.
- The `seven_optional_analytics` preference cookie stores only allow/deny for 180 days, SameSite=Lax, Secure over HTTPS. It is not an identity or authentication credential. No automatic consent popup has been introduced: optional SEVEN analytics stay off until requested through Privacy choices. Consent requirements for third-party players or other processing need separate review.
- Privacy choices are available from the app footer, signup data-use link, Privacy & security settings, static download footer and `privacy.html`. The page explains essential account storage, profile photos/history, Supabase, Cloudflare, Brevo, TMDB artwork and independent trailer/player services. It is a factual control panel, **not** a complete operator privacy policy.
- Personal progress, profile viewing recaps, account/session security, saved titles and durable settings synchronization remain functional without optional analytics.

## Findings and limits

| Video issue | Repo finding / action |
| --- | --- |
| Google-hosted fonts | No remote Google font stylesheet or font file found in first-party pages/styles. System fonts are already used; CSP restricts font sources to self/data. TMDB images and playback services are separate external requests and are disclosed. |
| Session replay / every keystroke | No session replay SDK found. The first-party metrics client sends only visits, download platforms and bounded playback-time events. No form fields/keystrokes are included. Third-party embedded players were **not** certified free of tracking. |
| Marketing email / unsubscribe | No marketing/waitlist sender found in the repository. Current SMTP templates handle signup verification and security codes. Do not add a misleading unsubscribe that disables essential account-security messages. Any future promotional stream needs separate consent/opt-out, suppression handling, truthful sender details and a valid business postal address where required. Brevo's dashboard campaigns were not independently audited. |
| Stripe automatic renewal | No Stripe billing or recurring-payment checkout found. No renewal UI was invented. Before introducing billing, review the actual applicable disclosure, cancellation, consent and notice requirements. |
| Age / children | No account-owner age screen currently exists. COPPA concerns children **under 13**, not an automatic fine for the first 13-year-old. The minimum account-owner age is pending the owner's decision. Kids profiles collect names/photos/history and require a separate audience/parental-consent/retention and third-party-player assessment; an adult checkbox or parent PIN is not verifiable parental consent. |
| Avatar copyright / agent | Uploaded photos are resized client-side and stored in account settings, rather than a public upload gallery. The user is reminded to use owned/permitted images. A DMCA agent is one condition of relevant US safe-harbor protection, not blanket immunity and not a substitute for rights to movies, artwork or streams. No registration, fee payment, public identity/address disclosure or legal representation was performed. |

## Owner / counsel decisions still required

1. Choose a minimum age for new account owners and the policy for child profiles. Decide whether child profiles can be offered at all before lawful parental-consent and third-party processing arrangements are established. An app-only age field must not be advertised as bypass-proof: public Supabase signup also needs an appropriate provider-side hook/policy before claiming full backend enforcement.
2. Supply the actual operator legal identity, operating jurisdiction and authorized public privacy/copyright contact. Complete an accurate privacy notice with purposes, legal bases where relevant, providers/transfers, retention, rights and contact procedures. Do not fabricate addresses or publish the owner's personal email without approval.
3. Establish an operational data-rights process (access/export/deletion and retention, including backups/provider logs), not merely a policy promise. Existing profile/history removal is not advertised as full account deletion.
4. If seeking a DMCA safe harbor, obtain advice on eligibility and all required practices, designate an authorized agent, publish the required contact and register/renew it properly. The Copyright Office currently lists a $6 designation/amendment/resubmission fee and renewal within three years. Owner authorization and public contact/address information are required.
5. Independently verify licensing/authorization for all supplied playback, poster and trailer content. A TMDB API attribution or embedding an external player does not itself establish playback rights. No conclusion about existing rights was made by this audit.
6. Review the Supabase/Brevo/hosting configuration, contracts, current account inventory and existing underage data with counsel. No existing accounts or data were deleted/blocked as part of this change.

## Primary references reviewed

- FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC 2025 COPPA amendments (general compliance deadline April 22, 2026): https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments
- FTC CAN-SPAM guide (primary-purpose distinction for transactional messages): https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- US Copyright Office DMCA directory: https://www.copyright.gov/dmca-directory/
- US Copyright Office registration/fees/renewal FAQ: https://www.copyright.gov/dmca-directory/faq.html
- California Attorney General's September 2025 automatic-renewal guidance, for any future billing rollout: https://www.oag.ca.gov/news/press-releases/attorney-general-bonta-issues-consumer-alert-california%E2%80%99s-automatic-renewal-law

## Verification

The automated tests cover consent absent/declined/allowed, DNT/GPC overrides, malformed/spoofed cookie names, server no-write behavior, download redirects without consent, opt-in/revocation/reload, client storage failure, modal keyboard behavior, guest/signup/settings entry points, local personal recaps and cross-device settings regressions. No real underage account, marketing campaign, paid subscription or DMCA designation is created by these tests.
