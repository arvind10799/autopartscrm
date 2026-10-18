# Website Leads WordPress Developer Guide

**Site:** https://meeautoparts.com/

**CRM intake:** `https://crm.meeautoparts.com/api/website-leads/intake`
**Goal:** Send website quote and part-request inquiries to the separate **Website Leads** tab in the CRM. **Never send support/contact messages** to this tab.

The CRM code is ready locally, but the AWS database migration, backend, frontend, and signing secret must be deployed before you enable the WordPress connector. Coordinate the switch-on with the CRM developer. You do not need WordPress access for the CRM work, and the CRM developer does not need your WordPress admin password.

## Step 1 — Inventory the forms

In WordPress admin, the active theme, and any page-builder/custom-code areas, record for **every** quote and part-request form:

- Page or popup where it appears, form ID/handler, and exact field IDs/keys.
- Where submission currently goes, including emails, WPForms entries, Web3Forms, or Formspree.
- Current visitor confirmation, notification emails, spam protection, and SMS-consent checkbox.

Include the sitewide **Get Instant Quote** popup and forms reused on regional pages. Public inspection previously suggested WPForms IDs **7** and **2463** plus custom forms; these are candidates to verify in WordPress, **not final IDs to copy blindly**. The [public home page](https://meeautoparts.com/) and [support/contact page](https://meeautoparts.com/auto-parts-support-contact/) are useful for identifying form locations, but only WordPress admin/code can confirm the actual form configuration.

### How to find the real WPForms IDs

1. Open **WordPress Admin → WPForms → All Forms**. The number in a form's shortcode, for example `[wpforms id="123"]`, is its **form ID**.
2. Edit each approved form. Click each field in the builder. The **Field Options → General** panel shows its numeric **field ID** (for example, `Phone (ID #4)`). Record the field's visible label, type, ID, and whether it is required.
3. Inspect the page editor or template to find every page where that form is embedded. For popups, also identify the code or plugin that opens them and the submission handler.
4. For custom HTML/JavaScript forms, record the input `name` attributes, the actual endpoint called on submit, and any server handler. Field labels alone are not stable mapping keys.

[WPForms documents where to locate form and field IDs](https://wpforms.com/developers/how-to-locate-form-id-and-field-id/). Do this **again after duplicating a form**, since the new form and its fields may have different IDs.

### Form inventory to complete before coding

Create one row per form or handler. Send the completed table to the CRM developer; do not fill unknown values by guessing.

| Page or popup | Form system | Actual form ID or handler | Type | Existing submission destination | Connect to CRM? |
| --- | --- | --- | --- | --- | --- |
| Home page main request form | Confirm in WP | Fill in | Quote or part request after inspection | Fill in | Yes, if it requests a quote/part |
| Sitewide Get Instant Quote popup | Confirm in WP/code | Fill in | `QUOTE` | Fill in | Yes, except on support/contact page |
| Regional page request form | Confirm in WP | Fill in | `PART_REQUEST` or `QUOTE` after inspection | Fill in | Yes, if it requests a quote/part |
| Dedicated part-request page | Confirm in WP | New distinct ID if shared | `PART_REQUEST` | Fill in | Yes |
| Support/contact page | Confirm in WP | Fill in | Support | Fill in | **No** |

Include every other form found in WordPress. If multiple pages share one approved form ID, keep one field mapping for that form but record all page URLs in the inventory.

## Step 2 — Separate part requests from support/contact

Check whether the part-request page and `/auto-parts-support-contact/` share the same WPForms ID (previous public inspection suggested **2463**). If they do:

1. Duplicate the part-request form in WPForms.
2. Embed the **new** form on the part-request page and note its new ID.
3. Keep the existing support/contact form and its email flow as they are.
4. Never put the support/contact form ID in the CRM connector allowlist.

Also exclude any quote popup submission made **on the support/contact page**. The CRM independently rejects `sourcePageUrl` paths containing `/auto-parts-support-contact/`, but WordPress must filter them too.

## Step 3 — Configure approved forms only

Create a server-side allowlist mapping each approved form ID or custom handler to one of these exact source values:

| Form type | `source` value | Example `sourceFormId` |
| --- | --- | --- |
| Quote or instant quote | `QUOTE` | `wpforms-7` or `instant-quote-popup` |
| Part request | `PART_REQUEST` | `wpforms-<new-id>` |

Use the real verified IDs. Do not let a browser-supplied value choose `source`, `sourceFormId`, or an arbitrary page URL. Preserve the actual page where the visitor submitted the form as `sourcePageUrl`.

**Page URL rule:** Sitewide forms must send the page URL where the submission happened, not always the homepage or popup template URL. Use the form system's captured source-page metadata when available. If the form only supplies a hidden page URL, validate its scheme and hostname server-side, exclude the support/contact path, and check that it matches an approved form/page combination before enqueueing. Do not rely on `HTTP_REFERER` alone: it may be absent. The form ID and handler determine the source type; the submitted page URL does not.

## Step 4 — Add private WordPress server configuration

Set these on the **WordPress server**, never in page JavaScript, a hidden input, or a public plugin setting:

| Setting | Exact requirement |
| --- | --- |
| `CRM_WEBSITE_LEADS_URL` | `https://crm.meeautoparts.com/api/website-leads/intake` |
| `CRM_WEBSITE_LEADS_SECRET` | The exact same private value as AWS backend `WEBSITE_LEADS_SIGNING_SECRET`; at least 32 characters. Obtain it through a private channel after CRM deployment. |

For example, `wp-config.php` may contain:

```php
define( 'CRM_WEBSITE_LEADS_URL', 'https://crm.meeautoparts.com/api/website-leads/intake' );
define( 'CRM_WEBSITE_LEADS_SECRET', getenv( 'CRM_WEBSITE_LEADS_SECRET' ) );
```

Ensure the hosting environment actually exposes the variable to PHP. If it does not, use a server-only `wp-config.php` value managed outside source control. Do not put the secret in the theme, browser, frontend environment, database options, logs, or email. Permit outbound HTTPS to `crm.meeautoparts.com` with TLS verification enabled. No CRM user login or browser CORS change is needed.

## Step 5 — Implement a small WordPress bridge plugin

Use a custom plugin so theme updates cannot remove the integration.

**WPForms:** Register `wpforms_process_complete` with four parameters: `$fields`, `$entry`, `$form_data`, `$entry_id`. The hook runs after successful form processing. Check `$form_data['id']` against the allowlist and map the sanitized `$fields` using the verified field IDs. Do not rely on `$entry_id` as the CRM submission ID: [WPForms documents that it may be `0` in WPForms Lite](https://wpforms.com/developers/wpforms_process_complete/).

The plugin's WPForms callback should follow this sequence:

1. Read the numeric ID from `$form_data['id']`. Return immediately unless it is on the approved allowlist.
2. Determine `QUOTE` or `PART_REQUEST` from that allowlist entry, not from a posted input.
3. Read the **sanitized** `$fields[FIELD_ID]['value']` values using that form's own mapping. Do not assume the IDs in another form are the same.
4. Determine and validate the actual source page. Return without queuing if it is the support/contact page or outside the approved pages.
5. Build the payload below. Reject an incomplete payload locally if both phone and email are absent. Preserve the visitor's actual checkbox consent.
6. Generate `wp_generate_uuid4()` once, save the complete payload to the outbox, and schedule delivery. The visitor should not wait for a slow CRM response.

Example **structure**, with IDs deliberately left for the developer to fill from WPForms admin:

```php
add_action( 'wpforms_process_complete', 'mee_capture_website_lead', 10, 4 );

function mee_capture_website_lead( $fields, $entry, $form_data, $entry_id ) {
    $form_id = absint( $form_data['id'] ?? 0 );
    $mapping = mee_approved_form_mapping( $form_id ); // Return null for support/unknown forms.
    if ( ! $mapping ) {
        return;
    }

    // Implement these in the plugin using the per-form field-ID table below.
    $source_page_url = mee_verified_source_page( $entry, $form_data, $mapping );
    if ( ! $source_page_url ) {
        return; // Record a safe admin diagnostic; never guess the page.
    }
    $payload = mee_map_sanitized_fields( $fields, $mapping, $source_page_url );
    $payload['externalSubmissionId'] = wp_generate_uuid4();
    $payload['submittedAt'] = gmdate( 'c' );
    mee_save_website_lead_outbox( $payload ); // Durable save before sending.
}
```

`mee_approved_form_mapping`, `mee_verified_source_page`, `mee_map_sanitized_fields`, and `mee_save_website_lead_outbox` are functions the developer must implement; this snippet is the hook and processing order, **not a complete plugin**. Test that the WPForms hook runs once per successful submission on the installed WPForms version.

**Custom quote forms:** If they currently send directly from the visitor's browser to Web3Forms/Formspree, add a validated WordPress server-side submission handler and enqueue the CRM payload there. Keep the existing visitor success message and necessary notification email while testing the CRM path. Apply the same spam checks as the current form. Never expose the signing secret to the browser.

For each custom form, the developer should: locate its HTML/JavaScript and current request URL; document the exact input `name` keys; route successful validated submissions through a WordPress handler; apply the existing spam checks; save the CRM payload in the outbox; and preserve the visitor confirmation and any required notification email. A frontend-only `fetch()` directly to the CRM intake URL is **not** acceptable because it would expose the signing secret. A browser request to a WordPress handler may carry form data, but that handler decides the approved source and creates the signed CRM request server-side.

Only valid, successful, non-spam submissions from approved forms enter the connector.

## Step 6 — Map fields into the CRM payload

Required fields:

| Field | Requirement |
| --- | --- |
| `source` | Exact string `QUOTE` or `PART_REQUEST`. |
| `externalSubmissionId` | Generate one UUID per accepted submission. Save and reuse it for every retry. |
| `sourceFormId` | Stable form identifier, maximum 80 characters. |
| `sourcePageUrl` | Actual HTTPS page on `meeautoparts.com` or `www.meeautoparts.com`; maximum 1000 characters. Support/contact page is rejected. |
| `submittedAt` | Original submission time in ISO 8601 format, e.g. `2026-10-18T10:30:00Z`. |
| `customerPhone` or `customerEmail` | At least one must be present. Email must be valid. |

Optional fields and maximum lengths:

| Field | Maximum length or type |
| --- | --- |
| `customerName` | 160 characters |
| `customerPhone` | 50 characters |
| `customerEmail` | 160 characters |
| `state` | 80 characters |
| `zipCode` | 20 characters |
| `vehicleYear` | 10 characters |
| `vehicleMake`, `vehicleModel` | 80 characters each |
| `vin` | 40 characters |
| `partRequested` | 255 characters |
| `message` | 4000 characters |
| `smsOptIn` | JSON boolean `true` or `false`; use the actual checkbox choice. |

Omit unavailable optional values. Combine first and last name into `customerName` where appropriate. A **starting** map for a custom quote form observed publicly is `name` → `customerName`, `Phone_Number` → `customerPhone`, `email` → `customerEmail`, `Zip_Code` → `zipCode`, `VIN_Searched` → `vin`, `Vehicle_Year/Make/Model` → the corresponding vehicle fields, `Vehicle_Part` → `partRequested`, and `SMS_Opt_In` → `smsOptIn`. Confirm those field keys in the WordPress code before using them.

### Field-by-field mapping rules

For **each approved form**, make a separate mapping table. Do not use visible labels as array keys; use WPForms numeric field IDs or custom-form input `name` keys. The following rows specify what the value means and how to transform it:

| Website input to find | CRM field | Exact mapping rule |
| --- | --- | --- |
| Form identity | `source` | From the server allowlist only: `QUOTE` or `PART_REQUEST`. Never take this from a hidden field. |
| WPForms ID or custom handler name | `sourceFormId` | Stable string, e.g. `wpforms-<actual-id>` or `instant-quote-popup`; record it in the handoff. |
| Page on which form was submitted | `sourcePageUrl` | Full HTTPS URL on meeautoparts.com. Keep the actual regional page URL for regional forms. Exclude support/contact before queueing. |
| Original successful submission time | `submittedAt` | UTC ISO 8601. Set when the outbox item is first created, **not** when a later retry runs. |
| Name, or separate First and Last | `customerName` | Use the submitted full name, or join nonempty first/middle/last with spaces. Do not substitute the WordPress account name. |
| Phone | `customerPhone` | Preserve dial code and entered number after trimming. Do not invent a phone number. |
| Email | `customerEmail` | Trim, validate as email, and send the actual submitted address. At least phone or email is needed. |
| Shipping destination **state** | `state` | Map only an actual state/region value. Do not put a full street address or `Ship to` free text in this field. |
| ZIP/postal code | `zipCode` | Map the actual postal code, not the entire shipping address. |
| Vehicle year, make, model | `vehicleYear`, `vehicleMake`, `vehicleModel` | Map each separate field as a string. Do not put the combined description into every field. |
| VIN | `vin` | Map the entered VIN; leave absent if blank. |
| Selected part or short part title | `partRequested` | Short part name/summary, max 255 characters, e.g. `Transmission`. |
| Long `Describe Your Part`, comments or requirements | `message` | Preserve the full useful text up to 4000 characters. If this is the only part field, put a short summary in `partRequested` and the original detailed text in `message`. Never silently discard important detail. |
| SMS consent checkbox | `smsOptIn` | JSON `true` only if the actual opt-in choice is selected. `false` if unchecked. Do not infer consent from having a phone number or from a nonempty string such as `No`. |

For the commonly visible **Find A Grade Used Auto Parts Instantly** form, the public labels include Name, Phone, Ship to, Year, Make, Model, and Describe Your Part. Their numeric WPForms IDs must be filled in from the builder. `Ship to` needs inspection: send a real state to `state` only if the form collects one; otherwise preserve relevant shipping detail in `message` if appropriate. [The public regional pages show these labels](https://meeautoparts.com/california/).

For the **Get Instant Quote** popup, the public labels include VIN, Year, Make, Model, Part, Full Name, Phone, Email, Zip Code and SMS consent. The initial custom field-key guesses above must be checked against the actual markup/handler. [The public home page shows the popup fields](https://meeautoparts.com/).

### Mapping worksheet to fill in for every approved form

Copy this block once per form. `N/A` is acceptable only for an optional CRM field that the form does not collect.

```text
Form name:
WordPress form ID or custom handler:
Source type (QUOTE or PART_REQUEST):
sourceFormId sent to CRM:
All pages/popups using this form:
Current form submission destination and notification emails:
How the actual sourcePageUrl is obtained and validated:

CRM field             WP field ID or input name       Example value       Transformation
customerName          __________                      __________          __________
customerPhone         __________                      __________          __________
customerEmail         __________                      __________          __________
state                 __________                      __________          __________
zipCode               __________                      __________          __________
vehicleYear           __________                      __________          __________
vehicleMake           __________                      __________          __________
vehicleModel          __________                      __________          __________
vin                   __________                      __________          __________
partRequested         __________                      __________          __________
message               __________                      __________          __________
smsOptIn              __________                      true/false          __________
```

If a field's value is a WPForms array, inspect the sanitized value structure for that field type and extract its intended display value or subfields. Avoid raw `$_POST` for CRM field mapping. Validate lengths and types before queueing; if a value exceeds a CRM limit, preserve the complete information in a supported field or flag the item for correction instead of silently truncating it.

Example body (replace the example page with the actual page URL):

```json
{
  "source": "PART_REQUEST",
  "externalSubmissionId": "9e1418a3-2317-49cf-8644-8ad91fc640b5",
  "sourceFormId": "wpforms-part-request",
  "sourcePageUrl": "https://meeautoparts.com/auto-parts-request/",
  "submittedAt": "2026-10-18T10:30:00Z",
  "customerName": "Example Customer",
  "customerPhone": "(555) 123-4567",
  "vehicleYear": "2018",
  "vehicleMake": "Honda",
  "vehicleModel": "Civic",
  "partRequested": "Transmission",
  "smsOptIn": false
}
```

## Step 7 — Save to an outbox before delivery

Create a durable WordPress outbox record with the payload, `externalSubmissionId`, creation time, attempt count, next-attempt time, delivery status, and last safe error. Save the record before attempting the CRM request. This keeps a website submission from being lost if the CRM is temporarily down.

Deliver through a background job or short server-side request. Retry temporary network failures, timeouts, HTTP 429, and HTTP 5xx with backoff. Use a reliable scheduled runner if ordinary WP-Cron is not dependable. **Keep the same UUID** on retry, but generate a **new timestamp and signature** for each HTTP attempt. Expose undelivered count and repeated failures to a WordPress administrator without logging full customer information or the secret.

## Step 8 — Sign and send the request

POST UTF-8 JSON to `CRM_WEBSITE_LEADS_URL` with `Content-Type: application/json` and these headers:

| Header | Value |
| --- | --- |
| `X-Website-Lead-Timestamp` | Current Unix time in seconds as 10 digits. |
| `X-Website-Lead-Signature` | `sha256=` plus lowercase hexadecimal HMAC-SHA256 of `timestamp + "." + exact JSON body bytes`, keyed with `CRM_WEBSITE_LEADS_SECRET`. |

The CRM allows a five-minute clock difference. The request body limit is **64 KB**. Sign the exact bytes sent; do not encode JSON a second time after signing.

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
    'sslverify' => true,
) );
```

Use [WordPress `wp_remote_post`](https://developer.wordpress.org/reference/functions/wp_remote_post/) error and response helpers. Treat only HTTP 2xx with `success: true` and a matching returned `data.externalSubmissionId` as delivered. The response also contains `data.id` (the CRM website lead ID). Retain and investigate HTTP 400/401/413/415: these indicate mapping, secret/signature, body-size, or content-type problems that require a fix before retrying. A retry with the same `(source, externalSubmissionId)` must not create a second CRM record.

The sender should check `is_wp_error( $response )`, `wp_remote_retrieve_response_code( $response )`, and `wp_remote_retrieve_body( $response )`. If a request is retried, use the **saved payload** (including its original `submittedAt` and `externalSubmissionId`) to create a fresh JSON body, timestamp, and signature. Do not create a second outbox row for the retry.

## Step 9 — Test and hand over

After the CRM developer confirms the AWS migration, frontend/backend deployment, and shared secret are live:

1. Submit a test on each approved quote and part-request form. Confirm exactly one item per submission in CRM **Website Leads**, with the correct source, contact, vehicle/part, page URL, and SMS choice.
2. Submit the support/contact form and any support-page popup. Confirm **nothing** appears in Website Leads.
3. Simulate CRM unavailability. Confirm the WordPress submission is retained, visitor confirmation/email behavior is appropriate, the outbox retries, and the CRM eventually gets one item.
4. Replay the same UUID. Confirm no duplicate. Confirm a new submission gets a new UUID.
5. Check desktop/mobile forms, spam protection, existing emails, and visitor confirmation.

Send the CRM developer the final approved form IDs, field ID mapping, pages covered, connector version, outbox/retry method, and test results. **Never send the secret in chat, email, screenshots, or source control.**

### Exact handoff to send to the CRM developer

The WordPress developer should return one report with these completed items:

1. **Form inventory:** Name, exact WPForms form ID or custom handler, all page/popup URLs, `QUOTE` or `PART_REQUEST`, and whether it is enabled. Explicitly identify the support/contact form ID and confirm it is excluded.
2. **Field mapping:** A completed copy of the mapping worksheet above for **every** approved form, with actual numeric WPForms field IDs or custom input names. Include a sanitized sample payload for each distinct form type; replace real customer data with fictional examples.
3. **Connector details:** Plugin name/version or code location, how custom forms were changed, outbox storage, scheduled retry method, failure visibility, and whether original email notifications/confirmations remain active.
4. **Configuration status:** Confirm `CRM_WEBSITE_LEADS_URL` is the URL in this guide, `CRM_WEBSITE_LEADS_SECRET` is set privately on the WordPress host and matches the CRM side, outbound HTTPS succeeds, and the secret never reaches the browser. Report **status only**, not the value of the secret.
5. **Test results:** Form and page tested, approximate test time, whether one website lead appeared, whether each mapped field matched, whether the support form was excluded, and the retry/duplicate test result. The CRM website lead ID or `externalSubmissionId` of synthetic test submissions can be included to help reconciliation; do not include real customer data.

The CRM developer can then compare the report to the CRM records and help resolve any mapping error without WordPress admin access.
