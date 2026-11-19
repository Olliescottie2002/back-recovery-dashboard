# Back Recovery Dashboard

A phone-first recovery journal with local check-ins, activities, flare-ups, exercise sessions, routine stages and trends. Open Exercises to enter your existing routine, then activate it. The app starts with an empty journal.

## Develop

Use Node.js 24 and Python 3. No package installation or credentials are needed to run the app.

```sh
node --test
python3 -m http.server 8765 --bind 127.0.0.1 --directory site
```

Open the local server in a browser. Run checks with sample data in a separate browser profile. When changing any cached app asset, increment the version in `site/sw.js`. The new shell takes over after all tabs using the old version close. Keep the origin and the IndexedDB database name stable to retain existing records.

## Deploy and install

In GitHub, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Open **Actions → Check and deploy → Run workflow** and select `main` if the initial deployment needs to be rerun. Once the workflow is green, Settings → Pages shows the URL. The workflow uploads only the `site` directory.

Open the deployed site in Safari on your iPhone. Tap **Share → Add to Home Screen**, enable **Open as Web App** if shown, and tap **Add**. Launch it while online once so the app shell can cache for offline use.

## Records and backups

IndexedDB stores records on the device. The app has no analytics, cloud storage or accounts. Back up regularly from **Backups → Export JSON**. Import fills in missing records and retains entries with matching IDs. Export a backup before clearing browser data or moving devices. Safari and the installed app may use separate storage. Store exports privately because they contain journal data.

Use one daily check-in per date for symptom trends. Use the activity, flare-up and exercise forms for individual events. Mark flare-ups resolved to measure their duration. The trends view shows the coverage of logged observations. A next-day observation or a reported trigger cannot establish what caused a symptom change.
