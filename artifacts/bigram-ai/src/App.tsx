import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  ArrowUp,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  Cloud,
  Code2,
  ExternalLink,
  Github,
  History,
  Info,
  KeyRound,
  LogOut,
  Menu,
  MessageSquare,
  Network,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetAuthSessionQueryKey,
  getGetBrainGithubQueryKey,
  getGetBrainMessagesQueryKey,
  getGetBrainOverviewQueryKey,
  getGetBrainSnapshotsQueryKey,
  useCreateBrainSnapshot,
  useGetAuthSession,
  useGetBrainGithub,
  useGetBrainMessages,
  useGetBrainOverview,
  useGetBrainSnapshots,
  useLogin,
  useLogout,
  useSendBrainMessage,
  useSignup,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const SOURCE_REPOSITORY_URL = 'https://github.com/TheFallenStarGG/Bigram-Learning-AI';
const DISCLAIMER_STORAGE_KEY = 'bigram-ai-disclaimer-seen';

type AuthContextValue = {
  username: string;
  signOut: () => void;
  signingOut: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('Auth context is unavailable');
  return auth;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function readDisclaimerAcknowledged() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISCLAIMER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function formatCount(value: number | undefined) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function formatDate(value: string | null | undefined, fallback = 'Not yet') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatRelative(value: string | null | undefined) {
  if (!value) return 'waiting for first snapshot';
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function BrandMark() {
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-[0_8px_20px_rgba(113,207,170,.18)]">
      <div className="absolute h-5 w-5 rounded-full border-2 border-current opacity-70" />
      <div className="absolute h-1.5 w-1.5 rounded-full bg-current" />
      <div className="absolute -right-0.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
    </div>
  );
}

function Sidebar() {
  const [location, navigate] = useLocation();
  const { username, signOut, signingOut } = useAuth();
  const sourcesActive = location === '/sources';

  return (
    <aside className="hidden min-h-[100dvh] w-[248px] shrink-0 flex-col bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] lg:flex">
      <div className="flex items-center gap-3 px-2">
        <BrandMark />
        <div>
          <div className="display text-[15px] font-bold tracking-[-.03em]">bigram<span className="text-[hsl(var(--sidebar-primary))]">.</span>ai</div>
          <div className="mono mt-0.5 text-[9px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.5)]">a tiny language engine</div>
        </div>
      </div>

      <div className="mt-12 px-2">
        <div className="mono mb-3 text-[9px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.42)]">Workspace</div>
        <button data-testid="button-nav-workspace" onClick={() => navigate('/')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${!sourcesActive ? 'bg-[hsl(var(--sidebar-accent))]' : ''}`}>
          <MessageSquare className="h-4 w-4 text-[hsl(var(--sidebar-primary))]" />
          Live conversation
          {!sourcesActive && <CircleDot className="ml-auto h-2.5 w-2.5 fill-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary))]" />}
        </button>
        <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[hsl(var(--sidebar-foreground)/.56)]">
          <Network className="h-4 w-4" />
          Bigram map
          <span className="mono ml-auto text-[9px]">soon</span>
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.5)] p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary)/.14)] text-[hsl(var(--sidebar-primary))]">
            <UserRound className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mono text-[8px] uppercase tracking-[.12em] text-[hsl(var(--sidebar-foreground)/.42)]">private account</div>
            <div data-testid="text-username" className="mt-0.5 truncate text-[11px] font-semibold">{username}</div>
          </div>
          <button data-testid="button-sign-out" type="button" onClick={signOut} disabled={signingOut} aria-label="Sign out" className="rounded-lg p-1.5 text-[hsl(var(--sidebar-foreground)/.52)] transition hover:bg-[hsl(var(--sidebar-foreground)/.08)] hover:text-[hsl(var(--sidebar-foreground))] disabled:opacity-50">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mb-4 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <div className="living-dot h-2 w-2 rounded-full bg-[hsl(var(--sidebar-primary))]" />
            Learning is live
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.54)]">Every message changes the brain. Nothing is hidden behind a polished answer.</p>
        </div>
        <button data-testid="button-nav-sources" onClick={() => navigate('/sources')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] ${sourcesActive ? 'bg-[hsl(var(--sidebar-accent))] font-semibold text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.62)]'}`}>
          <BookOpen className="h-4 w-4" />
          Sources
          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
        </button>
        <div className="mono mt-6 px-3 text-[9px] uppercase tracking-[.12em] text-[hsl(var(--sidebar-foreground)/.3)]">build 0.4.7 · open weights</div>
      </div>
    </aside>
  );
}

function MobileHeader({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2.5">
        <button data-testid="button-open-mobile-menu" onClick={onMenu} className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))]"><Menu className="h-5 w-5" /></button>
        <BrandMark />
        <span className="display text-sm font-bold">bigram<span className="text-[hsl(var(--primary))]">.</span>ai</span>
      </div>
    </header>
  );
}

