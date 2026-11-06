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
assert.match(panelCss,/\.soridraw-notification-follow\{[\s\S]*?background:#353538;color:#f5f5f5/);
assert.match(panelCss,/\.soridraw-notification-cover\{[\s\S]*?background:#363638;color:#fff/);
assert.match(panelCss,/\.soridraw-notification-category-icon\{[^}]*color:#fff/);
assert.match(panelCss,/\.soridraw-notification-end-icon\{[^}]*color:#f5f5f5/);
assert.doesNotMatch(panelCss,/#b089ef|#ee7da2|#ad90dc|#77b4ee|#ffbb22|#FFB400/,
  'notification-specific UI must remain monochrome');
assert.match(panel,/visualExample && !settingsOpen && <span className="soridraw-notification-preview-tag">예시<\/span>/,
  'preview samples must still be distinguishable from actual user notifications');
console.log('NOTIFICATION_MONOCHROME_AND_RESIZE_CLOSE=PASS');
console.log('NOTIFICATION_PANEL_UI_AND_ADMIN_SCHEDULE_SOURCE=PASS');
console.log('NOTIFICATION_PANEL_NO_POLLING_OR_REAL_USER_EVENTS=PASS');
