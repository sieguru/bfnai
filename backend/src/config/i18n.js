import i18next from 'i18next';
import i18nextMiddleware from 'i18next-http-middleware';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'sv'],
    preload: ['en', 'sv'],
    backend: {
      loadPath: path.join(__dirname, '../../locales/{{lng}}/translation.json'),
    },
    detection: {
      order: ['querystring', 'header'],
      lookupQuerystring: 'lng',
      lookupHeader: 'accept-language',
      caches: false,
    },
    interpolation: {
      escapeValue: false,
    },
  });

export { i18next, i18nextMiddleware };