function Metric({ icon, label, value, note, testId }: { icon: ReactNode; label: string; value: string; note: string; testId: string }) {
  return (
    <div className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between">
        <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>
        <span className="mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground)/.72)]">{label}</span>
      </div>
      <div data-testid={testId} className="display mt-3 text-[27px] font-semibold tracking-[-.06em]">{value}</div>
      <div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{note}</div>
    </div>
  );
}

function OverviewPanel({ overview, isLoading, isError, onRetry }: { overview: any; isLoading: boolean; isError: boolean; onRetry: () => void }) {
  if (isLoading) {
    return <div className="grid grid-cols-3 gap-2.5">{[1, 2, 3].map((item) => <div key={item} className="h-[118px] animate-pulse rounded-2xl bg-[hsl(var(--muted))]" />)}</div>;
  }
  if (isError) {
    return <div className="rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.06)] p-4"><div className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert className="h-4 w-4" />Overview unavailable</div><button data-testid="button-retry-overview" onClick={onRetry} className="mt-3 text-xs font-semibold text-[hsl(var(--primary))]">Try again</button></div>;
  }
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Metric icon={<BookOpen className="h-4 w-4" />} label="vocabulary" value={formatCount(overview?.vocabulary)} note="unique tokens learned" testId="text-metric-vocabulary" />
      <Metric icon={<Network className="h-4 w-4" />} label="bigrams" value={formatCount(overview?.bigrams)} note="word-to-word links" testId="text-metric-bigrams" />
      <Metric icon={<MessageSquare className="h-4 w-4" />} label="messages" value={formatCount(overview?.messages)} note="conversations absorbed" testId="text-metric-messages" />
    </div>
  );
}

