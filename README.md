# Open GitHub Repository Research

אתר מחקר פתוח שמציג תצפיות תקופתיות על מאגרי קוד פופולריים, לפי נתונים פומביים המוחזרים מ־GitHub REST Search API. GitHub Actions אוסף snapshot מתוזמן, Upstash Redis שומר את התצפית הקודמת, והאתר הסטטי מוצג ב־GitHub Pages.

> זהו פרויקט מחקר פתוח ולא מוצר מסחרי. הוא אינו סורק את GitHub Trending, תוכן מאגרים או פרופילי משתמשים. האתר מציג metadata ציבורי של מאגרים, קישורים למקור, מדד תצפיתי וסיווגי מילות מפתח. הוא אינו מבטיח מגמות, איכות, דירוג, אינדוקס או הכנסה.

## מתודולוגיה

הצינור שולח בקשת REST Search יחידה ל־GitHub בכל ריצה, עם query ברירת מחדל `stars:>1000` ומיון לפי עדכון אחרון. GitHub מגבילה Search API לבקשות בקצב נמוך יותר מאשר REST רגיל; `GITHUB_TOKEN` המובנה של Actions מקבל מכסת API מתועדת לכל מאגר, והצינור משתמש בבקשה אחת בלבד בכל ריצה.[1] [2]

לכל מאגר נרשמים מספר הכוכבים, שפה, נושאים, forks, timestamps וקטגוריה מחושבת. **Growth Velocity Index** הוא שינוי חיובי בכוכבים בין שתי תצפיות של האתר, מחולק במספר שעות התצפית ומנורמל ל־24 שעות. תצפית ראשונה מוצגת כ־Baseline, ולכן אין לה מדד מהירות. המדד אינו מדד רשמי של GitHub ואינו תחזית.

| רכיב | פעולה |
| --- | --- |
| GitHub REST Search API | מחזיר metadata ציבורי של עד 30 מאגרים העונים ל־query. |
| Upstash Redis | שומר snapshot יחיד, המשמש לחישוב ההפרש בתצפית הבאה. |
| `src/githubResearch.js` | איסוף API, מדד מהירות וסיווג מילות מפתח שקוף. |
| `src/build_site.js` | בונה דף מחקר, טבלת מאגרים, דף מתודולוגיה, `sitemap.xml` ו־`robots.txt`. |
| GitHub Pages | מפרסם את תוצר המחקר הפתוח. |

## סיווגים

הסיווגים `AI & ML`, `Security`, `Data & Analytics`, `Cloud & Infrastructure`, `Web & Interface`, `Developer Tools` ו־`Open Source` מחושבים ממילות מפתח בשם, בתיאור, בשפה וב־topics של כל מאגר. הם קירוב שקוף ויכולים להיות שגויים או חלקיים; הם אינם תוויות של GitHub.

## הגדרה

ב־**Settings → Secrets and variables → Actions** הגדירו:

| Secret | נדרש | תיאור |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | כן | REST URL ממסד Redis ב־Upstash. |
| `UPSTASH_REDIS_REST_TOKEN` | כן | אסימון REST בעל הרשאת כתיבה מ־Upstash. |
| `SOURCE_PERMISSION_CONFIRMED` | כן | הערך `true` מאשר את מקור המחקר המוצהר ואת תנאי השימוש הלא־מסחריים. |

אין צורך להגדיר `GITHUB_API_TOKEN` ב־Actions: ה־workflow משתמש ב־`${{ github.token }}`. לשימוש מקומי אפשר להגדיר `GITHUB_API_TOKEN` ב־`.env` אם רוצים מכסה מאומתת גבוהה יותר.[2]

ב־**Settings → Pages**, בחרו **Source: GitHub Actions**. ב־**Actions → Scheduled scrape, build, and publish** אפשר להפעיל ריצה ידנית. הריצה המחזורית מוגדרת לכל שש שעות.

## אינדוקס ומקור

האתר הנוכחי מאפשר crawl דרך `robots.txt` ומפרסם `sitemap.xml`, אך אינדוקס בפועל נתון לשיקול מנוע החיפוש. הוא מיועד להפצה פתוחה של מחקר, לא לתוכן אוטומטי בהיקף גדול לצורך הכנסות. לפני שינוי query, הגדלת היקף או שינוי שימוש יש לקרוא את `CONTENT_POLICY.md` ואת `github_source_research.md`.

מדיניות השימוש של GitHub מבדילה בין API ובין scraping, ומגבילה את השימוש במידע מהשירות. הפרויקט נשאר פתוח, מיוחס וללא פרסומות, אפיליאייט או קישורי תשלום כדי להתיישר עם מסלול המחקר שנבחר.[3]

## עבודה מקומית

```bash
git clone https://github.com/infinityempire/scrape-pipeline-api.git
cd scrape-pipeline-api
cp .env.example .env
npm ci
npm run scrape
npm run build:site
npm start
```

## בדיקות

```bash
npm test
npm run lint
```

## מקורות

[1]: https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28 "GitHub REST Search API"
[2]: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api "GitHub REST API rate limits"
[3]: https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies "GitHub Acceptable Use Policies"

