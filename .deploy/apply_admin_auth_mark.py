from pathlib import Path

path = Path('src/pages/AdminUserManagementPage.tsx')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)


provider_anchor = """const getProviderKind = (user: AppUserInfo): ProviderKind => {
  if (user.authDeleted || user.authDeletedAt) return 'deleted';
  const providers = user.providerIds || [];
  const hasGoogle = providers.includes('google.com');
  const hasPassword = providers.includes('password');
  if (hasGoogle && hasPassword) return 'linked';
  if (hasGoogle) return 'google';
  if (hasPassword) return 'email';
  return 'unknown';
};

const getRecentActivityAt"""

provider_replacement = """const getProviderKind = (user: AppUserInfo): ProviderKind => {
  if (user.authDeleted || user.authDeletedAt) return 'deleted';
  const providers = user.providerIds || [];
  const hasGoogle = providers.includes('google.com');
  const hasPassword = providers.includes('password');
  if (hasGoogle && hasPassword) return 'linked';
  if (hasGoogle) return 'google';
  if (hasPassword) return 'email';
  return 'unknown';
};

const AuthAccountMark = ({ user }: { user: AppUserInfo }) => {
  const provider = getProviderKind(user);
  if (provider === 'deleted') {
    return <UserRoundX className=\"w-5 h-5 text-red-300\" />;
  }

  if (provider === 'google') {
    return <span className=\"text-[15px] font-black tracking-[-0.04em] text-sky-300\" title=\"Google 인증 회원\" aria-label=\"Google 인증 회원\">G</span>;
  }

  if (provider === 'email') {
    const isVerified = user.emailVerified === true;
    return (
      <span
        className={cn('text-[15px] font-black tracking-[-0.04em]', isVerified ? 'text-violet-300' : 'text-white')}
        title={isVerified ? '이메일 인증 회원' : '이메일 미인증 회원'}
        aria-label={isVerified ? '이메일 인증 회원' : '이메일 미인증 회원'}
      >
        E
      </span>
    );
  }

  if (provider === 'linked') {
    const isEmailVerified = user.emailVerified === true;
    return (
      <span className=\"inline-flex items-center gap-0.5 text-[13px] font-black tracking-[-0.06em]\" title=\"Google·이메일 연결 회원\" aria-label=\"Google·이메일 연결 회원\">
        <span className=\"text-sky-300\">G</span>
        <span className={isEmailVerified ? 'text-violet-300' : 'text-white'}>E</span>
      </span>
    );
  }

  return <span className=\"text-[15px] font-black text-white\" title=\"가입 방식 확인 필요\" aria-label=\"가입 방식 확인 필요\">?</span>;
};

const getRecentActivityAt"""

replace_once(provider_anchor, provider_replacement, 'insert G E account mark')
replace_once(
    """                  {user.authDeleted ? <UserRoundX className=\"w-5 h-5 text-red-300\" /> : <User className=\"w-5 h-5 text-zinc-300\" />}""",
    """                  <AuthAccountMark user={user} />""",
    'replace person icon with auth mark',
)
replace_once(
    """                  <div className=\"mt-2 flex flex-wrap gap-1.5\"><ProviderBadge user={user} /><VerificationBadge user={user} /></div>
""",
    '',
    'remove provider verification pills from member cards',
)

path.write_text(text, encoding='utf-8')
print('updated', path)
