# Data Safety — Play Console Form Answers

Paste these into the Play Console **Data safety** questionnaire (App content →
Data safety). Categories follow Google's taxonomy exactly.

## Question 1 — Does your app collect or share any user data?

> **Yes.**

## Data types collected

### Personal info → Email address
- Collected: **Yes**
- Shared with third parties: **No**
- Processed ephemerally / required? **Required** (used for account identity)
- Optional: **No**
- Purpose: Account management, App functionality
- Encrypted in transit: **Yes** (TLS 1.3)
- User can request deletion: **Yes** (email arvindcr4@gmail.com)

### Personal info → User IDs
- Collected: **Yes** (randomly-generated UUID for the user row)
- Shared: **No**
- Purpose: Account management

### Messages → Emails
- Collected: **Yes**
- Shared: **Yes — with Anthropic** (only when user triggers an AI feature)
- Purpose: App functionality (the inbox itself); App functionality + user-triggered AI when the user clicks Summarize / Draft / Prioritize.
- Encrypted in transit: **Yes**
- Encrypted at rest: **Yes** (AES-256-GCM for OAuth tokens / IMAP passwords; message metadata cached without encryption since it derives from the user's already-authenticated mailbox)
- User can request deletion: **Yes**
- Why we share with Anthropic: AI summary / draft / triage features use Claude. Only the specific message the user is acting on is sent. See privacy policy §3.

### App info & performance → No
We do not collect crash logs, diagnostics, or performance traces.

### Device or other IDs → No

### Location → No

### Financial info → No

### Health & fitness → No

### Photos and videos → No

### Audio files → No

### Files and docs → No (we don't process email attachments outside the AI prompt)

### Calendar → No

### Contacts → No

### Web browsing → No

## Question — Is all the user data collected encrypted in transit?

> **Yes.**

## Question — Do you provide a way for users to request that their data be deleted?

> **Yes.** Settings → Mailboxes → trash icon removes a connected mailbox. Email
> arvindcr4@gmail.com to remove the entire Beacon account.

## Security practices

- ✅ Data is encrypted in transit
- ✅ You can request that data be deleted
- ✅ Committed to Play Families Policy: **N/A** (target audience 18+)
- ✅ Independent security review: **No** (will be added after Tier-2 CASA assessment for Gmail restricted scope review)