function ChatPanel() {
  const queryClient = useQueryClient();
  const messagesQuery = useGetBrainMessages({ query: { queryKey: getGetBrainMessagesQueryKey() } });
  const sendMessage = useSendBrainMessage();
  const [draft, setDraft] = useState('');
  const messages = messagesQuery.data ?? [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sendMessage.isPending) return;
    setDraft('');
    sendMessage.mutate({ data: { message } }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetBrainMessagesQueryKey() });
        queryClient.setQueryData(getGetBrainOverviewQueryKey(), result.overview);
      },
    });
  };

  return (
    <section className="flex min-h-[620px] flex-col overflow-hidden rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] lg:min-h-0">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="display text-[15px] font-semibold">Teach the brain</span>
            <span className="rounded-full bg-[hsl(var(--accent)/.15)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-[hsl(29_58%_40%)]">live</span>
          </div>
          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Say something. It will learn the transitions in your words.</p>
        </div>
        <div className="hidden items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))] sm:flex"><div className="living-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />updates instantly</div>
      </div>

      <div className="grid-paper scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-7">
        {messagesQuery.isLoading && <div className="space-y-4"><div className="h-16 w-3/4 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /><div className="ml-auto h-14 w-2/3 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /></div>}
        {messagesQuery.isError && <div className="mx-auto max-w-sm rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--card)/.88)] p-5 text-center"><TriangleAlert className="mx-auto h-5 w-5 text-[hsl(var(--destructive))]" /><div className="mt-2 text-sm font-semibold">The conversation could not load</div><button data-testid="button-retry-messages" onClick={() => messagesQuery.refetch()} className="mt-3 text-xs font-semibold text-[hsl(var(--primary))]">Reload conversation</button></div>}
        {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 && (
          <div className="flex min-h-[330px] flex-col items-center justify-center text-center">
            <div className="brain-orbit relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.08)] text-[hsl(var(--primary))]"><BrainCircuit className="h-9 w-9" /><div className="absolute -right-1 top-3 h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /><div className="absolute -bottom-1 left-5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--chart-3))]" /></div>
            <h2 className="display mt-6 text-xl font-semibold tracking-[-.04em]">A blank brain is a good place to start.</h2>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">This model has not seen a message yet. Give it a sentence and watch its vocabulary take shape.</p>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={message.id} data-testid={`message-${message.id}`} className={`message-in flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
            {message.role !== 'user' && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]"><Zap className="h-3.5 w-3.5" /></div>}
            <div className={`max-w-[84%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${message.role === 'user' ? 'rounded-tr-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'rounded-tl-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'}`}>{message.content}</div>
              <div className={`mono mt-1.5 text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground)/.7)] ${message.role === 'user' ? 'text-right' : ''}`}>{message.role === 'user' ? 'you' : 'brain'} · {formatRelative(message.createdAt)}</div>
            </div>
          </div>
        ))}
        {sendMessage.isPending && <div className="message-in flex gap-3"><div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]"><Zap className="h-3.5 w-3.5" /></div><div className="rounded-2xl rounded-tl-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3"><div className="flex gap-1.5"><i className="living-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" /><i className="living-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" style={{ animationDelay: '.2s' }} /><i className="living-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" style={{ animationDelay: '.4s' }} /></div></div></div>}
      </div>

      <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-5">
        {sendMessage.isError && <div className="mb-3 flex items-center gap-2 text-[11px] text-[hsl(var(--destructive))]"><TriangleAlert className="h-3.5 w-3.5" />Could not teach this message. Try again.</div>}
        <form onSubmit={submit} className="relative">
          <textarea data-testid="input-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(event); } }} maxLength={2000} rows={2} placeholder="Write a sentence for the brain to learn…" className="w-full resize-none rounded-2xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3.5 pr-14 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.7)] focus:border-[hsl(var(--primary)/.6)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" />
          <button data-testid="button-send-message" type="submit" disabled={!draft.trim() || sendMessage.isPending} className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"><ArrowUp className="h-4 w-4" /></button>
        </form>
        <div className="mt-2 flex items-center justify-between px-1"><span className="text-[10px] text-[hsl(var(--muted-foreground))]">Enter to teach · Shift + Enter for a new line</span><span className="mono text-[9px] text-[hsl(var(--muted-foreground)/.7)]">{draft.length}/2000</span></div>
      </div>
    </section>
  );
}

