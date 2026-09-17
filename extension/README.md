# Homework Hub HAC Importer

This Chrome extension reads the assignment rows already displayed on the Bentonville HAC Classwork page and passes them to Homework Hub.

It does not ask for or store a HAC username, password, MFA code, or session cookie.

## Install for local testing

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extension` folder from the Homework Hub repository.
5. Open Homework Hub in a tab.
6. Open Bentonville HAC and sign in normally.
7. Open **Classes → Classwork**.
8. Return to Homework Hub. Imported HAC assignments will appear automatically.

## What gets imported

- Class
- Due date
- Assigned date
- Assignment name
- Category
- Score
- Total points

Imported HAC assignments are stored in the browser's local storage by Homework Hub. They are not inserted into the shared Supabase homework table.

## Current limitation

The extension currently targets the Bentonville HAC Classwork layout and Vercel/localhost Homework Hub pages. The parser can be adjusted if HAC changes its page structure.
