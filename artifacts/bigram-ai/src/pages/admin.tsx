import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BrainCircuit,
  Check,
  ChevronRight,
  FileSearch,
  KeyRound,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useLocation } from 'wouter';
import {
  getGetAdminAccountsQueryKey,
  getGetAdminChatQueryKey,
  getGetAdminChatsQueryKey,
  useBanAdminAccount,
  useGetAdminAccounts,
  useGetAdminChat,
  useGetAdminChats,
  useGrantAdmin,
  type AdminAccount,
  type AdminChatDetail,
  type AdminChatSummary,
  type ChatParticipant,
} from '@workspace/api-client-react';

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function dateLabel(value: string | null | undefined, fallback = 'Unknown date') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function shortDate(value: string | null | undefined) {
  if (!value) return 'No activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function initials(value: string) {
  return value.split(/[-_\s]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function participantName(participant: ChatParticipant) {
  return participant.isBrain ? 'Little Brain' : participant.displayName || participant.username;
}

function BrainMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--accent)/.5)] bg-[hsl(var(--accent)/.13)] text-[hsl(29_58%_40%)] ${small ? 'h-8 w-8' : 'h-10 w-10'}`}>
      <BrainCircuit className={small ? 'h-4 w-4' : 'h-5 w-5'} />
    </div>
  );
}

function StatCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">
        {icon}
        <span className="mono text-[9px] uppercase tracking-[.14em]">{label}</span>
      </div>
      <div data-testid={`text-admin-stat-${label}`} className="display mt-3 text-2xl font-semibold tracking-[-.06em]">{value}</div>
      <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{note}</div>
    </div>
  );
}

function QueryProblem({ message, onRetry, testId }: { message: string; onRetry: () => void; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-[hsl(var(--destructive)/.23)] bg-[hsl(var(--destructive)/.06)] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--destructive))]" />
        <div className="min-w-0">
          <div className="text-sm font-bold">{message}</div>
          <button data-testid={`${testId}-retry`} type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[hsl(var(--primary))]">
            <RefreshCw className="h-3 w-3" />Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountRow({ account, onBan }: { account: AdminAccount; onBan: (account: AdminAccount) => void }) {
  return (
    <div data-testid={`row-admin-account-${account.username}`} className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3.5 last:border-b-0">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${account.isBanned ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]'}`}>
        {initials(account.username)}
      </div>
      <div className="min-w-0 flex-1">
        <div data-testid={`text-admin-account-${account.username}`} className="truncate text-[12px] font-bold">@{account.username}</div>
        <div className="mono mt-0.5 text-[9px] text-[hsl(var(--muted-foreground))]">joined {shortDate(account.createdAt)}</div>
      </div>
      <div data-testid={`status-admin-account-${account.username}`} className="flex shrink-0 items-center gap-1.5">
        {account.isBanned ? (
          <span className="rounded-full bg-[hsl(var(--destructive)/.1)] px-2 py-1 text-[8px] font-bold uppercase tracking-[.08em] text-[hsl(var(--destructive))]">banned</span>
        ) : account.isAdmin ? (
          <span className="rounded-full bg-[hsl(var(--primary)/.12)] px-2 py-1 text-[8px] font-bold uppercase tracking-[.08em] text-[hsl(var(--primary))]">admin</span>
        ) : (
          <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[8px] font-bold uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">member</span>
        )}
      </div>
      {!account.isBanned && (
        <button data-testid={`button-ban-account-${account.username}`} type="button" onClick={() => onBan(account)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--destructive)/.09)] hover:text-[hsl(var(--destructive))]" aria-label={`Ban ${account.username}`}>
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function AdminChatRow({ chat, selected, onSelect }: { chat: AdminChatSummary; selected: boolean; onSelect: () => void }) {
  const people = chat.participants.filter((participant) => !participant.isBrain);
  return (
    <button data-testid={`button-admin-chat-${chat.id}`} type="button" onClick={onSelect} className={`group w-full border-b border-[hsl(var(--border))] px-4 py-4 text-left transition last:border-b-0 hover:bg-[hsl(var(--muted)/.4)] ${selected ? 'bg-[hsl(var(--primary)/.07)]' : ''}`}>
      <div className="flex items-start gap-3">
        <BrainMark small />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span data-testid={`text-admin-chat-title-${chat.id}`} className="truncate text-[12px] font-bold">{chat.title || (chat.type === 'group' ? 'Group with Little Brain' : 'Direct conversation')}</span>
            <span className="mono shrink-0 rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[8px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{chat.type}</span>
          </div>
          <div className="mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{people.map((person) => participantName(person)).join(', ') || 'Little Brain only'}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[hsl(var(--muted-foreground)/.7)]">
          <span className="mono text-[8px]">{shortDate(chat.updatedAt)}</span>
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${selected ? 'translate-x-0.5 text-[hsl(var(--primary))]' : ''}`} />
        </div>
      </div>
      <div data-testid={`text-admin-chat-preview-${chat.id}`} className="mt-3 line-clamp-2 pl-11 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">{chat.lastMessage?.content || 'No messages recorded yet.'}</div>
    </button>
  );
}

function ChatDetailPanel({ chatId, onClose }: { chatId: string | null; onClose: () => void }) {
  const query = useGetAdminChat(chatId || '', { query: { enabled: !!chatId, queryKey: getGetAdminChatQueryKey(chatId || ''), retry: false } });
  const detail = query.data as AdminChatDetail | undefined;

  if (!chatId) {
    return (
      <section data-testid="admin-chat-detail-empty" className="flex min-h-[440px] flex-1 items-center justify-center rounded-[22px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.48)] p-8 text-center">
        <div className="max-w-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.08)] text-[hsl(var(--primary))]"><FileSearch className="h-6 w-6" /></div>
          <h2 className="display mt-5 text-lg font-semibold tracking-[-.04em]">Select a conversation</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Only rooms where Little Brain participates appear in this review surface.</p>
        </div>
      </section>
    );
  }

  if (query.isLoading) {
    return <section data-testid="admin-chat-detail-loading" className="min-h-[440px] rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="h-12 w-2/3 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="mt-8 space-y-5"><div className="h-16 w-3/4 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /><div className="ml-auto h-20 w-2/3 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /><div className="h-14 w-1/2 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /></div></section>;
  }

  if (query.isError || !detail) {
    return <QueryProblem message="This conversation could not be opened." onRetry={() => query.refetch()} testId="admin-chat-detail-error" />;
  }

  return (
    <section data-testid={`panel-admin-chat-detail-${detail.id}`} className="flex min-h-[440px] min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]">
      <header className="border-b border-[hsl(var(--border))] px-5 py-4">
        <div className="flex items-start gap-3">
          <BrainMark />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 data-testid={`text-admin-detail-title-${detail.id}`} className="display truncate text-[16px] font-semibold tracking-[-.04em]">{detail.title || (detail.type === 'group' ? 'Group with Little Brain' : 'Direct conversation')}</h2>
              <span className="mono rounded-full bg-[hsl(var(--accent)/.14)] px-2 py-1 text-[8px] uppercase tracking-[.1em] text-[hsl(29_58%_40%)]">{detail.type} · brain included</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-[hsl(var(--muted-foreground))]"><span>{detail.participants.length} participants</span><span>·</span><span>updated {dateLabel(detail.updatedAt)}</span></div>
          </div>
          <button data-testid="button-close-admin-chat-detail" type="button" onClick={onClose} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" aria-label="Close conversation detail"><X className="h-4 w-4" /></button>
        </div>
        <div className="scrollbar-thin mt-4 flex gap-2 overflow-x-auto pb-0.5">
          {detail.participants.map((participant) => <div data-testid={`chip-admin-participant-${detail.id}-${participant.username}`} key={`${participant.username}-${participant.isBrain}`} className="flex shrink-0 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.45)] px-2.5 py-2"><div className={`flex h-6 w-6 items-center justify-center rounded-lg text-[8px] font-bold ${participant.isBrain ? 'bg-[hsl(var(--accent)/.14)] text-[hsl(29_58%_40%)]' : 'bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]'}`}>{participant.isBrain ? <BrainCircuit className="h-3 w-3" /> : initials(participant.username)}</div><span className="text-[10px] font-semibold">{participantName(participant)}</span></div>)}
        </div>
      </header>
      <div className="grid-paper scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
        {detail.messages.length === 0 ? (
          <div data-testid={`empty-admin-chat-messages-${detail.id}`} className="flex min-h-[250px] items-center justify-center text-center text-[11px] text-[hsl(var(--muted-foreground))]">No messages recorded in this room.</div>
        ) : detail.messages.map((message) => {
          const isBrain = message.sender.isBrain;
          return (
            <div data-testid={`row-admin-message-${message.id}`} key={message.id} className={`flex gap-2.5 ${isBrain ? 'justify-start' : 'justify-end'}`}>
              {isBrain && <BrainMark small />}
              <div className={`max-w-[84%] ${isBrain ? '' : 'text-right'}`}>
                <div className="mono mb-1.5 text-[8px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground)/.72)]">{isBrain ? 'Little Brain' : `@${message.sender.username}`} · {dateLabel(message.createdAt)}</div>
                <div data-testid={`text-admin-message-content-${message.id}`} className={`rounded-2xl px-4 py-3 text-left text-[12px] leading-relaxed ${isBrain ? 'rounded-tl-md border border-[hsl(var(--border))] bg-[hsl(var(--background)/.62)]' : 'rounded-tr-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`}>{message.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BanDialog({ account, pending, error, onCancel, onConfirm }: { account: AdminAccount; pending: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--foreground)/.42)] px-3 py-3 backdrop-blur-sm sm:items-center sm:px-5">
      <div role="dialog" aria-modal="true" aria-labelledby="ban-dialog-title" className="w-full max-w-md rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_24px_70px_rgba(31,55,48,.2)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]"><ShieldAlert className="h-5 w-5" /></div>
        <div className="mono mt-5 text-[9px] uppercase tracking-[.16em] text-[hsl(var(--destructive))]">irreversible account action</div>
        <h2 id="ban-dialog-title" className="display mt-2 text-xl font-semibold tracking-[-.045em]">Ban @{account.username}?</h2>
        <p className="mt-3 text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">This will sign the account out, block it from signing back in, and remove its saved AI history. This action cannot be undone from this workspace.</p>
        <div className="mt-4 rounded-xl border border-[hsl(var(--destructive)/.18)] bg-[hsl(var(--destructive)/.05)] px-3.5 py-3 text-[10px] leading-relaxed text-[hsl(var(--destructive))]"><AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />Review the username carefully before continuing.</div>
        {error && <div data-testid="status-ban-error" role="alert" className="mt-3 text-[11px] leading-relaxed text-[hsl(var(--destructive))]">{error}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button data-testid="button-cancel-ban" type="button" onClick={onCancel} disabled={pending} className="rounded-xl px-4 py-3 text-[11px] font-bold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] disabled:opacity-50">Keep account</button>
          <button data-testid="button-confirm-ban" type="button" onClick={onConfirm} disabled={pending} className="flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--destructive))] px-4 py-3 text-[11px] font-bold text-[hsl(var(--destructive-foreground))] transition hover:brightness-110 disabled:opacity-55">{pending ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Applying ban</> : <><Ban className="h-3.5 w-3.5" />Ban account</>}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const accountsQuery = useGetAdminAccounts({ query: { queryKey: getGetAdminAccountsQueryKey(), retry: false } });
  const chatsQuery = useGetAdminChats({ query: { queryKey: getGetAdminChatsQueryKey(), retry: false } });
  const banAccount = useBanAdminAccount();
  const grantAdmin = useGrantAdmin();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [grantUsername, setGrantUsername] = useState('');
  const [grantSuccess, setGrantSuccess] = useState('');
  const [grantError, setGrantError] = useState('');
  const [banTarget, setBanTarget] = useState<AdminAccount | null>(null);
  const [banError, setBanError] = useState('');

  const accounts = accountsQuery.data ?? [];
  const chats = useMemo(() => (chatsQuery.data ?? []).filter((chat) => chat.includeBrain), [chatsQuery.data]);
  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    return query ? accounts.filter((account) => account.username.toLowerCase().includes(query)) : accounts;
  }, [accounts, accountSearch]);
  const adminCount = accounts.filter((account) => account.isAdmin).length;
  const bannedCount = accounts.filter((account) => account.isBanned).length;

  const submitGrant = (event: FormEvent) => {
    event.preventDefault();
    setGrantError('');
    setGrantSuccess('');
    const username = grantUsername.trim();
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
      setGrantError('Use 3–32 letters, numbers, underscores, or hyphens.');
      return;
    }
    grantAdmin.mutate({ data: { username } }, {
      onSuccess: (account) => {
        queryClient.invalidateQueries({ queryKey: getGetAdminAccountsQueryKey() });
        setGrantUsername('');
        setGrantSuccess(`@${account.username} now has administrator access.`);
      },
      onError: (error) => setGrantError(errorMessage(error, 'That username was not found or could not be granted access.')),
    });
  };

  const confirmBan = () => {
    if (!banTarget) return;
    setBanError('');
    banAccount.mutate({ username: banTarget.username }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminAccountsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminChatsQueryKey() });
        if (selectedChatId) queryClient.invalidateQueries({ queryKey: getGetAdminChatQueryKey(selectedChatId) });
        setBanTarget(null);
      },
      onError: (error) => setBanError(errorMessage(error, 'The account could not be banned. Nothing was changed.')),
    });
  };

  return (
    <div className="app-shell relative min-h-[100dvh] overflow-hidden">
      <div className="noise" />
      <main className="relative mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 xl:px-10">
        <header className="reveal mb-7 flex flex-col justify-between gap-5 border-b border-[hsl(var(--border))] pb-6 md:flex-row md:items-end">
          <div>
            <div className="mono mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.17em] text-[hsl(var(--primary))]"><ShieldCheck className="h-3.5 w-3.5" />administrator workspace</div>
            <h1 data-testid="text-admin-page-title" className="display text-[clamp(2rem,4vw,3.45rem)] font-semibold leading-[.98] tracking-[-.075em]">Keep the small brain<br /><span className="text-[hsl(var(--primary))]">carefully observable.</span></h1>
            <p className="mt-4 max-w-[600px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Review conversations that include Little Brain, make account actions deliberate, and keep the boundary around private memory visible.</p>
          </div>
           <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-end">
             <button data-testid="button-admin-back" type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2.5 text-[10px] font-bold text-[hsl(var(--foreground))] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/.45)] hover:text-[hsl(var(--primary))]">
               <ArrowLeft className="h-3.5 w-3.5" />Back to workspace
             </button>
             <div data-testid="status-admin-scope" className="flex max-w-xs items-start gap-2.5 rounded-2xl border border-[hsl(var(--accent)/.25)] bg-[hsl(var(--accent)/.08)] px-3.5 py-3 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--accent))]" />This view is limited to AI-involving conversations. User-only rooms never appear here.</div>
           </div>
        </header>

        <div className="reveal grid grid-cols-2 gap-2.5 md:grid-cols-4" style={{ animationDelay: '.06s' }}>
          <StatCard label="accounts" value={accountsQuery.isLoading ? '—' : String(accounts.length)} note="local accounts" icon={<UserRound className="h-4 w-4" />} />
          <StatCard label="admins" value={accountsQuery.isLoading ? '—' : String(adminCount)} note="with elevated access" icon={<KeyRound className="h-4 w-4" />} />
          <StatCard label="banned" value={accountsQuery.isLoading ? '—' : String(bannedCount)} note="blocked accounts" icon={<Ban className="h-4 w-4" />} />
          <StatCard label="ai rooms" value={chatsQuery.isLoading ? '—' : String(chats.length)} note="conversations in scope" icon={<BrainCircuit className="h-4 w-4" />} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]">
              <div className="border-b border-[hsl(var(--border))] px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-[hsl(var(--primary))]" /><h2 className="display text-[15px] font-semibold">Account status</h2></div><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Ban accounts or inspect administrator access.</p></div>
                  <span className="mono rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[8px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{accounts.length} total</span>
                </div>
                <div className="relative mt-4"><Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground)/.7)]" /><input data-testid="input-search-admin-accounts" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Find by username" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] py-2.5 pl-9 pr-3 text-[11px] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.6)] focus:border-[hsl(var(--primary)/.55)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></div>
              </div>
              {accountsQuery.isLoading && <div data-testid="loading-admin-accounts" className="space-y-2 p-4"><div className="h-12 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-12 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-12 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /></div>}
              {accountsQuery.isError && <div className="p-4"><QueryProblem message="Account status is unavailable." onRetry={() => accountsQuery.refetch()} testId="admin-accounts-error" /></div>}
              {!accountsQuery.isLoading && !accountsQuery.isError && accounts.length === 0 && <div data-testid="empty-admin-accounts" className="p-7 text-center"><UserRound className="mx-auto h-5 w-5 text-[hsl(var(--muted-foreground)/.55)]" /><p className="mt-3 text-[11px] font-semibold">No accounts to review</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">New local accounts will appear here.</p></div>}
              {!accountsQuery.isLoading && !accountsQuery.isError && accounts.length > 0 && filteredAccounts.length === 0 && <div data-testid="empty-admin-account-search" className="p-7 text-center text-[11px] text-[hsl(var(--muted-foreground))]">No account matches “{accountSearch}”.</div>}
              {!accountsQuery.isLoading && !accountsQuery.isError && filteredAccounts.map((account) => <AccountRow key={account.username} account={account} onBan={(target) => { setBanError(''); setBanTarget(target); }} />)}
            </section>

            <section className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><KeyRound className="h-4 w-4" /></div><div><h2 className="display text-[15px] font-semibold">Grant administrator access</h2><p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Use an existing username. Access is applied immediately.</p></div></div>
              <form onSubmit={submitGrant} className="mt-4 flex gap-2">
                <input data-testid="input-grant-admin-username" value={grantUsername} onChange={(event) => { setGrantUsername(event.target.value); setGrantError(''); setGrantSuccess(''); }} maxLength={32} placeholder="username" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2.5 text-[11px] outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.6)] focus:border-[hsl(var(--primary)/.55)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" />
                <button data-testid="button-grant-admin" type="submit" disabled={grantAdmin.isPending || !grantUsername.trim()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[hsl(var(--primary))] px-3.5 py-2.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{grantAdmin.isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}Grant</button>
              </form>
              {grantError && <div data-testid="status-grant-admin-error" role="alert" className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-[hsl(var(--destructive))]"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{grantError}</div>}
              {grantSuccess && <div data-testid="status-grant-admin-success" role="status" className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-[hsl(var(--primary))]"><Check className="mt-0.5 h-3 w-3 shrink-0" />{grantSuccess}</div>}
            </section>
          </div>

          <section className="flex min-w-0 flex-col gap-5">
            <div className="grid min-h-[440px] min-w-0 gap-5 lg:grid-cols-[minmax(250px,340px)_minmax(0,1fr)]">
              <section className="overflow-hidden rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)]">
                <div className="border-b border-[hsl(var(--border))] px-4 py-4"><div className="flex items-center justify-between gap-2"><div><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-[hsl(var(--accent))]" /><h2 className="display text-[15px] font-semibold">AI conversations</h2></div><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Direct and group rooms with the brain.</p></div><span data-testid="text-admin-chat-count" className="mono rounded-full bg-[hsl(var(--accent)/.13)] px-2 py-1 text-[8px] font-bold text-[hsl(29_58%_40%)]">{chats.length}</span></div></div>
                {chatsQuery.isLoading && <div data-testid="loading-admin-chats" className="space-y-2 p-4"><div className="h-20 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-20 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-20 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /></div>}
                {chatsQuery.isError && <div className="p-4"><QueryProblem message="AI conversations are unavailable." onRetry={() => chatsQuery.refetch()} testId="admin-chats-error" /></div>}
                {!chatsQuery.isLoading && !chatsQuery.isError && chats.length === 0 && <div data-testid="empty-admin-chats" className="p-7 text-center"><BrainCircuit className="mx-auto h-5 w-5 text-[hsl(var(--muted-foreground)/.55)]" /><p className="mt-3 text-[11px] font-semibold">No AI rooms in scope</p><p className="mt-1 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">Rooms without Little Brain stay outside this workspace.</p></div>}
                {!chatsQuery.isLoading && !chatsQuery.isError && chats.map((chat) => <AdminChatRow key={chat.id} chat={chat} selected={selectedChatId === chat.id} onSelect={() => setSelectedChatId(chat.id)} />)}
              </section>
              <ChatDetailPanel chatId={selectedChatId} onClose={() => setSelectedChatId(null)} />
            </div>
            <div data-testid="admin-privacy-note" className="flex items-start gap-2.5 rounded-2xl border border-dashed border-[hsl(var(--border))] p-4 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary))]" /><span><strong className="font-bold text-[hsl(var(--foreground))]">A narrow window by design.</strong> This console exposes only conversations that involve Little Brain. It is not a directory of user-only private or group chats.</span></div>
          </section>
        </div>
      </main>
      {banTarget && <BanDialog account={banTarget} pending={banAccount.isPending} error={banError} onCancel={() => setBanTarget(null)} onConfirm={confirmBan} />}
    </div>
  );
}