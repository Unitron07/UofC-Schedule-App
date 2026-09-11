# Privacy

Your timetable works offline. There are no accounts, analytics SDKs, or advertisements.

## Public academic calendar refresh

Starting in version 1.2, the app requests Android's Internet permission to check `https://calendar.ucalgary.ca/acadsched` after each confirmed timetable import. This is a fixed HTTPS GET request with no calendar, course details, student identifiers, university credentials, or query parameters. Redirects are refused. The website receives ordinary connection information such as your IP address and the app's generic user agent.

Only published holiday and term-break dates are parsed; downloaded HTML is never executed. The app caches the extracted dates locally, not the full page. Included dates and the last successful update remain available offline. Timeouts, failed requests, and unsupported page formats do not block import or erase saved dates. No request is made merely by opening the app.

## On your phone

The file picker grants access to the file you choose. Imported event titles, dates, rooms, identifiers, and available teaching-staff information are saved in private WebView storage. Manually entered subject details and preferences are stored there too. Android backup is disabled.

**Settings → Remove imported timetable** removes the schedule and subject details. Clearing app storage or uninstalling removes all app data. The original file in Downloads is independent; remove it separately if desired.

Times are displayed in Calgary time. The app never asks for your university password. Use your own browser when downloading a calendar.

## Repository and releases

Examples and screenshots use fictional courses and locations. No real student export, enrollment preset, instructor preset, workstation path, private signing key, or developer credential is included. APKs start with no imported schedule. Existing phone data is not copied into an APK during a build.

Do not attach real calendars to issues or pull requests. Reproduce bugs with synthetic data, removing names, email addresses, student numbers, calendar URLs, and identifying event IDs. Review screenshots and file metadata before sharing.
