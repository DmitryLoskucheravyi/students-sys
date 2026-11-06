# Деплой Be Smart School

```
Браузер ──► Vercel (інтерфейс)
              └── /api ──► Render (API, Docker) ──► Aiven (MySQL)
                                                └─► Backblaze B2 (файли домашніх)
                                                └─► Google Gemini (ШІ-роадмап)
```

Усе безкоштовне, домен не потрібен. Браузер бачить один домен: Vercel проксує `/api` на Render.
Тому вхід через cookie працює без CORS.

Файли домашніх не можна тримати на диску Render: на безкоштовному плані він стирається при кожному
рестарті. Без S3-сховища сервер у проді навмисно не запускається.

## Що зробити руками

Реєстрацію й підключення акаунтів неможливо автоматизувати. Роби кроки по черзі.

### 1. База: Aiven

1. На [console.aiven.io](https://console.aiven.io) створи сервіс **MySQL**, план **Free**, регіон у Європі.
2. Зі сторінки сервісу збережи `Host`, `Port`, `User`, `Password`, а також **CA Certificate**.

### 2. Файли: Backblaze B2

Підійде будь-яке S3-сумісне сховище.

1. На [backblaze.com/b2](https://www.backblaze.com/cloud-storage) створи **приватний** bucket, наприклад `bs-school-homework`.
2. У `Application Keys` створи ключ лише для цього bucket.
3. Збережи `keyID`, `applicationKey` і `Endpoint` bucket. Регіон міститься в endpoint: для
   `s3.eu-central-003.backblazeb2.com` це `eu-central-003`.

### 3. ШІ: Gemini

На [aistudio.google.com/apikey](https://aistudio.google.com/apikey) створи ключ.

Перевір умови безкоштовного тарифу: Google може використовувати надіслані тексти для покращення моделей.
Форма в застосунку попереджає про це вчителів. Сервер пробує `gemini-flash-latest`, а потім
`gemini-flash-lite-latest`. Інші моделі можна задати змінною `GEMINI_MODELS` через кому.

### 4. API: Render

1. На [dashboard.render.com](https://dashboard.render.com) обери **New → Blueprint** і репозиторій `students-sys`. Render прочитає `render.yaml`.
2. Введи значення:

| Змінна | Значення |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | з Aiven |
| `DB_SSL_CA` | увесь текст CA Certificate |
| `INITIAL_MANAGER_PASSWORD` | пароль менеджера, від 8 символів |
| `S3_ENDPOINT` | `https://` + endpoint із B2 |
| `S3_REGION` | регіон із endpoint |
| `S3_BUCKET` | назва bucket |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | `keyID` і `applicationKey` |
| `GEMINI_API_KEY` | ключ Gemini |

3. Дочекайся деплою й відкрий `https://<сервіс>.onrender.com/api/health`. Має бути `{"ok":true}`.
4. Якщо адреса не `students-sys.onrender.com`, заміни її в `vercel.json` і запуш зміну.
5. Скопіюй **Settings → Deploy Hook**.

### 5. Сайт: Vercel

У папці проєкту:

```bash
vercel login
vercel link          # створи проєкт students-sys
vercel --prod
```

1. Із `.vercel/project.json` збережи `orgId` і `projectId`.
2. На [vercel.com/account/tokens](https://vercel.com/account/tokens) створи токен.
3. Якщо сайт просить вхід у Vercel, вимкни **Settings → Deployment Protection → Vercel Authentication**.

### 6. Автодеплой: GitHub

У репозиторії відкрий **Settings → Secrets and variables → Actions**.

| Secrets | |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Deploy Hook із Render |
| `VERCEL_TOKEN` | токен Vercel |
| `VERCEL_ORG_ID` | `orgId` |
| `VERCEL_PROJECT_ID` | `projectId` |

| Variables | |
|---|---|
| `BACKEND_URL` | `https://<сервіс>.onrender.com` |
| `PROD_URL` | `https://<проєкт>.vercel.app` |
| `DEPLOY_ENABLED` | `true` |

### 7. Перший вхід

1. Перевір живий сайт: `npm run smoke -- https://<проєкт>.vercel.app`.
2. Увійди як `manager` із паролем `INITIAL_MANAGER_PASSWORD`.
3. Видали `INITIAL_MANAGER_PASSWORD` із Render: він потрібен лише для порожньої бази.
4. Завантаж у домашнє файл більше 5 МБ і перевір, що він відкривається (див. «Що варто знати»).

## Як працює CI/CD

Кожен push і pull request запускають `.github/workflows/ci-cd.yml`:

1. **Тести:** модульні, збірка, Docker-образ, наскрізні в браузері на MySQL і S3-сховищі.
2. **Деплой** лише з `main` після зелених тестів і з `DEPLOY_ENABLED=true`:
   API на Render, очікування потрібного коміту, сайт на Vercel, перевірка живого сайту.

Якщо тести впали, на хостинг нічого не потрапить.

## Що варто знати

- **Перший запит після паузи.** Render засинає через 15 хвилин без запитів і прокидається приблизно за хвилину. Щоб уникнути цього, налаштуй на [cron-job.org](https://cron-job.org) запит до `https://<сервіс>.onrender.com/healthz` кожні 10 хвилин. Цей шлях не торкається бази.
- **Великі файли через проксі.** Точний ліміт Vercel для зовнішнього проксі не підтверджено документацією. `npm run smoke` надсилає 6 МБ і впаде, якщо проксі їх не пропускає. Тоді файли треба надсилати напряму на Render: це окрема невелика зміна.
- **Обсяги.** База Aiven має 1 ГБ. Обсяг B2 залежить від тарифу, перевір його в панелі.
- **Aiven Free** може зупинити сервіс, яким давно не користуються. Панель дозволяє запустити його знову.
- **Ліміт входів** покладається на `TRUST_PROXY=2`. Якщо після деплою блокування спрацьовує на всіх одразу, це значення треба уточнити.
- **Дані.** Прод стартує з порожньою базою. Локальні акаунти не переносяться, бо це особисті дані.

## Відкат

На Render: **Events → Rollback**. На Vercel: **Deployments → Promote to Production**.
Таблиці лише додаються (`CREATE TABLE IF NOT EXISTS`), тому попередній код працює з новою базою.
