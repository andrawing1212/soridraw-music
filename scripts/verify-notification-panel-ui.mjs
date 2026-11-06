import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
assert.match(panelCss,/accent-color:#ffbb22/,'checked notification categories are visibly highlighted');
assert.match(panelCss,/\.soridraw-notification-end-icon\[data-type="announcement"\],[\s\S]*?\.soridraw-notification-category-icon\[data-type="announcement"\]\{color:#84b9ee\}/);
assert.match(panelCss,/\.soridraw-notification-end-icon\[data-type="message"\],[\s\S]*?\.soridraw-notification-category-icon\[data-type="message"\]\{color:#c4adf4\}/);
assert.match(panel,/<span className="soridraw-notification-end-icon" data-type=\{row.category\}/);
assert.doesNotMatch(panelCss,/#b089ef|#ee7da2|#ad90dc|#77b4ee|#FFB400/,
  'unrequested colorful notification accents must remain removed');
assert.match(panel,/visualExample && !settingsOpen && <span className="soridraw-notification-preview-tag">예시<\/span>/,
  'preview samples must still be distinguishable from actual user notifications');
assert.match(panel,/row.category === 'like' \|\| row.category === 'follow'/,
  'only likes and follows should link the sending username');
assert.match(panel,/className="soridraw-notification-actor-link"/);
assert.match(panel,/aria-label=\{row.actorName \+ ' 공개 프로필 열기'\}/);
assert.match(panel,/onClick=\{\(\) => openProfile\(row\)\}/);
assert.match(panel,/closeAndNavigate\('\/explore\?profile=' \+ encodeURIComponent\(actorUid\)\)/,
  'use the same UID-based public profile route as Explore');
assert.match(panel,/if \(visualExample\) \{\s*setNotice\('예시 사용자에게 연결된 실제 공개 프로필은 없습니다\.'\);\s*return;/,
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
