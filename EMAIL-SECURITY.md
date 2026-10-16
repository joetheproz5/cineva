# Email verification and sign-in checks — build 380

## Delivery and signup

Supabase sends through Brevo's free transactional SMTP plan (300 emails/day), using the sender the owner verified. Credentials are stored only in Supabase's SMTP settings, not in this repository or browser storage. SMTP IP restrictions remain enabled: only the observed, explicitly approved Supabase sending address 54.65.180.56 was authorized. If the provider changes its outbound address, authorize the newly verified source rather than removing IP restrictions. Delivery to the owner's inbox was confirmed before enabling signup confirmation.

The confirmation email includes a six-digit code and a normal confirmation link. Supabase's Site URL is https://seven-9fm.pages.dev/ (the old localhost fallback was corrected). The PWA keeps its pending screen, accepts the code without a browser switch, and offers a throttled resend. After confirmation it returns to sign-in; onboarding follows the verified sign-in. Existing accounts/sessions are not retrospectively unconfirmed. Provider configuration (not a client checkbox) enforces signup confirmation.

The Magic link / OTP template is code-only for SEVEN's sign-in checks. Never add a magic-link bypass to the email-security modal. Keep the email templates in Web/email-templates in sync with the dashboard.

## Two independent account-security options

Only the main profile exposes the controls. Authenticator app uses native Supabase TOTP and AAL2. Email verification is a separate SEVEN-managed second step: it **does not** pretend that an email OTP is native AAL2. If both are enabled, both are required. Email is less independent than an authenticator because it is also the account's recovery channel; prefer an authenticator for stronger protection.

Email enrollment and removal require the current password plus an emailed code. The server verifies the primary session with Supabase, requires a password AMR claim, checks an active session, and requires native AAL2 too when an authenticator is enrolled. An ordinary passwordless OTP session cannot enroll, disable, or satisfy the original password-authenticated session's email requirement.

Supabase owns code generation, delivery and one-use code validation. SEVEN never generates/stores plaintext codes. Verification creates a temporary provider AAL1 session: the server revokes it, never returns it or stores its refresh credential, and privately authorizes only the original password session. Refresh preserves that session's proof. Switching email, enabling protection again, revoking a device or ending the provider session invalidates applicable proofs.

Private, RLS-enabled tables contain opt-ins, session proofs and challenges. No anonymous/authenticated role can read or write them or execute the privileged RPC. The existing restrictive data policies and guarded RPCs call the combined assurance helper; server account APIs do too. There is a 60-second resend cooldown, 10-minute challenge lifetime, six-attempt maximum, shared IP/user limits and single-use challenge consumption. Missing security infrastructure fails closed. Existing users remain opted out until they explicitly enable it.

Scope: the email policy protects SEVEN's account APIs and guarded database data. It is not a new native Supabase factor, does not change Supabase's AAL claim, and does not claim to replace the provider's identity-management/recovery rules. Supabase Auth identity metadata remains accessible under Supabase's own authorization rules, as before; use native authenticator MFA for provider-level AAL2. A future migration of account preferences out of Auth metadata would further reduce that surface. No service-role credentials or security opt-in flags are placed in user-editable metadata.

## Deployment and testing

Apply Web/supabase-email-security.sql after Web/supabase-auth-security.sql before publishing build 380. Do not subsequently replace the combined assurance helper with the older migration's definition. SQL installation does not enable email protection for anyone.

- Web/qa/email-security-transaction.sql: real database, rollback-only privilege/session/replay/email-change assertions. No real users are altered.
- Web/tests/email-security.test.js: password/main-profile gates, invalid/reused codes, account API enforcement, independent authenticator requirements, delivery/store failure, generic resend and no OTP-session leakage.
- Web/qa/email-security.cjs: actual handlers with isolated provider fixtures at 1440/390/320px; signup code/resend, email enrollment, combined authenticator+email sign-in, disable and storage hygiene.
- Existing authentication, settings-sync, settings UI and Undo suites remain applicable. Native hardware launch/keyboard behavior is a manual follow-up, not claimed by headless tests.

Provider references: https://supabase.com/docs/guides/auth/auth-mfa and https://supabase.com/docs/guides/auth/auth-smtp.
