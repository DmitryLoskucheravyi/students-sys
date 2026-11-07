# Деплой Be Smart School

```
Браузер ──► Vercel (інтерфейс)
              └── /api ──► Render (API, Docker) ──► TiDB Cloud (сумісна з MySQL база: дані й файли домашніх)
                                                └─► Google Gemini (ШІ-роадмап)
```

Усе безкоштовне, домен не потрібен. Браузер бачить один домен: Vercel проксує `/api` на Render.
Тому вхід через cookie працює без CORS.

Диск Render на безкоштовному плані стирається при кожному рестарті, тому файли домашніх лежать
у базі. Текст і код стискаються автоматично, а великі скріни зменшуються ще в браузері.

## Що зробити руками

Реєстрацію й підключення акаунтів неможливо автоматизувати. Роби кроки по черзі.

### 1. База: TiDB Cloud

Aiven закрив безкоштовну MySQL для нових сервісів 6 листопада 2026 року. TiDB сумісний із MySQL, тож код не змінюється.

1. На [tidbcloud.com](https://tidbcloud.com) створи інстанс **Starter**, регіон у Європі (бажано Франкфурт).
2. Натисни **Connect**, згенеруй пароль і збережи `HOST`, `PORT`, `USERNAME`, `PASSWORD`.

### 2. ШІ: Gemini

На [aistudio.google.com/apikey](https://aistudio.google.com/apikey) створи ключ.

Перевір умови безкоштовного тарифу: Google може використовувати надіслані тексти для покращення моделей.
Форма в застосунку попереджає про це вчителів. Сервер пробує `gemini-flash-lite-latest`, потім
`gemini-flash-latest` і `gemini-2.5-flash`. Інші моделі можна задати змінною `GEMINI_MODELS` через кому.

### 3. API: Render

1. На [dashboard.render.com](https://dashboard.render.com) обери **New → Blueprint** і репозиторій `students-sys`. Render прочитає `render.yaml`.
2. Введи значення:

| Змінна | Значення |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | з TiDB Cloud |
| `INITIAL_MANAGER_PASSWORD` | пароль менеджера, від 8 символів |
| `GEMINI_API_KEY` | ключ Gemini |

3. Дочекайся деплою й відкрий `https://<сервіс>.onrender.com/api/health`. Має бути `{"ok":true}`.
4. Якщо адреса не `students-sys.onrender.com`, заміни її в `vercel.json` і запуш зміну.
5. Скопіюй **Settings → Deploy Hook**.

### 4. Сайт: Vercel

У папці проєкту:

```bash
vercel login
vercel link          # створи проєкт students-sys
vercel --prod
```

1. Із `.vercel/project.json` збережи `orgId` і `projectId`.
2. На [vercel.com/account/tokens](https://vercel.com/account/tokens) створи токен.
3. Якщо сайт просить вхід у Vercel, вимкни **Settings → Deployment Protection → Vercel Authentication**.

### 5. Автодеплой: GitHub

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

### 6. Перший вхід

1. Перевір живий сайт: `npm run smoke -- https://<проєкт>.vercel.app`.
2. Увійди як `manager` із паролем `INITIAL_MANAGER_PASSWORD`.
3. Видали `INITIAL_MANAGER_PASSWORD` із Render: він потрібен лише для порожньої бази.
4. Завантаж у домашнє файл на 5–10 МБ, перезапусти сервіс на Render і перевір, що файл відкривається.

## Як працює CI/CD

Кожен push і pull request запускають `.github/workflows/ci-cd.yml`:

1. **Тести:** модульні, збірка, Docker-образ, наскрізні в браузері на MySQL.
2. **Деплой** лише з `main` після зелених тестів і з `DEPLOY_ENABLED=true`:
   API на Render, очікування потрібного коміту, сайт на Vercel, перевірка живого сайту.

Якщо тести впали, на хостинг нічого не потрапить.

## Що варто знати

- **Перший запит після паузи.** Render засинає через 15 хвилин без запитів і прокидається приблизно за хвилину. Щоб уникнути цього, налаштуй на [cron-job.org](https://cron-job.org) запит до `https://<сервіс>.onrender.com/healthz` кожні 10 хвилин. Цей шлях не торкається бази.
- **Великі файли через проксі.** Точний ліміт Vercel для зовнішнього проксі не підтверджено документацією. `npm run smoke` надсилає 6 МБ і впаде, якщо проксі їх не пропускає. Тоді знизь ліміт файлу змінними `MAX_FILE_MB` на Render і `VITE_MAX_FILE_MB` у Vercel або надсилай файли напряму на Render: це окрема невелика зміна.
- **Місце для файлів.** TiDB Starter безкоштовно дає 5 ГБ. Один файл до 10 МБ (`MAX_FILE_MB`, не більше 15), усі файли разом до 4 ГБ (`DB_FILES_LIMIT_MB`). Коли місце закінчується, учень бачить «Зверніться до менеджера», а сайт працює далі. Місце звільняє видалення старих домашніх.
- **Якщо бази замало.** Вкажи `FILE_STORAGE=s3` і `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` для S3-сумісного сховища. Уже збережені файли автоматично туди не переносяться.
- **Квота TiDB.** Крім місця, Starter має місячну квоту запитів. Якщо вона вичерпається, база відмовлятиме в запитах до початку наступного місяця або до встановлення платного ліміту витрат. Споживання видно в панелі TiDB Cloud.
- **Ліміт входів.** Через проксі Vercel сервер не бачить надійного IP відвідувача, тому основний захист рахує спроби на логін: після 15 невдалих він блокується на 15 хвилин, навіть для правильного пароля. Зловмисник може так тимчасово заблокувати чужий логін, зате не підбере пароль.
- **Дані.** Прод стартує з порожньою базою. Локальні акаунти не переносяться, бо це особисті дані.

## Відкат

На Render: **Events → Rollback**. На Vercel: **Deployments → Promote to Production**.
Таблиці лише додаються (`CREATE TABLE IF NOT EXISTS`), тому попередній код працює з новою базою.
