import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  ArrowUp,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleDot,
  Cloud,
  Code2,
  ExternalLink,
  Github,
  History,
  Info,
  Menu,
  MessageSquare,
  Network,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetBrainGithubQueryKey,
  getGetBrainMessagesQueryKey,
  getGetBrainOverviewQueryKey,
  getGetBrainSnapshotsQueryKey,
  useCreateBrainSnapshot,
  useGetBrainGithub,
  useGetBrainMessages,
  useGetBrainOverview,
  useGetBrainSnapshots,
  useSendBrainMessage,
  useUpdateBrainGithub,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

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

function Sidebar({ onSettings }: { onSettings: () => void }) {
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
        <div className="flex items-center gap-3 rounded-xl bg-[hsl(var(--sidebar-accent))] px-3 py-3 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-[hsl(var(--sidebar-primary))]" />
          Live conversation
          <CircleDot className="ml-auto h-2.5 w-2.5 fill-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary))]" />
        </div>
        <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[hsl(var(--sidebar-foreground)/.56)]">
          <Network className="h-4 w-4" />
          Bigram map
          <span className="mono ml-auto text-[9px]">soon</span>
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-4 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <div className="living-dot h-2 w-2 rounded-full bg-[hsl(var(--sidebar-primary))]" />
            Learning is live
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.54)]">Every message changes the brain. Nothing is hidden behind a polished answer.</p>
        </div>
        <button data-testid="button-open-settings" onClick={onSettings} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[hsl(var(--sidebar-foreground)/.62)] transition hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]">
          <Settings2 className="h-4 w-4" />
          Backup settings
          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
        </button>
        <div className="mono mt-6 px-3 text-[9px] uppercase tracking-[.12em] text-[hsl(var(--sidebar-foreground)/.3)]">build 0.4.7 · open weights</div>
      </div>
    </aside>
  );
}

function MobileHeader({ onSettings, onMenu }: { onSettings: () => void; onMenu: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2.5">
        <button data-testid="button-open-mobile-menu" onClick={onMenu} className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))]"><Menu className="h-5 w-5" /></button>
        <BrandMark />
        <span className="display text-sm font-bold">bigram<span className="text-[hsl(var(--primary))]">.</span>ai</span>
      </div>
      <button data-testid="button-open-mobile-settings" onClick={onSettings} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))]"><Settings2 className="h-4 w-4" /></button>
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

function GithubPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const githubQuery = useGetBrainGithub({ query: { queryKey: getGetBrainGithubQueryKey() } });
  const github = githubQuery.data;
  return (
    <section className="rounded-[22px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"><Github className="h-4 w-4" /></div><div><div className="flex items-center gap-2"><h2 className="display text-[15px] font-semibold">GitHub backup</h2><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] ${github?.connected ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent)/.17)] text-[hsl(29_58%_40%)]'}`}>{github?.connected ? 'connected' : 'not connected'}</span></div><p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{github?.connected ? `Snapshots will be copied to ${github.owner}/${github.repository}.` : 'Your snapshots are local only. GitHub has not been connected yet.'}</p></div></div>
      <div className="mt-4 rounded-xl bg-[hsl(var(--muted)/.7)] p-3 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]"><Info className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" />Configure a destination now, then connect GitHub when you are ready. We never imply a remote backup exists before the connection is confirmed.</div>
      <button data-testid="button-configure-github" onClick={onOpenSettings} className="mt-4 flex w-full items-center justify-between rounded-xl border border-[hsl(var(--border))] px-3.5 py-2.5 text-xs font-semibold transition hover:bg-[hsl(var(--muted))]"><span>{github?.configured ? 'Review destination' : 'Configure destination'}</span><ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /></button>
    </section>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const githubQuery = useGetBrainGithub({ query: { queryKey: getGetBrainGithubQueryKey() } });
  const updateGithub = useUpdateBrainGithub();
  const github = githubQuery.data;
  const [owner, setOwner] = useState('');
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');

  useEffect(() => {
    if (githubQuery.data) {
      setOwner(githubQuery.data.owner ?? '');
      setRepository(githubQuery.data.repository ?? '');
      setBranch(githubQuery.data.branch ?? 'main');
    }
  }, [githubQuery.data]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    updateGithub.mutate({ data: { owner: owner.trim(), repository: repository.trim(), branch: branch.trim() || 'main' } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBrainGithubQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetBrainOverviewQueryKey() }); } });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[hsl(var(--foreground)/.35)] p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[0_24px_80px_rgba(20,45,41,.2)] sm:rounded-[26px]">
        <div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><Github className="h-4 w-4" /><h2 className="display text-lg font-semibold tracking-[-.03em]">Backup settings</h2></div><p className="mt-2 max-w-sm text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Point snapshots at a repository. This saves the destination, but it does not connect GitHub by itself.</p></div><button data-testid="button-close-settings" onClick={onClose} className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X className="h-4 w-4" /></button></div>
        {githubQuery.isError && <div className="mt-5 rounded-xl bg-[hsl(var(--destructive)/.07)] p-3 text-xs text-[hsl(var(--destructive))]">Could not load GitHub settings. You can still try saving a destination.</div>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block"><span className="mono mb-1.5 block text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Owner</span><input data-testid="input-github-owner" value={owner} onChange={(event) => setOwner(event.target.value)} required maxLength={100} placeholder="your-handle" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary)/.7)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></label>
          <label className="block"><span className="mono mb-1.5 block text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Repository</span><input data-testid="input-github-repository" value={repository} onChange={(event) => setRepository(event.target.value)} required maxLength={100} placeholder="tiny-brain" className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary)/.7)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></label>
          <label className="block"><span className="mono mb-1.5 block text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Branch</span><input data-testid="input-github-branch" value={branch} onChange={(event) => setBranch(event.target.value)} required maxLength={100} className="w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary)/.7)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" /></label>
          <div className="flex items-center justify-between gap-3 pt-2"><div className="flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">{github?.connected ? <><Check className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />GitHub connection confirmed</> : <><TriangleAlert className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />GitHub is not connected</>}</div><button data-testid="button-save-github-settings" type="submit" disabled={updateGithub.isPending || !owner.trim() || !repository.trim()} className="flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:opacity-45">{updateGithub.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{updateGithub.isPending ? 'Saving…' : 'Save destination'}</button></div>
          {updateGithub.isError && <p className="text-right text-[11px] text-[hsl(var(--destructive))]">The destination could not be saved.</p>}
          {updateGithub.isSuccess && <p className="text-right text-[11px] text-[hsl(var(--primary))]">Destination saved. GitHub is still not connected.</p>}
        </form>
      </div>
    </div>
  );
}

