# פריסת Scrape Pipeline API על Koyeb ו-Upstash Redis

מדריך זה יוצר פריסה בעלות בסיס של **$0 לחודש** באמצעות Koyeb Free ו־Upstash Redis Free. הארכיטקטורה היא שירות Web יחיד: אין Worker נפרד ואין BullMQ, מפני ש־Koyeb Free מאפשרת Web Service יחיד בלבד ואינה תומכת בשירות Worker חינמי.[1]

> התוכנית החינמית מיועדת ל־hobby ולדמואים. השירות עשוי לרדת לאפס לאחר שעה ללא תעבורה, והבקשה הראשונה לאחר מכן עשויה להיות איטית יותר.[1]

## לפני שמתחילים

| רכיב | מה מכינים | ערך מומלץ |
| --- | --- | --- |
| GitHub | גישה למאגר הפרטי `scrape-pipeline-api` | ענף `main` |
| Upstash | חשבון ו־Redis database חינמי | אזור קרוב ל־Koyeb |
| Koyeb | חשבון Koyeb | Free Instance ב־Frankfurt או Washington, D.C. |
| סוד API | מחרוזת אקראית ארוכה | `openssl rand -base64 32` |

## 1. יצירת Upstash Redis חינמי

פתחו את [Upstash Console](https://console.upstash.com/) ובחרו ליצור Redis database חדש. בחרו אזור קרוב לאזור Koyeb שתבחרו בהמשך כדי להקטין השהיה. לאחר יצירת המאגר, לחצו **Redis Connect** והעתיקו את כתובת ה־TLS עבור ioredis.

כתובת תקינה נראית כך:

```text
rediss://:YOUR_PASSWORD@YOUR_ENDPOINT.upstash.io:6379
```

ב־ioredis הנקודתיים לפני הסיסמה הכרחיים. Upstash מספקת בתוכנית החינמית 256MB נתונים ו־500,000 פקודות בחודש; כל קריאת מטמון, כתיבה ופינג בריאות נספרים למכסה.[2] [3]

אל תכניסו את הכתובת ל־GitHub ואל תעלו את `.env` למאגר.

## 2. יצירת שירות Koyeb מתוך GitHub — שלושה צעדים

### צעד 1: חברו את GitHub

ב־[Koyeb Control Panel](https://app.koyeb.com/) בחרו **Create Web Service**, לאחר מכן **GitHub**. אשרו ל־Koyeb גישה למאגר `infinityempire/scrape-pipeline-api` ובחרו את הענף `main`. Koyeb מתעדת פריסה מ־GitHub כ־Web Service דרך מסך זה.[4]

### צעד 2: הגדירו Docker ו־Free Instance

בחרו **Dockerfile** כ־Builder. השאירו את Dockerfile בשורש המאגר, הגדירו את פורט החשיפה ל־`8080`, ואת Health Check path ל־`/health`.

בחרו **Free Instance** ואת אחד האזורים הנתמכים: Frankfurt או Washington, D.C. אל תבחרו Worker, נפח persistent, autoscaling או instance שאינו מסומן Free — אפשרויות אלה אינן זמינות במסלול החינמי או עלולות ליצור חיוב.[1]

### צעד 3: הגדירו את הסודות ופרסו

במסך **Environment variables** הוסיפו את הערכים הבאים. סמנו אותם כ־secret אם המסך מציע אפשרות זו.

| משתנה | ערך |
| --- | --- |
| `PORT` | `8080` |
| `REDIS_URL` | כתובת `rediss://` שהועתקה מ־Upstash |
| `API_KEY` | מחרוזת אקראית ארוכה, לדוגמה פלט `openssl rand -base64 32` |
| `SCRAPE_TIMEOUT_MS` | `15000` |
| `CACHE_TTL_SECONDS` | `3600` |
| `ALLOW_PRIVATE_NETWORKS` | `false` |

לחצו **Deploy**. Koyeb יבנה את ה־Dockerfile וייצור כתובת HTTPS עבור השירות. כל דחיפה עתידית ל־`main` מפעילה build ופריסה חדשה, בתנאי שהוגדר auto-deploy במסך השירות.[4]

## 3. אימות לאחר הפריסה

אחרי שה־deployment מסומן Healthy, העתיקו את כתובת השירות ובדקו:

```bash
curl https://YOUR-KOYEB-URL/health
```

התגובה התקינה כוללת `status: "ok"` ו־`redis: "ready"`.

בדקו חילוץ מורשה:

```bash
curl --request POST https://YOUR-KOYEB-URL/api/v1/extract \
  --header 'Content-Type: application/json' \
  --header 'X-API-KEY: YOUR_SECRET' \
  --data '{"url":"https://example.com"}'
```

הקריאה הראשונה אמורה להחזיר `cached: false`. חזרו עליה; כל עוד לא עברה שעה, הקריאה הבאה אמורה להחזיר `cached: true`.

## תפעול במסגרת Koyeb Free

| מגבלה | השפעה על השירות | אמצעי ההגנה בפרויקט |
| --- | --- | --- |
| 512MB RAM ו־0.1 vCPU | Chromium עלול להיות איטי או להיכשל בדפים כבדים | חסימת תמונות, גופנים, מדיה ו־CSS; דגלי Chromium חסכוניים; חילוץ יחיד במקביל |
| Scale to zero אחרי שעה | תיתכן השהיית cold start | Health endpoint זמין; התאימו ציפיות לזמן הקריאה הראשונה |
| Web Service יחיד | אין Worker רקע | החילוץ מתבצע בתוך בקשת API, והמטמון מונע עבודה חוזרת |
| Upstash Free: 500K פקודות ו־256MB | שימוש חריג עלול למצות מכסה | TTL של שעה, URL hash כמפתח, וניטור בלוח הבקרה של Upstash |

המסלול אינו מתאים לעומסי לקוחות, תורים גדולים או SLA. אם נדרש שירות יציב יותר, יש לעבור לתוכנית עם יותר זיכרון ומעבד ולהוסיף Worker נפרד.

## פתרון תקלות

| תסמין | בדיקה ופתרון |
| --- | --- |
| `503` ב־`/health` | ודאו ש־`REDIS_URL` מתחיל ב־`rediss://:` ושהסיסמה לא נחתכה. |
| `401` ב־extract | ודאו שהכותרת היא בדיוק `X-API-KEY` ושערכה תואם ל־`API_KEY`. |
| `502` או `504` | אתר היעד אינו נגיש, חוסם בוטים, או חורג מ־15 שניות. אין להגדיל timeout במסלול Free ללא בדיקה. |
| `429` | בקשה לא־מוטמנת אחרת רצה; נסו שוב לאחר כ־15 שניות. |
| Build נכשל | בדקו את Koyeb Build Logs וודאו ש־Dockerfile בשורש המאגר. |
| השירות מגיב לאט בקריאה הראשונה | זוהי תוצאת scale-to-zero; נסו שוב לאחר שה־instance התעורר. |

## מקורות

[1]: https://www.koyeb.com/docs/reference/instances "Koyeb Free Instances"
[2]: https://upstash.com/pricing/redis "Upstash Redis Pricing"
[3]: https://upstash.com/docs/redis/troubleshooting/no_auth "Upstash: ioredis TLS URL format"
[4]: https://www.koyeb.com/docs/build-and-deploy/deploy-with-git "Koyeb: Deploy with GitHub"
