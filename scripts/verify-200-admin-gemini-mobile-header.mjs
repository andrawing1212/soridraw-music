import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/AdminGeminiAuditPage.tsx', 'utf8');
const layout = readFileSync('src/components/AdminPageLayout.tsx', 'utf8');

assert.match(page, /title="Gemini 호출 기록"/, 'Gemini audit title must remain');
assert.match(page, /stackActionsOnMobile/, 'Gemini audit must stack actions below title on mobile');
assert.match(page, /keepTitleOnOneLine/, 'Gemini audit title must stay horizontal');
assert.match(page, /className="flex flex-wrap items-center gap-2"/, 'Gemini audit actions must wrap safely on narrow screens');

assert.doesNotMatch(page, /일반 사용자에게는 보이지 않는 관리자용 호출·토큰 감사 화면입니다./,
  'retired header description must stay removed');
assert.doesNotMatch(page, /현재 기록은 .*이 브라우저·이 기기에서 발생한 호출만/s,
  'retired long amber explanation must stay removed');
assert.doesNotMatch(page, /실제 API 요청 최대 5회/,
  'long API-limit explanation must not return to this compact page header');

assert.match(layout, /stackActionsOnMobile\?: boolean/, 'shared layout must expose opt-in mobile stack');
assert.match(layout, /keepTitleOnOneLine\?: boolean/, 'shared layout must expose opt-in one-line title');
assert.match(layout, /stackActionsOnMobile = false/, 'other admin pages must retain previous layout by default');
assert.match(layout, /keepTitleOnOneLine = false/, 'other admin titles must retain previous wrapping by default');
assert.match(layout, /flex-col md:flex-row md:items-start md:justify-between/,
  'opt-in mobile layout must put actions below the title');
assert.match(layout, /keepTitleOnOneLine && 'whitespace-nowrap'/,
  'one-line title guard must be opt-in only');

console.log('APP200_ADMIN_GEMINI_MOBILE_TITLE_HORIZONTAL=PASS');
console.log('APP200_ADMIN_GEMINI_LONG_EXPLANATION_REMOVED=PASS');
console.log('APP200_OTHER_ADMIN_HEADERS_DEFAULT_UNCHANGED=PASS');