function MobileMenu({ onClose, onSettings }: { onClose: () => void; onSettings: () => void }) {
  return <div className="fixed inset-0 z-30 bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] lg:hidden"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><BrandMark /><span className="display font-bold">bigram<span className="text-[hsl(var(--sidebar-primary))]">.</span>ai</span></div><button data-testid="button-close-mobile-menu" onClick={onClose} className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.7)]"><X className="h-5 w-5" /></button></div><div className="mt-14 rounded-xl bg-[hsl(var(--sidebar-accent))] px-3 py-3 text-sm font-semibold"><MessageSquare className="mr-2 inline h-4 w-4 text-[hsl(var(--sidebar-primary))]" />Live conversation</div><button data-testid="button-mobile-menu-settings" onClick={onSettings} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-[hsl(var(--sidebar-foreground)/.68)]"><Settings2 className="h-4 w-4" />Backup settings</button></div>;
}

function Home() {
  const overviewQuery = useGetBrainOverview({ query: { queryKey: getGetBrainOverviewQueryKey() } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const overview = overviewQuery.data;
  const startedLabel = useMemo(() => formatDate(overview?.learningStartedAt, 'not started'), [overview?.learningStartedAt]);

  return (
    <div className="app-shell">
      <div className="noise" />
      <div className="flex min-h-[100dvh]">
        <Sidebar onSettings={() => setSettingsOpen(true)} />
        <div className="min-w-0 flex-1">
          <MobileHeader onSettings={() => setSettingsOpen(true)} onMenu={() => setMobileMenuOpen(true)} />
          <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 sm:py-8 xl:px-10">
            <header className="reveal mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><div className="mono mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[.17em] text-[hsl(var(--primary))]"><Activity className="h-3.5 w-3.5" />model observability workspace</div><h1 data-testid="text-page-title" className="display text-[clamp(2rem,4vw,3.45rem)] font-semibold leading-[.98] tracking-[-.075em]">Watch a small brain<br /><span className="text-[hsl(var(--primary))]">become itself.</span></h1><p className="mt-4 max-w-[530px] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Bigram is a transparent language model built from scratch. Teach it in public, see what it remembers, and keep every state you care about.</p></div>
              <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.72)] px-4 py-3 shadow-[var(--shadow-sm)]"><div className="living-dot flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><BrainCircuit className="h-4 w-4" /></div><div><div className="mono text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">learning since</div><div data-testid="text-learning-started" className="mt-0.5 text-xs font-semibold">{startedLabel}</div></div></div>
            </header>
            <div className="reveal grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" style={{ animationDelay: '.08s' }}>
              <div className="min-w-0"><OverviewPanel overview={overview} isLoading={overviewQuery.isLoading} isError={overviewQuery.isError} onRetry={() => overviewQuery.refetch()} /><div className="mt-5"><ChatPanel /></div></div>
              <aside className="space-y-5"><SnapshotPanel /><GithubPanel onOpenSettings={() => setSettingsOpen(true)} /><div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-4"><div className="flex items-center gap-2 text-[11px] font-semibold"><Code2 className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />A model you can read</div><p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">No hidden retrieval. No opaque weights. Just tokens, transitions, and a trail of snapshots.</p><button data-testid="button-learn-more" onClick={() => window.open('https://github.com', '_blank', 'noopener,noreferrer')} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-[hsl(var(--primary))]">Explore the idea <ExternalLink className="h-3 w-3" /></button></div></aside>
            </div>
          </main>
        </div>
      </div>
      {mobileMenuOpen && <MobileMenu onClose={() => setMobileMenuOpen(false)} onSettings={() => { setMobileMenuOpen(false); setSettingsOpen(true); }} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;