function SnapshotPanel() {
  const queryClient = useQueryClient();
  const snapshotsQuery = useGetBrainSnapshots({ query: { queryKey: getGetBrainSnapshotsQueryKey() } });
  const createSnapshot = useCreateBrainSnapshot();
  const snapshots = snapshotsQuery.data ?? [];

  const create = () => createSnapshot.mutate(undefined, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBrainSnapshotsQueryKey() }) });

  return (
    <section className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Archive className="h-4 w-4 text-[hsl(var(--accent))]" /><h2 className="display text-[15px] font-semibold">Model snapshots</h2></div><p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Small, inspectable checkpoints of the brain’s current state.</p></div>
        <button data-testid="button-create-snapshot" onClick={create} disabled={createSnapshot.isPending} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-2.5 py-2 text-[10px] font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))] disabled:opacity-50"><Save className="h-3 w-3" />{createSnapshot.isPending ? 'Saving' : 'Save now'}</button>
      </div>
      {snapshotsQuery.isLoading && <div className="mt-5 space-y-2"><div className="h-12 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-12 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /></div>}
      {snapshotsQuery.isError && <div className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.06)] p-3 text-xs text-[hsl(var(--destructive))]"><TriangleAlert className="mb-1 h-4 w-4" />Snapshot history is unavailable.</div>}
      {!snapshotsQuery.isLoading && !snapshotsQuery.isError && snapshots.length === 0 && <div data-testid="empty-snapshots" className="mt-5 rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-5 text-center"><Cloud className="mx-auto h-5 w-5 text-[hsl(var(--muted-foreground)/.65)]" /><p className="mt-2 text-[11px] font-semibold">No checkpoints yet</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Save one when the brain reaches a moment worth keeping.</p></div>}
      <div className="mt-5 space-y-2">
        {snapshots.slice(0, 4).map((snapshot) => <div key={snapshot.id} data-testid={`row-snapshot-${snapshot.id}`} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] px-3 py-2.5"><div className={`flex h-7 w-7 items-center justify-center rounded-lg ${snapshot.status === 'failed' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : snapshot.status === 'github' ? 'bg-[hsl(var(--accent)/.14)] text-[hsl(29_58%_40%)]' : 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]'}`}><History className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{snapshot.filename}</div><div className="mono mt-0.5 text-[9px] text-[hsl(var(--muted-foreground))]">{formatDate(snapshot.createdAt)} · {formatCount(snapshot.bigrams)} links</div></div><span className="mono text-[9px] uppercase tracking-[.08em] text-[hsl(var(--muted-foreground))]">{snapshot.status}</span></div>)}
      </div>
    </section>
  );
}

function GithubPanel() {
  const githubQuery = useGetBrainGithub({ query: { queryKey: getGetBrainGithubQueryKey() } });
  const github = githubQuery.data;
  return (
    <section className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"><Github className="h-4 w-4" /></div><div><div className="flex items-center gap-2"><h2 className="display text-[15px] font-semibold">Private GitHub backup</h2><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] ${github?.connected ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.17)] text-[hsl(29_58%_40%)]'}`}>{github?.connected ? 'linked' : 'unavailable'}</span></div><p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{github?.connected ? 'Every five-minute snapshot is written to a private repository and becomes the model’s memory source for the next chat.' : 'Private GitHub backups are temporarily unavailable.'}</p></div></div>
       <div className="mt-4 rounded-xl bg-[hsl(var(--muted)/.7)] p-3 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]"><Info className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />Snapshot files stay separate from the open-source project. The app always reads the latest private snapshot before learning from a new message.</div>
    </section>
  );
}

function DisclaimerModal({ onDismiss }: { onDismiss: () => void }) {
  const [isOpen, setIsOpen] = useState(() => {
    return !readDisclaimerAcknowledged();
  });

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
    } catch {
      // The notice can still be dismissed if browser storage is unavailable.
    }
    setIsOpen(false);
    onDismiss();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.42)] px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="w-full max-w-lg rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_24px_70px_rgba(31,55,48,.18)] sm:p-8"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]">
          <Info className="h-5 w-5" />
        </div>
        <div className="mono mt-6 text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">before you begin</div>
        <h2 id="disclaimer-title" className="display mt-2 text-2xl font-semibold tracking-[-.045em]">A note about Bigram</h2>
        <p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          Bigram is an AI that learns exclusively from what people teach it. It has no training data beyond the words and phrases shared with it here.
        </p>
        <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          Repetition is expected. Bigram learns in an intentionally simple, early-stage way—much like a toddler: by copying language, forming connections between words, and gradually discovering how to generate sentences of its own.
        </p>
        <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          Its responses may be limited or repetitive while it learns. That is a normal part of watching this small model develop.
        </p>
        <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          Bigram is entirely open source. You can explore its code from the Sources tab, while conversations are kept private and separate from the public source project.
        </p>
        <button
          type="button"
          autoFocus
          onClick={dismiss}
          className="mt-7 w-full rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[hsl(var(--primary)/.18)]"
        >
          Continue to Bigram
        </button>
      </div>
    </div>
  );
}

