import './verify-notification-unified-inbox-004.mjs';
import './verify-notification-account-sync-api-003.mjs';
import './verify-notification-inbox-candidate-001.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
const file = (p) => readFileSync(p, 'utf8');
const rail = file('src/components/studio/StudioLeftRail.tsx');
const panel = file('src/components/studio/NotificationPanel.tsx');
const model = file('src/services/notifications/notificationModel.ts');
const admin = file('src/pages/AdminAppSettingsPage.tsx');
const adminPanel = file('src/components/NotificationAdminSchedule.tsx');
const rules = file('firestore.rules');
assert.match(rail,/ref=\{notificationButtonRef\}/);
assert.match(rail,/NotificationPanel open=\{notificationOpen\}/);
assert.match(panel,/soridraw-notification-avatar/);
assert.match(panel,/soridraw-notification-content/);
assert.match(panel,/soridraw-notification-cover/);
assert.match(panel,/setExploreFollow\(auth.currentUser, row.actorUid, true\)/);
assert.match(panel,/playTrack\(\{ id: row.song.id, url: audioUrl/);
assert.match(panel,/validInternalSharePath/);
assert.match(panel,/aria-label="알림 설정 열기"/);
assert.match(panel,/visualExample &&/);
assert.match(model,/isNotificationVisualPreview/);
assert.match(panel,/soridraw-notification-preview-tag/);
assert.doesNotMatch(panel,/화면 미리보기 · 실제 사용자 알림이 아닙니다/);
assert.doesNotMatch(panel,/알림 종류 선택은 현재 이 기기에 저장됩니다/);
assert.doesNotMatch(panel,/알림 취합 주기는 관리자만 변경할 수 있습니다/);
assert.match(model,/NOTIFICATION_PREFERENCES_DEFAULT/);
const { code: modelCode } = await transform(model, { loader: 'ts', format: 'esm', target: 'es2022' });
const preferenceModule = await import('data:text/javascript;base64,' + Buffer.from(modelCode).toString('base64'));
const defaults = { ...preferenceModule.NOTIFICATION_PREFERENCES_DEFAULT };
const expectedSections = {
  like: 'activity', follow: 'activity', complete: 'creation',
  announcement: 'activity', message: 'activity',
};
assert.deepEqual(
  Object.fromEntries(Object.keys(expectedSections).map((key) =>
    [key, preferenceModule.notificationSectionFor(key)])),
  expectedSections,
  'only generation-complete alerts belong in creation history; announcements are shared activity'
);
const off = Object.fromEntries(Object.keys(defaults).map((key) => [key, false]));
const mixed = { ...defaults, complete: false, message: false };
assert.equal(Object.keys(defaults).length, 5);
const stored = new Map();
const previousWindow = globalThis.window;
globalThis.window = { localStorage: {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => { stored.set(key, value); },
} };
try {
  const uid = 'notification-master-qa-user';
  preferenceModule.saveNotificationPreferences(uid, mixed);
  assert.equal(preferenceModule.readNotificationMasterEnabled(uid, mixed), true,
    'legacy partially checked preferences must keep master on');
  preferenceModule.saveNotificationMasterEnabled(uid, false);
  assert.equal(preferenceModule.readNotificationMasterEnabled(uid, mixed), false);
  assert.deepEqual(preferenceModule.readNotificationPreferences(uid), mixed,
    'master off MUST NOT mutate checked/unchecked categories');
  preferenceModule.saveNotificationMasterEnabled(uid, true);
  assert.deepEqual(preferenceModule.readNotificationPreferences(uid), mixed,
    'master on restores exact previous checked category choices');
  assert.equal(preferenceModule.readNotificationMasterEnabled(uid, mixed), true);
  assert.deepEqual(preferenceModule.readNotificationPreferences(uid + '-other'), defaults,
    'another account must not inherit master or preferences');
  assert.equal(preferenceModule.readNotificationMasterEnabled(uid + '-other', defaults), true);
  assert.equal(preferenceModule.readNotificationMasterEnabled(uid + '-legacy-off', off), false,
    'old all-off preferences must remain off on first upgrade');
  assert.deepEqual(preferenceModule.readNotificationPreferences(uid), mixed);
  assert.equal([...stored.keys()].filter((key) => key.includes('notification-preferences')).length, 1,
    'master changes cannot write any extra category preference records');
} finally {
  if (typeof previousWindow === 'undefined') delete globalThis.window;
  else globalThis.window = previousWindow;
}
assert.match(panel, /className="soridraw-notification-setting-master"/);
assert.match(panel, /useState<NotificationSection>\('activity'\)/);
assert.match(panel, /setActiveSection\('activity'\)/);
assert.match(panel, /notificationSectionFor\(row.category\) === activeSection/);
assert.match(panel, /role="group" aria-label="알림 카테고리"/);
assert.match(panel, /aria-pressed=\{activeSection === 'activity'\}/);
assert.match(panel, /aria-pressed=\{activeSection === 'creation'\}/);
assert.match(panel, />\s*활동·소식\s*<\/button>/);
assert.match(panel, />\s*생성 기록\s*<\/button>/);
assert.match(panel, /activeSection === 'creation' \? '아직 표시할 생성 알림이 없습니다\.'/);
assert.doesNotMatch(panel,/soridraw-notification-creation-limit|생성기록은 최대 10곡이 표시됩니다\./,
  'no artificial ten-song notice remains');
assert.doesNotMatch(file('src/components/studio/notificationPanel.css'),
  /\.soridraw-notification-creation-limit\{/);
assert.match(panel,/mergeCompletedGenerationNotices016\(/);
assert.match(panel,/readCompletedGenerationLog016\(uid\)/);
console.log('NOTIFICATION_TWO_SECTIONS_ACTIVITY_CREATION=PASS');
assert.match(panel, /className="soridraw-notification-settings-divider"/);
assert.match(panel, /<NotificationSwitch checked=\{masterEnabled\} onChange=\{toggleMaster\}/);
assert.match(panel, /<NotificationSwitch checked=\{prefs\[item.key\]\} disabled=\{!masterEnabled \|\| accountSyncLocked\}/);
assert.match(panel, /checked=\{checked\} onChange=\{onChange\} disabled=\{disabled\}/);
assert.match(panel, /aria-disabled=\{!masterEnabled \|\| accountSyncLocked\}/);
assert.match(panel, /if \(!masterEnabled \|\| accountSyncLocked\) return;/);
assert.match(panel, /saveNotificationMasterEnabled\(uid, nextEnabled\)/);
assert.match(panel, /saveNotificationPreferences\(uid, next\)/);
assert.match(panel, /effectivePreferences\?\.master \?\? masterEnabled/);
assert.match(panel, /effectivePreferences\?\.\[row.category\] \?\? prefs\[row.category\]/);
assert.match(panel, /const effectivePreferences = NOTIFICATION_INBOX_ENABLED_004/);
assert.ok(panel.indexOf('className="soridraw-notification-setting-master"') <
  panel.indexOf('TYPES.map((item)'), 'master toggle must be above individual preferences');
const switchCss = file('src/components/studio/notificationPanel.css');
assert.match(switchCss, /\.soridraw-notification-tabs\{/);
assert.match(switchCss, /\.soridraw-notification-tab\.is-active\{/);
assert.match(switchCss, /\.soridraw-notification-switch-control\{\s*width:44px;height:26px/);
assert.match(switchCss, /width:20px;height:20px;border-radius:50%/);
assert.match(switchCss, /transform:translateX\(18px\)/);
assert.match(switchCss, /\.soridraw-notification-setting-row\.is-disabled\{[\s\S]*?pointer-events:none;/);
assert.match(switchCss, /\.soridraw-notification-switch-input:disabled\{cursor:default\}/);
assert.match(switchCss, /\.soridraw-notification-switch-input:checked \+ \.soridraw-notification-switch-track\{\s*background:#ffbb22;/);
assert.match(switchCss, /\.soridraw-notification-switch-input:focus-visible/);
assert.match(switchCss, /prefers-reduced-motion:reduce/);
assert.doesNotMatch(panel, /toggleAllNotificationPreferences|areAllNotificationPreferencesEnabled/);
console.log('NOTIFICATION_MASTER_OFF_PRESERVES_FIVE_AND_DISALLOWS_INTERACTION=PASS');
console.log('NOTIFICATION_SMALLER_SWITCHES_AND_EXISTING_LOCAL_SAVES=PASS');
assert.doesNotMatch(panel,/setInterval\(|onSnapshot\(|getDocs\(|getDoc\(/);
assert.doesNotMatch(panel,/saveNotificationPreferences\(uid, next\)[\s\S]*?setDoc\(/);
assert.match(admin,/NotificationAdminSchedule/);
assert.match(adminPanel,/app_settings', 'notification_schedule'/);
assert.match(adminPanel,/const OPTIONS = \[1, 2, 3, 4, 6, 12, 24\]/);
assert.match(adminPanel,/intervalHours: hours/);
assert.match(rules,/match \/app_settings\/\{docId\}/);
assert.match(rules,/allow write: if hasAdminPermission\('appSettings'\)/);
assert.doesNotMatch(panel,/좋아요 해제.*알림|팔로우 해제.*알림/);

// Compact mobile account menu opens the same user-scoped panel as the PC rail.
const app = file('src/App.tsx');
const compactBarStart = app.indexOf('{/* Mobile Top Icon Bar */}');
const compactBarEnd = app.indexOf('const CLOUD_FUNCTIONS_BASE_URL', compactBarStart);
assert.ok(compactBarStart >= 0 && compactBarEnd > compactBarStart);
const compactBar = app.slice(compactBarStart, compactBarEnd);
const mobileAccountStart = compactBar.indexOf('soridraw-profile-menu soridraw-account-menu-surface absolute right-0 top-full');
const mobileAccountEnd = compactBar.indexOf('</motion.div>', mobileAccountStart);
assert.ok(mobileAccountStart >= 0 && mobileAccountEnd > mobileAccountStart);
const mobileAccount = compactBar.slice(mobileAccountStart, mobileAccountEnd);
assert.match(mobileAccount, /data-soridraw-mobile-profile-notifications="true"/);
assert.match(mobileAccount, /aria-label="알림 열기"/);
assert.match(mobileAccount, /absolute right-3 top-3/);
assert.match(mobileAccount, /<Bell className="h-5 w-5"/);
assert.match(mobileAccount, /setIsProfileOpen\(false\);\s*setIsExpanded\(false\);\s*setIsMobileNotificationOpen\(true\);/);
assert.ok(mobileAccount.indexOf('aria-label="알림 열기"') < mobileAccount.indexOf('className="soridraw-account-menu-row"'),
  'bell must appear before account actions');
assert.match(compactBar, /ref=\{mobileProfileButtonRef\}/);
assert.match(compactBar, /<NotificationPanel\s+open=\{isMobileNotificationOpen && Boolean\(user\?\.uid\)\}/);
assert.match(compactBar, /anchorRef=\{mobileProfileButtonRef\}/);
assert.match(compactBar, /onClose=\{\(\) => setIsMobileNotificationOpen\(false\)\}/);
assert.doesNotMatch(app.slice(0,compactBarStart), /data-soridraw-mobile-profile-notifications/);
assert.match(app, /setIsMobileNotificationOpen\(false\); \}, \[location.pathname, user\?\.uid\]\)/);
console.log('NOTIFICATION_MOBILE_PROFILE_MENU_BELL_AND_SHARED_PANEL=PASS');
console.log('NOTIFICATION_MOBILE_OPEN_CLOSE_HAS_NO_NEW_BACKEND_IO=PASS');

assert.match(panel,/visualExample && uid && auth\.currentUser\?\.uid === uid/);
assert.match(panel,/projectCompletedExistingGenerations004\(recentHistory\)/);
assert.match(panel,/row\.category !== 'complete' \|\| localCompletions\.length === 0/,
  'real PREVIEW generation rows replace sample creation notices only');
assert.match(panel,/isPreviewSample\(row\) \? row\.createdAt : Math\.max\(0, Date\.now\(\) - row\.createdAt\)/,
  'mock samples store elapsed milliseconds, real server and local rows store epoch');
assert.match(panel,/disabled=\{\(visualExample && isPreviewSample\(row\)\) \|\| !hasPlayableSong\(row\)\}/,
  'only fake samples or rows without a valid playback target are disabled');
assert.match(panel,/sampleHeader = visualExample &&/,
  'genuine completion notice must not be globally marked as a demo');
assert.match(panel,/localCompletions\.length === 0/,
  'retain existing creation demo only when no genuine completion exists');
assert.match(panel,/activeSection === 'activity' \|\| localCompletions\.length === 0/);
assert.doesNotMatch(panel,/setInterval\(|onSnapshot\(|getDocs\(|getDoc\(/);
console.log('NOTIFICATION_PREVIEW_GENUINE_CREATION_HISTORY_NO_EXTRA_SERVER_IO=PASS');


const panelCss = file('src/components/studio/notificationPanel.css');
assert.match(panel,/window\.addEventListener\('resize', onClose\)/,
  'browser viewport resize should close panel, not keep a stale anchor');
assert.match(panel,/window\.removeEventListener\('resize', onClose\)/);
assert.doesNotMatch(panel,/window\.addEventListener\('resize', update\)/);
assert.match(panel,/window\.addEventListener\('soridraw-studio-frame-resize', update as EventListener\)/,
  'split-bar resizing must retain the existing in-panel reposition behavior');
for (const selector of [
  '.soridraw-notification-follow',
  '.soridraw-notification-cover',
  '.soridraw-notification-category-icon',
  '.soridraw-notification-end-icon',
]) assert.ok(panelCss.includes(selector), 'missing notification selector: ' + selector);
assert.match(panelCss,/\.soridraw-notification-follow\{[\s\S]*?background:#d7d7db;color:#151517/);
assert.match(panelCss,/\.soridraw-notification-follow:disabled\{opacity:1;cursor:default\}/);
assert.match(panelCss,/\.soridraw-notification-cover\{[\s\S]*?background:#363638;color:#fff/);
assert.match(panelCss,/\.soridraw-notification-category-icon\{[^}]*color:#fff/);
assert.match(panelCss,/\.soridraw-notification-end-icon\{[^}]*color:#f5f5f5/);
assert.match(panelCss,/\.soridraw-notification-switch-input:checked \+ \.soridraw-notification-switch-track\{\s*background:#ffbb22;/,
  'checked notification switches use SORIDRAW yellow');
assert.match(panelCss,/\.soridraw-notification-end-icon\[data-type="announcement"\],[\s\S]*?\.soridraw-notification-category-icon\[data-type="announcement"\]\{color:#84b9ee\}/);
assert.match(panelCss,/\.soridraw-notification-end-icon\[data-type="message"\],[\s\S]*?\.soridraw-notification-category-icon\[data-type="message"\]\{color:#c4adf4\}/);
assert.match(panel,/<span className="soridraw-notification-end-icon" data-type=\{row.category\}/);
assert.doesNotMatch(panelCss,/#b089ef|#ee7da2|#ad90dc|#77b4ee|#FFB400/,
  'unrequested colorful notification accents must remain removed');
assert.match(panel,/sampleHeader && !settingsOpen && <span className="soridraw-notification-preview-tag">예시<\/span>/,
  'preview samples must still be distinguishable from actual user notifications');
// Only social notifications show the actor name. System/admin items show their content alone.
assert.match(panel, /\) : row\.text\}/,
  'completion, announcement and message notifications render their body without the SORIDRAW sender prefix');
assert.doesNotMatch(panel, /<strong>\{row\.actorName\}<\/strong>/,
  'system notification rows must not prepend SORIDRAW');
assert.match(panel, /\{' '\}\{row\.text\}/,
  'likes and follows still show the actor name followed by notification text');
assert.match(panel,/row.category === 'like' \|\| row.category === 'follow'/,
  'only likes and follows should link the sending username');
assert.match(panel,/className="soridraw-notification-actor-link"/);
assert.match(panel,/aria-label=\{row.actorName \+ ' 공개 프로필 열기'\}/);
assert.match(panel,/onClick=\{\(\) => openProfile\(row\)\}/);
assert.match(panel,/closeAndNavigate\('\/explore\?profile=' \+ encodeURIComponent\(actorUid\)\)/,
  'use the same UID-based public profile route as Explore');
assert.match(panel,/if \(visualExample && isPreviewSample\(row\)\) \{\s*setNotice\('예시 사용자에게 연결된 실제 공개 프로필은 없습니다\.'\);\s*return;/,
  'fake sample actors must never navigate to an invented profile');
assert.match(panelCss,/\.soridraw-notification-actor-link\{[\s\S]*?color:#fff/);
assert.doesNotMatch(panelCss,/\.soridraw-notification-actor-link\{[^}]*#ffbb22/,
  'actor link must keep neutral color');
console.log('NOTIFICATION_SENDER_NAME_TO_PUBLIC_PROFILE=PASS');
console.log('NOTIFICATION_NEUTRAL_WITH_SELECTED_ACCENTS_AND_RESIZE_CLOSE=PASS');

assert.match(panel,/row.category === 'announcement' \|\| row.category === 'message' \? \(/,
  'announcement and private message must use icon instead of avatar');
assert.match(panel,/className="soridraw-notification-avatar-icon" data-type=\{row.category\}/);
assert.match(panel,/className="soridraw-notification-detail-open"/);
assert.match(panel,/<ChevronRight size=\{20\} aria-hidden="true" \/>/);
assert.match(panel,/onClick=\{\(\) => setSelectedMessage\(row\)\}/);
assert.match(panel,/className="soridraw-notification-detail-backdrop"/);
assert.match(panel,/className="soridraw-notification-detail-modal" role="dialog" aria-modal="true"/);
assert.match(panel,/aria-label="메시지 닫기"/);
assert.match(panel,/className="soridraw-notification-detail-body"/);
assert.match(panel,/selectedMessage.body\?\.trim\(\) \|\| selectedMessage.text/);
assert.match(panel,/className="soridraw-notification-detail-confirm"/);
assert.match(panel,/>확인<\/button>/);
assert.match(panel,/if \(selectedMessage\) \{\s*event.stopImmediatePropagation\(\);\s*setSelectedMessage\(null\);/);
assert.match(panel,/event.stopPropagation\(\);\s*if \(event.target === event.currentTarget\) setSelectedMessage\(null\);/);
assert.match(model,/body\?: string/);
assert.match(panelCss,/\.soridraw-notification-avatar-icon\[data-type="announcement"\]\{color:#84b9ee\}/);
assert.match(panelCss,/\.soridraw-notification-avatar-icon\[data-type="message"\]\{color:#c4adf4\}/);
assert.match(panelCss,/\.soridraw-notification-detail-backdrop\{[\s\S]*?backdrop-filter:blur\(5px\)/);
assert.match(panelCss,/\.soridraw-notification-detail-modal\{[\s\S]*?width:min\(460px,100%\)/);
assert.match(panelCss,/\.soridraw-notification-detail-footer\{[\s\S]*?justify-content:center/);
assert.doesNotMatch(panel,/fetch\(|onSnapshot\(|setInterval\(/,
  'notification modal should add no network calls or polling');
console.log('NOTIFICATION_ADMIN_MESSAGE_DETAIL_MODAL=PASS');

console.log('NOTIFICATION_PANEL_UI_AND_ADMIN_SCHEDULE_SOURCE=PASS');
console.log('NOTIFICATION_PANEL_NO_POLLING_OR_REAL_USER_EVENTS=PASS');
