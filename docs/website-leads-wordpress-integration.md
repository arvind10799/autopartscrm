# Website Leads: WordPress connection

The CRM side is prepared locally. Do not point live WordPress forms at this endpoint until the CRM migration, backend, and frontend have been deployed to AWS.

## WordPress administrator steps

1. In WordPress admin, identify every quote or part-request form that should reach the CRM. The public pages currently show WPForms 7 and 2463 plus custom quote popups. Confirm IDs and field names in WPForms because public markup may change.
2. The part-request and support/contact pages currently appear to share WPForms 2463. Clone the part-request form, embed the clone on the part-request page, and leave the support/contact form on its existing path. The support/contact page and its popups must not be connected to Website Leads.
3. Install a server-side bridge plugin. For selected WPForms IDs, use the successful-submission `wpforms_process_complete` hook. WPForms Lite can return entry ID 0, so generate and persist an independent UUID for each accepted submission.
4. Change the custom quote forms that currently send directly from the browser to third-party services so they submit to a WordPress handler. Retain the current visitor confirmation and email notification while validating the new CRM delivery. Do not place the signing secret in JavaScript or a hidden form field.
5. The bridge should save an outbox item before sending. Retry delivery on temporary failure, retaining the same `externalSubmissionId` while generating a fresh timestamp and signature for every attempt. The CRM treats repeated IDs as one inquiry. Configure a reliable scheduled runner on the WordPress host if ordinary WP-Cron is not frequent enough.
6. Keep existing spam protection, validate submitted data, and preserve the actual SMS opt-in choice. Only approved quote and part-request forms should be queued.

For the custom quote form visible on the public home page, the current field names suggest this starting map. Confirm each field in WordPress before enabling it:

| Website field | CRM intake field |
| --- | --- |
| `name` | `customerName` |
| `Phone_Number` | `customerPhone` |
| `email` | `customerEmail` |
| `Zip_Code` | `zipCode` |
| `VIN_Searched` | `vin` |
| `Vehicle_Year`, `Vehicle_Make`, `Vehicle_Model` | `vehicleYear`, `vehicleMake`, `vehicleModel` |
| `Vehicle_Part` | `partRequested` |
| `SMS_Opt_In` | `smsOptIn` (actual checkbox state as a boolean) |

Map WPForms fields by their configured field IDs after the part-request form has been cloned. Set `source` to `QUOTE` or `PART_REQUEST`, `sourceFormId` to the stable form ID, and `sourcePageUrl` to the actual page where the customer submitted it. Exclude every submission originating on the support/contact page.

## Server configuration

- AWS backend: set `WEBSITE_LEADS_SIGNING_SECRET` to a random secret of at least 32 characters in `backend/.env` or the deploy process environment; restart the backend after configuration. The repository's AWS deployment script writes `backend/.env` on each deploy, so pass the secret to that script too. Keep it out of source control.
- WordPress host: configure the same secret and the **public** intake URL `https://crm.meeautoparts.com/api/website-leads/intake` in `wp-config.php` or host-managed environment variables. The public Next.js route forwards the exact signed request bytes to the private NestJS backend. WordPress must not call `127.0.0.1:3000` or the backend's private URL.
- Confirm outbound HTTPS from WordPress to `crm.meeautoparts.com` with TLS certificate validation. No CRM user login token or browser CORS setting is needed.

For the future WordPress bridge, the server-side configuration can be expressed as:

```php
define( 'CRM_WEBSITE_LEADS_URL', 'https://crm.meeautoparts.com/api/website-leads/intake' );
define( 'CRM_WEBSITE_LEADS_SECRET', getenv( 'CRM_WEBSITE_LEADS_SECRET' ) );
```

The WordPress host should supply `CRM_WEBSITE_LEADS_SECRET` as a private environment value. The AWS backend's `WEBSITE_LEADS_SIGNING_SECRET` must contain the exact same value. The frontend needs neither secret in its environment; it only forwards the signed request to the private backend.

## Intake contract

Send a UTF-8 JSON body with `Content-Type: application/json` and two headers:

- `X-Website-Lead-Timestamp`: current Unix time in seconds, e.g. `1792348800`.
- `X-Website-Lead-Signature`: `sha256=` followed by lowercase hexadecimal HMAC-SHA256 of `timestamp + "." + exact UTF-8 request body bytes`, using `WEBSITE_LEADS_SIGNING_SECRET`.

The CRM allows a five-minute timestamp skew. Sign the exact bytes passed to `wp_remote_post`; do not re-encode JSON after signing. A retry must get a new timestamp/signature, but keep its original UUID.

The bridge's server-side request should follow this pattern (using the values stored in WordPress server configuration):

```php
$body = wp_json_encode( $payload );
$timestamp = (string) time();
$signature = hash_hmac( 'sha256', $timestamp . '.' . $body, CRM_WEBSITE_LEADS_SECRET );
$response = wp_remote_post( CRM_WEBSITE_LEADS_URL, array(
    'headers' => array(
        'Content-Type' => 'application/json',
        'X-Website-Lead-Timestamp' => $timestamp,
        'X-Website-Lead-Signature' => 'sha256=' . $signature,
    ),
    'body' => $body,
    'timeout' => 10,
) );
```

```json
{
  "source": "PART_REQUEST",
  "externalSubmissionId": "9e1418a3-2317-49cf-8644-8ad91fc640b5",
  "sourceFormId": "wpforms-part-request",
  "sourcePageUrl": "https://meeautoparts.com/auto-parts-request/",
  "submittedAt": "2026-10-18T10:30:00Z",
  "customerName": "Example Customer",
  "customerPhone": "(555) 123-4567",
  "customerEmail": "example@example.com",
  "state": "CA",
  "zipCode": "90001",
  "vehicleYear": "2018",
  "vehicleMake": "Honda",
  "vehicleModel": "Civic",
  "partRequested": "Transmission",
  "message": "Please send a quote",
  "smsOptIn": false
}
```

`source` must be `QUOTE` or `PART_REQUEST`. `sourcePageUrl` must be an HTTPS URL on `meeautoparts.com` or `www.meeautoparts.com`; the support/contact path is rejected. `externalSubmissionId` must be a UUID. `sourceFormId`, `sourcePageUrl`, and `submittedAt` are required. Supply at least one of phone or email. Omit unavailable optional fields rather than sending empty strings.

Successful requests return a JSON envelope containing the website lead ID and external submission ID. The CRM's unique `(source, externalSubmissionId)` key makes retries idempotent. Treat non-2xx responses as undelivered, keep the outbox item, and surface repeated failures to the WordPress administrator without logging customer details.

## Acceptance checks

- A submission from each connected quote/part-request form appears once in Website Leads with correct source, fields, and Pacific-time display.
- A support/contact submission does not appear in Website Leads.
- Admin can assign; the assigned Sales user can view, change status, and add notes. Unassigned inquiries are admin-visible only.
- Conversion requires normal CRM lead fields, creates one regular lead, and links both records.
- Replaying the same submission ID creates no second website lead. Temporary CRM unavailability leaves the WordPress item queued for retry.