function SessionLoading() {
  return (
    <div className="app-shell relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5">
      <div className="noise" />
      <div className="relative w-full max-w-md rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.82)] p-7 shadow-[var(--shadow-md)] backdrop-blur">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <div className="display text-[15px] font-bold tracking-[-.03em]">bigram<span className="text-[hsl(var(--primary))]">.</span>ai</div>
            <div className="mono mt-0.5 text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">checking private memory</div>
          </div>
        </div>
        <div className="mt-9 space-y-3" aria-label="Loading account">
          <div className="h-2 w-2/5 animate-pulse rounded-full bg-[hsl(var(--muted))]" />
          <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
          <div className="h-11 animate-pulse rounded-xl bg-[hsl(var(--muted))]" />
        </div>
      </div>
    </div>
  );
}

function AccountGate({ initialMessage, onAuthenticated }: { initialMessage?: string; onAuthenticated: (session: { authenticated: boolean; username: string | null }) => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const login = useLogin();
  const signup = useSignup();
  const isPending = login.isPending || signup.isPending;

  const finishAuth = (session: { authenticated: boolean; username: string | null }) => {
    queryClient.setQueryData(getGetAuthSessionQueryKey(), session);
    queryClient.invalidateQueries({ queryKey: getGetAuthSessionQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBrainMessagesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBrainOverviewQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBrainSnapshotsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBrainGithubQueryKey() });
    onAuthenticated(session);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const cleanUsername = username.trim();
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(cleanUsername)) {
      setFormError('Use 3–32 letters, numbers, underscores, or hyphens.');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setFormError('Your password must be between 8 and 128 characters.');
      return;
    }
    if (mode === 'create' && password !== confirmPassword) {
      setFormError('The passwords do not match.');
      return;
    }
    const data = { username: cleanUsername, password };
    const options = {
      onSuccess: (session: { authenticated: boolean; username: string | null; message?: string }) => {
        if (!session.authenticated || !session.username) {
          setFormError(session.message || 'The account could not be opened.');
          return;
        }
        finishAuth(session);
      },
      onError: (error: unknown) => setFormError(getErrorMessage(error, mode === 'create' ? 'That account could not be created.' : 'Those details did not open an account.')),
    };
    if (mode === 'create') signup.mutate({ data }, options);
    else login.mutate({ data }, options);
  };

  return (
    <div className="app-shell relative min-h-[100dvh] overflow-hidden">
      <div className="noise" />
      <div className="mx-auto grid min-h-[100dvh] max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <section className="account-grid relative hidden overflow-hidden bg-[hsl(var(--sidebar))] px-10 py-10 text-[hsl(var(--sidebar-foreground))] lg:flex lg:flex-col xl:px-16">
          <div className="relative z-10 flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="display text-[15px] font-bold tracking-[-.03em]">bigram<span className="text-[hsl(var(--sidebar-primary))]">.</span>ai</div>
              <div className="mono mt-0.5 text-[9px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.5)]">a tiny language engine</div>
            </div>
          </div>
          <div className="relative z-10 mt-auto max-w-[610px] pb-6 pt-20">
            <div className="mono mb-5 flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-primary))]"><ShieldCheck className="h-3.5 w-3.5" />your memory, kept apart</div>
            <h1 className="display max-w-[640px] text-[clamp(3.4rem,6vw,6.5rem)] font-semibold leading-[.9] tracking-[-.09em]">Give the brain<br /><span className="text-[hsl(var(--sidebar-primary))]">a place to remember.</span></h1>
            <p className="mt-7 max-w-[480px] text-[14px] leading-7 text-[hsl(var(--sidebar-foreground)/.62)]">Create a small local account so your conversation can follow you. The language model stays shared; your words and snapshots stay private.</p>
          </div>
          <div className="relative z-10 mt-auto flex items-end justify-between border-t border-[hsl(var(--sidebar-border))] pt-5">
            <div className="mono text-[9px] uppercase tracking-[.14em] text-[hsl(var(--sidebar-foreground)/.36)]">local account flow / 01</div>
            <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--sidebar-foreground)/.48)]"><div className="living-dot h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />private by default</div>
          </div>
          <div className="pointer-events-none absolute right-[11%] top-[22%] h-64 w-64 rounded-full border border-[hsl(var(--sidebar-primary)/.18)]"><div className="orbit-line absolute inset-[-1px] rounded-full border-t border-[hsl(var(--sidebar-primary)/.65)]" /><div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[30px] border border-[hsl(var(--sidebar-primary)/.35)] bg-[hsl(var(--sidebar-primary)/.08)] text-[hsl(var(--sidebar-primary))]"><BrainCircuit className="h-10 w-10" /><span className="absolute -right-2 top-2 h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /></div><div className="absolute left-[12%] top-[20%] h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /><div className="absolute bottom-[16%] right-[8%] h-1.5 w-1.5 rounded-full bg-[hsl(var(--chart-3))]" /></div>
          <div className="scan-line pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-[hsl(var(--sidebar-primary)/.22)]" />
        </section>

        <main className="flex min-h-[100dvh] items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-[390px]">
            <div className="mb-9 flex items-center gap-3 lg:hidden"><BrandMark /><div><div className="display text-[15px] font-bold">bigram<span className="text-[hsl(var(--primary))]">.</span>ai</div><div className="mono text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">a tiny language engine</div></div></div>
            <div className="reveal">
              <div className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">{mode === 'create' ? 'new account' : 'welcome back'}</div>
              <h2 data-testid="text-account-title" className="display mt-3 text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[.96] tracking-[-.075em]">{mode === 'create' ? 'Start with a blank brain.' : 'Return to your brain.'}</h2>
              <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{mode === 'create' ? 'One username. One private conversation. No social profile attached.' : 'Sign in to restore the conversation you have been teaching.'}</p>
            </div>

            <div className="mt-8 flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.48)] p-1">
              <button data-testid="button-mode-sign-in" type="button" onClick={() => { setMode('signin'); setFormError(''); }} className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-bold transition ${mode === 'signin' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-[var(--shadow-sm)]' : 'text-[hsl(var(--muted-foreground))]'}`}>Sign in</button>
              <button data-testid="button-mode-create-account" type="button" onClick={() => { setMode('create'); setFormError(''); }} className={`flex-1 rounded-lg px-3 py-2.5 text-xs font-bold transition ${mode === 'create' ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-[var(--shadow-sm)]' : 'text-[hsl(var(--muted-foreground))]'}`}>Create account</button>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block"><span className="mono mb-2 block text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">username</span><div className="relative"><UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground)/.7)]" /><input data-testid="input-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" maxLength={32} placeholder="your-name" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] py-3.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.55)] focus:border-[hsl(var(--primary)/.65)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></div></label>
              <label className="block"><span className="mono mb-2 block text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">password</span><div className="relative"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground)/.7)]" /><input data-testid="input-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} maxLength={128} placeholder="8 characters minimum" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] py-3.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.55)] focus:border-[hsl(var(--primary)/.65)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></div></label>
              {mode === 'create' && <label className="block"><span className="mono mb-2 block text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">confirm password</span><div className="relative"><ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground)/.7)]" /><input data-testid="input-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" maxLength={128} placeholder="repeat your password" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] py-3.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.55)] focus:border-[hsl(var(--primary)/.65)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></div></label>}
              {(formError || initialMessage) && <div data-testid="status-auth-error" className="flex items-start gap-2 rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] px-3.5 py-3 text-xs leading-5 text-[hsl(var(--destructive))]"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{formError || initialMessage}</div>}
              <button data-testid="button-submit-auth" type="submit" disabled={isPending} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[hsl(var(--primary)/.18)] disabled:cursor-not-allowed disabled:opacity-55">{isPending ? 'Opening private memory…' : mode === 'create' ? 'Create my account' : 'Sign in'}{!isPending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}</button>
            </form>
            <div className="mt-7 flex items-start gap-2.5 border-t border-[hsl(var(--border))] pt-5 text-[10px] leading-5 text-[hsl(var(--muted-foreground))]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary))]" /><span>Your conversation is restored from a private account space. Bigram's shared model is separate from your memory.</span></div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const [location, navigate] = useLocation();
  const { username, signOut, signingOut } = useAuth();
  const goTo = (path: string) => {
    navigate(path);
    onClose();
  };

  return <div className="fixed inset-0 z-30 bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] lg:hidden"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><BrandMark /><span className="display font-bold">bigram<span className="text-[hsl(var(--sidebar-primary))]">.</span>ai</span></div><button data-testid="button-close-mobile-menu" onClick={onClose} className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.7)]"><X className="h-5 w-5" /></button></div><div className="mt-12 flex items-center gap-3 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.5)] p-3"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary)/.14)] text-[hsl(var(--sidebar-primary))]"><UserRound className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><div className="mono text-[8px] uppercase tracking-[.12em] text-[hsl(var(--sidebar-foreground)/.42)]">private account</div><div data-testid="text-mobile-username" className="truncate text-[11px] font-semibold">{username}</div></div><button data-testid="button-mobile-sign-out" type="button" onClick={signOut} disabled={signingOut} className="rounded-lg p-1.5 text-[hsl(var(--sidebar-foreground)/.58)]"><LogOut className="h-3.5 w-3.5" /></button></div><button data-testid="button-mobile-nav-workspace" onClick={() => goTo('/')} className={`mt-7 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${location !== '/sources' ? 'bg-[hsl(var(--sidebar-accent))]' : ''}`}><MessageSquare className="h-4 w-4 text-[hsl(var(--sidebar-primary))]" />Live conversation</button><button data-testid="button-mobile-nav-sources" onClick={() => goTo('/sources')} className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${location === '/sources' ? 'bg-[hsl(var(--sidebar-accent))] font-semibold' : 'text-[hsl(var(--sidebar-foreground)/.68)]'}`}><BookOpen className="h-4 w-4" />Sources</button></div>;
}

function Home() {
  const overviewQuery = useGetBrainOverview({ query: { queryKey: getGetBrainOverviewQueryKey() } });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const overview = overviewQuery.data;
  const startedLabel = useMemo(() => formatDate(overview?.learningStartedAt, 'not started'), [overview?.learningStartedAt]);

  return (
    <div className="app-shell">
      <div className="noise" />
      <div className="flex min-h-[100dvh]">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <MobileHeader onMenu={() => setMobileMenuOpen(true)} />
          <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 sm:py-8 xl:px-10">
            <header className="reveal mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><div className="mono mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.17em] text-[hsl(var(--primary))]"><Activity className="h-3.5 w-3.5" />model observability workspace</div><h1 data-testid="text-page-title" className="display text-[clamp(2rem,4vw,3.45rem)] font-semibold leading-[.98] tracking-[-.075em]">Watch a small brain<br /><span className="text-[hsl(var(--primary))]">become itself.</span></h1><p className="mt-4 max-w-[530px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Bigram is a transparent language model built from scratch. Teach it in public, see what it remembers, and keep every state you care about.</p></div>
              <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] px-4 py-3 shadow-[var(--shadow-sm)]"><div className="living-dot flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><BrainCircuit className="h-4 w-4" /></div><div><div className="mono text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">learning since</div><div data-testid="text-learning-started" className="mt-0.5 text-xs font-semibold">{startedLabel}</div></div></div>
            </header>
            <div className="reveal grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" style={{ animationDelay: '.08s' }}>
              <div className="min-w-0"><OverviewPanel overview={overview} isLoading={overviewQuery.isLoading} isError={overviewQuery.isError} onRetry={() => overviewQuery.refetch()} /><div className="mt-5"><ChatPanel /></div></div>
              <aside className="space-y-5"><SnapshotPanel /><GithubPanel /><div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-4"><div className="flex items-center gap-2 text-[11px] font-semibold"><Code2 className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />A model you can read</div><p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">No hidden retrieval. No opaque weights. Just tokens, transitions, and a trail of snapshots.</p><a data-testid="button-learn-more" href={SOURCE_REPOSITORY_URL} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-[hsl(var(--primary))]">Explore the idea <ExternalLink className="h-3 w-3" /></a></div></aside>
            </div>
          </main>
        </div>
      </div>
      {mobileMenuOpen && <MobileMenu onClose={() => setMobileMenuOpen(false)} />}
    </div>
  );
}

function SourcesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className="noise" />
      <div className="flex min-h-[100dvh]">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <MobileHeader onMenu={() => setMobileMenuOpen(true)} />
          <main className="mx-auto max-w-[1100px] px-4 py-5 sm:px-7 sm:py-8 xl:px-10">
            <header className="reveal mb-8">
              <div className="mono mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.17em] text-[hsl(var(--primary))]"><BookOpen className="h-3.5 w-3.5" />sources</div>
              <h1 className="display text-[clamp(2rem,4vw,3.45rem)] font-semibold leading-[.98] tracking-[-.075em]">Built in the open.<br /><span className="text-[hsl(var(--primary))]">Nothing hidden.</span></h1>
              <p className="mt-4 max-w-[560px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">The entire Bigram AI project is open source. Read the code, follow how the model learns, and build on the same transparent foundation.</p>
            </header>
            <section className="reveal max-w-2xl rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-sm)] sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"><Github className="h-6 w-6" /></div>
              <h2 className="display mt-6 text-2xl font-semibold tracking-[-.04em]">Bigram AI source code</h2>
              <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">The source repository contains the app, the from-scratch word-level model, and the API that powers this workspace.</p>
              <a data-testid="link-source-repository" href={SOURCE_REPOSITORY_URL} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110">View the source repository <ExternalLink className="h-3.5 w-3.5" /></a>
              <div className="mt-8 border-t border-[hsl(var(--border))] pt-5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]"><Sparkles className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] text-[hsl(var(--accent))]" />Private model snapshots and conversation memory are kept separately from this public source project.</div>
            </section>
          </main>
        </div>
      </div>
      {mobileMenuOpen && <MobileMenu onClose={() => setMobileMenuOpen(false)} />}
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AuthenticatedApp({ session }: { session: { username: string } }) {
  const queryClient = useQueryClient();
  const logout = useLogout();
  const signOut = () => {
    if (logout.isPending) return;
    logout.mutate(undefined, {
      onSuccess: (nextSession) => {
        queryClient.setQueryData(getGetAuthSessionQueryKey(), nextSession);
        queryClient.invalidateQueries({ queryKey: getGetAuthSessionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBrainMessagesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBrainOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBrainSnapshotsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBrainGithubQueryKey() });
      },
    });
  };

  return <AuthContext.Provider value={{ username: session.username, signOut, signingOut: logout.isPending }}><Router /></AuthContext.Provider>;
}

function AuthAwareApp({ disclaimerAcknowledged }: { disclaimerAcknowledged: boolean }) {
  const queryClient = useQueryClient();
  const authQuery = useGetAuthSession({
    query: {
      queryKey: getGetAuthSessionQueryKey(),
      enabled: disclaimerAcknowledged,
      retry: false,
    },
  });

  if (!disclaimerAcknowledged || authQuery.isLoading) return <SessionLoading />;
  if (authQuery.data?.authenticated && authQuery.data.username) return <AuthenticatedApp session={{ username: authQuery.data.username }} />;
  return <AccountGate initialMessage={authQuery.isError ? 'The account service is taking a moment. Try again when it is ready.' : authQuery.data?.message} onAuthenticated={(nextSession) => queryClient.setQueryData(getGetAuthSessionQueryKey(), nextSession)} />;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/sources" component={SourcesPage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function App() {
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(readDisclaimerAcknowledged);
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AuthAwareApp disclaimerAcknowledged={disclaimerAcknowledged} /></WouterRouter><Toaster /><DisclaimerModal onDismiss={() => setDisclaimerAcknowledged(true)} /></TooltipProvider></QueryClientProvider>;
}

export default App;