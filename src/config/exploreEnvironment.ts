const EXPLORE_API_PRODUCTION = 'https://soridraw-explore-api.andrawing1212.workers.dev';
const EXPLORE_API_PREVIEW = 'https://soridraw-explore-preview.andrawing1212.workers.dev';
const EXPLORE_API_TEST = 'https://soridraw-explore-test.andrawing1212.workers.dev';

const trimBase = (value: string) => String(value || '').trim().replace(/\/+$/, '');

const host = typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
const explicitBase = trimBase(String(import.meta.env.VITE_EXPLORE_API_BASE || ''));

const isPreviewHost =
  host === 'preview.soridraw.com' ||
  host === 'soridraw-preview.web.app' ||
  host === 'soridraw-preview.firebaseapp.com' ||
  host === 'localhost' ||
  host === '127.0.0.1';

const isTestHost =
  host === 'test.soridraw.com' ||
  host === 'soridraw-test.web.app' ||
  host === 'soridraw-test.firebaseapp.com';

export const EXPLORE_API_BASE = explicitBase || (
  isPreviewHost
    ? EXPLORE_API_PREVIEW
    : isTestHost
      ? EXPLORE_API_TEST
      : EXPLORE_API_PRODUCTION
);

export const EXPLORE_ENVIRONMENT = isPreviewHost
  ? 'preview'
  : isTestHost
    ? 'test'
    : 'production';
