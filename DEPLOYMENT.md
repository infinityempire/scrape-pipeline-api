# פריסה חינמית: GitHub Actions, Upstash ו-GitHub Pages

הצינור בנוי כך שהחילוץ צורך משאבים רק בתוך GitHub Actions, והאתר המופק נשאר סטטי. תזמון ברירת המחדל הוא כל שש שעות (`0 */6 * * *`), וניתן גם להפעיל ריצה ידנית מתוך GitHub.

## תנאי שימוש חשוב

GitHub Pages ב־GitHub Free זמינה למאגרים ציבוריים בלבד. כדי לפרסם את האתר ללא עלות, יש להחליף את המאגר ל־**Public** ב־GitHub. סודות Actions נשארים מוסתרים גם במאגר ציבורי, אך הקוד ותיעוד הפרויקט יהיו גלויים. אם אינכם מסכימים לחשוף את המאגר, אל תפעילו Pages במסלול החינמי.[1]

## תהליך הפריסה

| שלב | פעולה | תוצאה |
| --- | --- | --- |
| 1 | צרו Upstash Redis Free והעתיקו REST URL ו־REST Token | מטמון מרכזי לחילוץ. |
| 2 | הוסיפו את סודות Actions הנדרשים | ה־workflow מקבל גישה ליעד ולמטמון. |
| 3 | הגדירו Pages ל־GitHub Actions | GitHub מאפשר העלאת artifact סטטי. |
| 4 | הפעילו `Scheduled scrape, build, and publish` ידנית | תוצאת סריקה, אתר סטטי ופריסת Pages ראשונה. |

### סודות חובה

```text
TARGET_URL=https://example.com
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace-with-upstash-token
```

### סודות מונטיזציה אופציונליים

```text
PAYPAL_ME_LINK=https://www.paypal.com/paypalme/your-handle
ADSENSE_PUB_ID=ca-pub-1234567890123456
```

השאירו סוד אופציונלי ריק כדי שהמחולל ישאיר רק placeholder. `ADSENSE_PUB_ID` חייב לעמוד בפורמט המצוין; ערך לא תקין אינו מוזרק לתבנית. `PAYPAL_ME_LINK` חייב להיות קישור HTTPS.

## פקודות Ubuntu

לשכפול המאגר למחשב Ubuntu שבו כבר מוגדרת הזדהות ל־GitHub:

```bash
git clone https://github.com/infinityempire/scrape-pipeline-api.git
cd scrape-pipeline-api
cp .env.example .env
npm ci
```

אם המאגר נשאר פרטי, יש להתחבר ל־GitHub ב־Ubuntu לפני פעולת `git clone` או להשתמש ב־GitHub CLI לאחר `gh auth login`.

## אימות

לאחר ריצה מוצלחת, היכנסו ל־**Settings → Pages** והעתיקו את כתובת האתר. האתר אמור לכלול דף ראשי, נתיב `/data/latest/`, `sitemap.xml` ו־`robots.txt`.

## מקורות

[1]: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages "GitHub Pages availability"
