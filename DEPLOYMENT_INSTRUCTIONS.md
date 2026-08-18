# מדריך פריסה וחיבורי חיוב

מסמך זה מגדיר את מסלול הפריסה של **Scrape Pipeline API** באמצעות Render או Railway. הפריסה התקינה כוללת שלושה רכיבים: שירות Web ציבורי עבור ה־API, עובד רקע פרטי עבור BullMQ, ושירות Redis מנוהל. העובד אינו אופציונלי: בלעדיו משימות נצברות בתור אך אינן מבוצעות.

> כתובת הייצור תיראה כך: `https://your-app.onrender.com/api/v1/extract`. החליפו את `your-app` בשם השירות שספקית הענן מקצה בפועל.

| דרישה | Render | Railway |
| --- | --- | --- |
| הגדרת תשתית כקוד | `render.yaml` המצורף | הגדרה בממשק הפרויקט, או קובץ הגדרה נוסף לפי העדפתכם. |
| API ציבורי | שירות Web מבוסס Docker | שירות Docker מהמאגר. |
| עובד תור | שירות Worker נפרד | שירות שני מאותו מאגר עם פקודת הפעלה שונה. |
| מטמון ותור | Key Value תואם Redis | תבנית Redis; `REDIS_URL` זמין לשירותים באותו פרויקט. |
| פריסה רציפה | `autoDeployTrigger: commit` ב־Blueprint | חיבור מאגר GitHub והפעלת automatic deploys. |

## הכנה

לפני הפריסה, ודאו שהמאגר נמצא בענף `main` ושערך `API_KEY` הוא סוד אקראי ארוך. ניתן לייצר ערך מקומי, למשל:

```bash
openssl rand -base64 32
```

אין לשמור את הערך בקובץ `.env` שמועלה ל־Git, ב־README או בלקוח. הקובץ `render.yaml` מסמן אותו כערך סודי שיימסר במסך הפריסה בלבד.

## פריסה ל-Render בשלושה צעדים

1. במסך הראשי של Render, בחרו **New +** ולאחר מכן **Blueprint**.
2. חברו את GitHub, בחרו את מאגר `scrape-pipeline-api` ואת ענף `main`.
3. אשרו את ה־Blueprint, הזינו את `API_KEY` כאשר Render מבקש אותו, ובחרו **Apply**.

קובץ [`render.yaml`](./render.yaml) מגדיר שירות Docker ציבורי, שירות Worker ושירות Key Value באותו אזור. הוא מזריק לשני השירותים את כתובת ה־Redis הפנימית באמצעות `connectionString`; שירות ה־Key Value עצמו אינו פתוח לרשת הציבורית. Render מתעדת ש־Blueprints תומכים בשירותי Docker ובהפניות בין שירותים, וש־Key Value מתאים למטמון ולתורי עבודה תואמי Redis.[1][2]

לאחר שהפריסה מסתיימת, פתחו את כתובת השירות ובדקו:

```bash
curl https://your-app.onrender.com/health
```

תגובה של `200` עם `redis: "ready"` מאשרת שה־API מסוגל להגיע לשירות הנתונים. לאחר מכן שלחו בקשת חילוץ עם הסוד שהוגדר:

```bash
curl --request POST https://your-app.onrender.com/api/v1/extract \
  --header 'Content-Type: application/json' \
  --header 'X-API-KEY: החלף-בסוד-האמיתי' \
  --data '{"url":"https://example.com"}'
```

כל דחיפה מוצלחת ל־`main` מפעילה בנייה ופריסה מחודשת. אם משנים את `API_KEY`, החליפו אותו ב־Render ולאחר מכן עדכנו את כל הלקוחות המורשים. אין לחשוף את חיבור Redis החיצוני; התקשורת בין השירותים משתמשת ברשת הפרטית.

## חלופת Railway בשלושה צעדים

1. ב־Railway צרו פרויקט חדש ובחרו **Deploy from GitHub Repo**; בחרו את אותו מאגר ואת `main`.
2. הוסיפו שירות Redis לפרויקט. Railway מפרסמת `REDIS_URL` לשירותים באותו פרויקט, והמסד נשאר פרטי כברירת מחדל.[3]
3. הוסיפו שירות שני מאותו מאגר עבור העובד, הגדירו לו Start Command של `node src/worker.js`, והגדירו משתני סביבה כמפורט להלן.

לשירות ה־API השתמשו ב־Dockerfile המצורף עם פקודת ברירת המחדל `node src/server.js`. הגדירו `API_KEY` כסוד ושמרו אותו בשירות ה־API בלבד. בשירות API ובעובד הגדירו `REDIS_URL` להפניה לערך Redis של הפרויקט, וכן `SCRAPE_TIMEOUT_MS=15000` ו־`CACHE_TTL_SECONDS=3600`; בעובד הוסיפו גם `WORKER_CONCURRENCY=2`. Railway מתעדת מסלולי פריסה ממאגר GitHub ומ־Docker, ואת משתני החיבור של Redis לשירותים באותו פרויקט.[3][4]

לאחר בדיקת `/health`, צרו דומיין ציבורי רק לשירות ה־API. שירות ה־Worker ו־Redis אינם צריכים דומיין ציבורי.

## תצורה תפעולית מומלצת

| נושא | תצורה מומלצת | הנימוק |
| --- | --- | --- |
| Redis | `noeviction` לתור ו־`journal-snapshot` לשירות מנוהל | הגנה מפני מחיקת משימות בתור; ה־Blueprint כבר מגדיר זאת. |
| מטמון | `CACHE_TTL_SECONDS=3600` | תואם לדרישת תוקף של שעה ומפחית חילוצים חוזרים. |
| זמן חילוץ | `SCRAPE_TIMEOUT_MS=15000` | מונע תפיסת עובדים ארוכה על יעד איטי. |
| מקביליות | התחילו ב־`WORKER_CONCURRENCY=2` | כל משימה מפעילה Chromium; הגדלה צריכה להתבסס על מדדי CPU וזיכרון. |
| אבטחת יעד | השאירו `ALLOW_PRIVATE_NETWORKS=false` | מנגנון חסימת SSRF פעיל כברירת מחדל. |
| גישה ל־API | שער API עם rate limit לכל צרכן | מגן על משאבי הדפדפן ועל עלויות החילוץ. |

## חיבור ל-RapidAPI לחיוב אוטומטי

RapidAPI היא חלופת הפצה שבה המנוי, מכסות השימוש והחיוב מנוהלים דרך ה־Marketplace. התיעוד שלה מתאר תוכניות Free, Pay Per Use, Freemium ו־Paid עבור ספקי API.[5]

צרו Listing חדש, הגדירו את `POST /api/v1/extract` עם גוף הבקשה והתגובות המתועדים ב־README, והגדירו את כתובת ה־upstream כ־`https://your-app.onrender.com/api/v1/extract`. בחרו תוכניות עם מכסות שמגנות על מספר משימות Chromium שניתן להפעיל בכל חודש. הגדירו ב־Gateway כותרת upstream סודית `X-API-KEY` עם הערך של `API_KEY`, כך שהמפתח הפנימי אינו נמסר לצרכני RapidAPI.

לפני פרסום, בדקו בקשה דרך ה־console של RapidAPI, ודאו שמגבלות המנוי מחזירות `429` בצד השער כשנדרש, וודאו שהשירות שלכם מקבל רק תעבורה מהשער. יש להוסיף בשלב מתקדם אימות של סוד הפרוקסי או allowlist של מקור התעבורה, ולא להסתמך על הסתרת כתובת ה־upstream בלבד.

## חיבור ל-Stripe לחיוב אוטומטי

Stripe מתאימה כאשר רוצים למכור את השירות ישירות ולא באמצעות Marketplace. Checkout Sessions יכול לייצג תשלום חד־פעמי או מנוי פעיל; עבור פריט חוזר משתמשים במצב `subscription`.[6]

הטמעה ישירה דורשת רכיב זכאות נוסף שאינו חלק מהשירות הנוכחי. צרו ב־Stripe מוצר ומחיר, הוסיפו שירות אחסון נתונים עבור לקוחות, תוכניות ומכסת שימוש, ולאחר מכן הוסיפו שירות Billing קטן שמבצע את השלבים הבאים:

1. הוא יוצר Checkout Session עבור המחיר המתאים ומחזיר ללקוח רק URL לתשלום.
2. הוא מאמת webhook חתום של Stripe, למשל לאחר אירוע השלמת Checkout או שינוי במנוי.
3. הוא שומר את מצב הזכאות ואת המגבלה של הלקוח במסד נתונים.
4. הוא גורם לשער ה־API לאכוף את המפתח והמכסה של אותו לקוח לפני שהבקשה מגיעה ל־`/api/v1/extract`.

יש לשמור מפתחות Stripe ומפתח החתימה של ה־webhook במנהל הסודות של ספקית הענן בלבד. אין לקבל הודעת webhook בלי אימות חתימה, ואין לסמן לקוח כפעיל על בסיס חזרה של הדפדפן מדף התשלום.

## אימות לאחר פריסה

ודאו שכל הפריטים הבאים מתקיימים לפני שמספקים גישה ללקוחות:

| בדיקה | תוצאה מצופה |
| --- | --- |
| `GET /health` | `200` ו־`redis: "ready"`. |
| בקשה ללא `X-API-KEY` | `401 UNAUTHORIZED`. |
| בקשה ל־`http://127.0.0.1` | `400 UNSAFE_URL`. |
| כתובת ציבורית תקינה | `200`, עם `cached: false` בבקשה הראשונה. |
| אותה כתובת שוב | `200`, עם `cached: true` במהלך שעה. |
| לוגי עובד | משימה מסומנת `Extraction completed`. |
| בדיקות GitHub Actions | lint, tests ו־Docker build עוברים בענף `main`. |

## מקורות

[1]: https://render.com/docs/blueprint-spec "Render Blueprint YAML Reference"
[2]: https://render.com/docs/key-value "Render Key Value documentation"
[3]: https://docs.railway.com/databases/redis "Railway Redis documentation"
[4]: https://docs.railway.com/quick-start "Railway Quick Start"
[5]: https://docs.rapidapi.com/docs/monetizing-your-api-on-rapidapicom "RapidAPI monetization documentation"
[6]: https://docs.stripe.com/api/checkout/sessions "Stripe Checkout Sessions API reference"
