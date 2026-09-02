import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  BrainCircuit,
  Check,
  ChevronLeft,
  CircleDot,
  LoaderCircle,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getGetChatQueryKey,
  getGetChatsQueryKey,
  useCreateChat,
  useGetChat,
  useGetChats,
  useSendChatMessage,
  type ChatDetail,
  type ChatParticipant,
  type ChatSummary,
} from '@workspace/api-client-react';
import { useLocation } from 'wouter';

type ChatsPageProps = { username: string; embedded?: boolean };
type ChatMode = 'private' | 'group';

function errorText(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function formatTime(value: string | null | undefined) {
  if (!value) return 'No messages yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'A moment ago';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDay(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

function displayName(username: string) {
  return username
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || username;
}

function BrainBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.18)] text-[hsl(29_58%_40%)] ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}>
      <BrainCircuit className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
    </div>
  );
}

function PersonBadge({ person, compact = false }: { person: ChatParticipant; compact?: boolean }) {
  if (person.isBrain) return <BrainBadge compact={compact} />;
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.12)] font-semibold text-[hsl(var(--primary))] ${compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs'}`}>
      {initials(person.displayName)}
    </div>
  );
}

function ParticipantLine({ person, signedInUsername }: { person: ChatParticipant; signedInUsername: string }) {
  const isYou = person.username === signedInUsername && !person.isBrain;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PersonBadge person={person} compact />
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold">
          {person.isBrain ? 'Little Brain' : person.displayName}
          {isYou && <span className="ml-1.5 text-[9px] font-medium text-[hsl(var(--primary))]">you</span>}
        </div>
        <div className="mono truncate text-[9px] text-[hsl(var(--muted-foreground))]">{person.isBrain ? 'from-scratch model' : `@${person.username}`}</div>
      </div>
    </div>
  );
}

function ChatListItem({
  chat,
  selected,
  onSelect,
}: {
  chat: ChatSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const brain = chat.participants.find((person) => person.isBrain);
  const people = chat.participants.filter((person) => !person.isBrain);
  return (
    <button
      type="button"
      data-testid={`button-chat-${chat.id}`}
      onClick={onSelect}
      className={`group w-full rounded-2xl border p-3 text-left transition ${selected ? 'border-[hsl(var(--primary)/.34)] bg-[hsl(var(--primary)/.07)] shadow-[var(--shadow-sm)]' : 'border-transparent hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.55)]'}`}
    >
      <div className="flex items-start gap-3">
        {brain ? <BrainBadge compact /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><UsersRound className="h-4 w-4" /></div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[12px] font-bold">{chat.title || (chat.type === 'group' ? 'Group conversation' : 'Private conversation')}</div>
            {selected && <CircleDot className="h-2.5 w-2.5 shrink-0 fill-[hsl(var(--primary))] text-[hsl(var(--primary))]" />}
          </div>
          <div className="mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">
            {people.map((person) => person.displayName).join(', ') || 'Little Brain'}
            {chat.type === 'group' && <span className="ml-1.5 text-[hsl(var(--muted-foreground)/.65)]">· group</span>}
          </div>
        </div>
        <div className="mono shrink-0 text-[8px] text-[hsl(var(--muted-foreground)/.7)]">{formatDay(chat.updatedAt)}</div>
      </div>
      <div className="mt-3 flex items-center gap-2 pl-11">
        <span className="line-clamp-1 flex-1 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">{chat.lastMessage?.content || 'Start the conversation'}</span>
        {chat.includeBrain && <span className="mono shrink-0 rounded-full bg-[hsl(var(--accent)/.16)] px-1.5 py-0.5 text-[8px] uppercase tracking-[.08em] text-[hsl(29_58%_40%)]">brain</span>}
      </div>
    </button>
  );
}

function CreateChatDialog({
  mode,
  onModeChange,
  username,
  onClose,
  onCreated,
}: {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  username: string;
  onClose: () => void;
  onCreated: (chat: ChatDetail) => void;
}) {
  const queryClient = useQueryClient();
  const createChat = useCreateChat();
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [includeBrain, setIncludeBrain] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setParticipants([]);
    setParticipantInput('');
    setIncludeBrain(false);
    setFormError('');
  }, [mode]);

  const addParticipant = () => {
    const next = participantInput.trim().replace(/^@/, '');
    if (!next) return;
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(next)) {
      setFormError('Usernames use 3–32 letters, numbers, underscores, or hyphens.');
      return;
    }
    if (next.toLowerCase() === username.toLowerCase()) {
      setFormError('You are already included in this chat.');
      return;
    }
    if (participants.some((participant) => participant.toLowerCase() === next.toLowerCase())) {
      setFormError('That person is already on the invite list.');
      return;
    }
    if (mode === 'private' && participants.length >= 1) {
      setFormError('A private chat can only have one other person.');
      return;
    }
    setParticipants((current) => [...current, next]);
    setParticipantInput('');
    setFormError('');
  };

  const removeParticipant = (participant: string) => {
    setParticipants((current) => current.filter((item) => item !== participant));
    setFormError('');
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addParticipant();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (participants.length < 1) {
      setFormError(mode === 'private' ? 'Add exactly one username to start a private chat.' : 'Add at least one username to start a group chat.');
      return;
    }
    if (mode === 'private' && participants.length !== 1) {
      setFormError('A private chat needs exactly one other person.');
      return;
    }
    createChat.mutate(
      { data: { type: mode, participantUsernames: participants, includeBrain: mode === 'group' && includeBrain } },
      {
        onSuccess: (chat) => {
          queryClient.setQueryData(getGetChatQueryKey(chat.id), chat);
          queryClient.invalidateQueries({ queryKey: getGetChatsQueryKey() });
          onCreated(chat);
        },
        onError: (error) => setFormError(errorText(error, 'The chat could not be created. Check the usernames and try again.')),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[hsl(var(--foreground)/.36)] px-3 py-3 backdrop-blur-sm sm:items-center sm:px-5">
      <div role="dialog" aria-modal="true" aria-labelledby="create-chat-title" className="w-full max-w-lg overflow-hidden rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_24px_70px_rgba(31,55,48,.2)]">
        <div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-5 py-5 sm:px-7">
          <div>
            <div className="mono text-[9px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">new private space</div>
            <h2 id="create-chat-title" className="display mt-1.5 text-xl font-semibold tracking-[-.045em]">Start a conversation</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Choose who gets a quiet room with you.</p>
          </div>
          <button type="button" aria-label="Close create chat" onClick={onClose} className="rounded-xl p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 border-b border-[hsl(var(--border))] px-5 py-4 sm:px-7">
          {(['private', 'group'] as ChatMode[]).map((option) => (
            <button key={option} type="button" onClick={() => onModeChange(option)} className={`rounded-xl border px-3 py-2.5 text-left transition ${mode === option ? 'border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.08)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/.6)]'}`}>
              <div className="flex items-center gap-2 text-[11px] font-bold">{option === 'private' ? <UserRound className="h-3.5 w-3.5 text-[hsl(var(--primary))]" /> : <UsersRound className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />}{option === 'private' ? 'Private chat' : 'Group chat'}</div>
              <div className="mt-1 text-[9px] text-[hsl(var(--muted-foreground))]">{option === 'private' ? 'You and one person' : 'You and your people'}</div>
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div>
            <label htmlFor="participant-usernames" className="text-[11px] font-bold">Invite by username</label>
            <div className="mt-2 flex gap-2">
              <input id="participant-usernames" data-testid="input-participant-username" value={participantInput} onChange={(event) => { setParticipantInput(event.target.value); setFormError(''); }} onKeyDown={onInputKeyDown} placeholder="@username" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)] focus:border-[hsl(var(--primary)/.6)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" />
              <button type="button" onClick={addParticipant} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[hsl(var(--border))] px-3.5 text-[11px] font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--muted))]"><Plus className="h-3.5 w-3.5" />Add</button>
            </div>
            <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">Press Enter or Add after each username. Your account is included automatically.</p>
            <div className="mt-3 flex min-h-10 flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.07)] px-2.5 py-2"><div className="flex h-5 w-5 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-[9px] font-bold text-[hsl(var(--primary-foreground))]">{initials(username)}</div><span><span className="block text-[10px] font-semibold">You</span><span className="mono block text-[8px] text-[hsl(var(--muted-foreground))]">@{username}</span></span><Check className="h-3 w-3 text-[hsl(var(--primary))]" /></div>
              {participants.map((participant) => <div key={participant} className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.55)] px-2.5 py-2"><span className="text-[10px] font-semibold">@{participant}</span><button type="button" onClick={() => removeParticipant(participant)} aria-label={`Remove ${participant}`} className="rounded-md p-0.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card))] hover:text-[hsl(var(--foreground))]"><X className="h-3 w-3" /></button></div>)}
            </div>
          </div>
          {mode === 'group' && (
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] p-3.5">
              <input type="checkbox" checked={includeBrain} onChange={(event) => setIncludeBrain(event.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.16)] text-[hsl(29_58%_40%)]"><BrainCircuit className="h-4 w-4" /></span>
              <span className="flex-1"><span className="block text-[11px] font-bold">Include Little Brain</span><span className="mt-0.5 block text-[9px] leading-relaxed text-[hsl(var(--muted-foreground))]">The small model can listen and respond in this room.</span></span>
            </label>
          )}
          {formError && <div role="alert" className="rounded-xl border border-[hsl(var(--destructive)/.22)] bg-[hsl(var(--destructive)/.06)] px-3 py-2.5 text-[11px] leading-relaxed text-[hsl(var(--destructive))]">{formError}</div>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-[11px] font-bold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]">Cancel</button>
            <button type="submit" disabled={createChat.isPending} className="flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-[11px] font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55">{createChat.isPending ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Creating room</> : <><MessageCircle className="h-3.5 w-3.5" />Create {mode} chat</>}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatMessages({
  detail,
  username,
  isLoading,
  isError,
  onRetry,
}: {
  detail: ChatDetail | undefined;
  username: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const messages = detail?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isLoading) {
    return <div className="grid-paper flex-1 space-y-5 overflow-hidden px-5 py-8 sm:px-8"><div className="h-12 w-[65%] animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /><div className="ml-auto h-16 w-[58%] animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /><div className="h-14 w-[48%] animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /></div>;
  }
  if (isError) {
    return <div className="grid-paper flex flex-1 items-center justify-center px-5"><div className="max-w-xs text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--destructive))]"><RefreshCw className="h-5 w-5" /></div><h3 className="display mt-4 text-base font-semibold">This room is out of reach</h3><p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">The latest messages could not be loaded. Your room is still private and intact.</p><button type="button" onClick={onRetry} className="mt-4 text-[11px] font-bold text-[hsl(var(--primary))]">Try again</button></div></div>;
  }
  if (!messages.length) {
    return <div className="grid-paper flex flex-1 items-center justify-center px-5"><div className="max-w-xs text-center"><div className="brain-orbit mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-[hsl(var(--primary)/.22)] bg-[hsl(var(--primary)/.07)] text-[hsl(var(--primary))]"><MessageCircle className="h-7 w-7" /></div><h3 className="display mt-5 text-lg font-semibold tracking-[-.04em]">The room is ready.</h3><p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Say something honest, useful, or small. This conversation belongs to the people in it.</p></div></div>;
  }
  return (
    <div className="grid-paper scrollbar-thin min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-8">
      {messages.map((message, index) => {
        const mine = message.sender.username === username && !message.sender.isBrain;
        return (
          <div key={message.id} data-testid={`chat-message-${message.id}`} className={`message-in flex gap-2.5 ${mine ? 'justify-end' : 'justify-start'}`} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
            {!mine && <PersonBadge person={message.sender} compact />}
            <div className={`max-w-[84%] ${mine ? 'items-end' : 'items-start'}`}>
              <div className={`mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${mine ? 'justify-end' : ''}`}><span className="mono text-[8px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground)/.75)]">{mine ? 'You' : message.sender.displayName}</span><span className="mono text-[8px] text-[hsl(var(--muted-foreground)/.55)]">@{message.sender.username} · {formatTime(message.createdAt)}</span></div>
              <div className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${mine ? 'rounded-tr-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'rounded-tl-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'}`}>{message.content}</div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
      <span className="sr-only">{username} is in this conversation</span>
    </div>
  );
}

function Conversation({
  chat,
  username,
  onBack,
  onNewChat,
}: {
  chat: ChatSummary;
  username: string;
  onBack: () => void;
  onNewChat: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const sendMessage = useSendChatMessage();
  const detailQuery = useGetChat(chat.id, { query: { queryKey: getGetChatQueryKey(chat.id), refetchInterval: 5000, refetchOnWindowFocus: true, retry: false } });
  const detail = detailQuery.data;

  useEffect(() => {
    setDraft('');
  }, [chat.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sendMessage.isPending) return;
    setDraft('');
    sendMessage.mutate(
      { chatId: chat.id, data: { content } },
      {
        onSuccess: (result) => {
          queryClient.setQueryData(getGetChatQueryKey(chat.id), result);
          queryClient.invalidateQueries({ queryKey: getGetChatsQueryKey() });
        },
        onError: () => setDraft(content),
      },
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  };

  const participants = detail?.participants ?? chat.participants;
  return (
    <section className="flex min-h-[590px] min-w-0 w-full flex-1 flex-col overflow-hidden rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[var(--shadow-sm)] lg:min-h-0">
      <header className="min-w-0 border-b border-[hsl(var(--border))] px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to chat list" className="mt-0.5 rounded-xl p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] lg:hidden"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {chat.includeBrain ? <BrainBadge /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><UsersRound className="h-5 w-5" /></div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h1 className="display truncate text-[16px] font-semibold tracking-[-.035em]">{chat.title || 'Private conversation'}</h1><span className="mono rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[8px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{chat.type}</span></div>
              <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{participants.length} {participants.length === 1 ? 'participant' : 'participants'} · messages refresh automatically</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" data-testid="button-new-chat-from-conversation" onClick={onNewChat} className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--border))] px-2.5 py-2 text-[10px] font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary)/.07)]"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">New chat</span></button>
              <button type="button" aria-label="Conversation details" onClick={() => document.getElementById(`participants-${chat.id}`)?.scrollIntoView({ behavior: 'smooth' })} className="hidden rounded-xl p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] sm:block"><Settings2 className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div id={`participants-${chat.id}`} className="scrollbar-thin mt-4 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-0.5">
          {participants.map((person) => <div key={`${person.username}-${person.isBrain}`} className="min-w-[125px] shrink-0 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.5)] px-2.5 py-2"><ParticipantLine person={person} signedInUsername={username} /></div>)}
        </div>
      </header>
      <ChatMessages detail={detail} username={username} isLoading={detailQuery.isLoading} isError={detailQuery.isError} onRetry={() => detailQuery.refetch()} />
      <footer className="min-w-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 sm:p-5">
        {sendMessage.isError && <div role="alert" className="mb-2 flex items-center gap-1.5 text-[10px] text-[hsl(var(--destructive))]"><RefreshCw className="h-3 w-3" />Message not sent. It is back in the composer so you can try again.</div>}
        <form onSubmit={submit} className="relative">
          <textarea data-testid="input-chat-composer" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} rows={2} maxLength={2000} placeholder={`Write to ${chat.title || 'this room'}…`} className="w-full resize-none rounded-2xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3.5 pr-14 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.62)] focus:border-[hsl(var(--primary)/.6)] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" />
          <button data-testid="button-send-chat-message" type="submit" disabled={!draft.trim() || sendMessage.isPending} className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35">{sendMessage.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}</button>
        </form>
        <div className="mt-2 flex items-center justify-between px-1"><span className="text-[10px] text-[hsl(var(--muted-foreground))]">Enter to send · Shift + Enter for a new line</span><span className="mono text-[9px] text-[hsl(var(--muted-foreground)/.7)]">{draft.length}/2000</span></div>
      </footer>
    </section>
  );
}

export default function ChatsPage({ username, embedded = false }: ChatsPageProps) {
  const [, navigate] = useLocation();
  const chatsQuery = useGetChats({ query: { queryKey: getGetChatsQueryKey(), refetchOnWindowFocus: true, retry: false } });
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<ChatMode | null>(null);

  const chats = chatsQuery.data ?? [];
  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId), [chats, selectedChatId]);

  useEffect(() => {
    if (selectedChatId && !chats.some((chat) => chat.id === selectedChatId)) {
      setSelectedChatId(null);
    }
  }, [chats, selectedChatId]);

  return (
    <div className={`${embedded ? 'relative min-h-full flex-1 overflow-hidden' : 'app-shell relative min-h-[100dvh] overflow-hidden'}`}>
      <div className="noise" />
      <div className={`relative mx-auto flex ${embedded ? 'min-h-full' : 'min-h-[100dvh]'} min-w-0 max-w-[1500px] flex-col px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-7`}>
        <header className="mb-4 flex items-center justify-between px-1 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-primary))] shadow-[0_8px_20px_rgba(113,207,170,.18)]"><div className="absolute h-5 w-5 rounded-full border-2 border-current opacity-70" /><div className="h-1.5 w-1.5 rounded-full bg-current" /></div>
            <div><div className="display text-[15px] font-bold tracking-[-.03em]">Little Brain AI</div><div className="mono mt-0.5 text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">private conversations</div></div>
          </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] px-2.5 py-2 backdrop-blur sm:px-3"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"><UserRound className="h-3.5 w-3.5" /></div><div className="hidden sm:block"><div className="mono text-[8px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground)/.7)]">signed in</div><div className="text-[10px] font-bold">{displayName(username)}</div><div className="mono text-[8px] text-[hsl(var(--muted-foreground))]">@{username}</div></div></div>
        </header>
        <nav aria-label="Workspace sections" className="mb-4 flex gap-1 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.58)] p-1 sm:hidden">
          <button type="button" onClick={() => navigate('/')} className="flex-1 rounded-xl px-2 py-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]">Workspace</button>
          <button type="button" aria-current="page" className="flex-1 rounded-xl bg-[hsl(var(--primary)/.1)] px-2 py-2 text-[10px] font-bold text-[hsl(var(--primary))]">Chats</button>
          <button type="button" onClick={() => navigate('/sources')} className="flex-1 rounded-xl px-2 py-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]">Sources</button>
        </nav>
        <div className="mb-4 flex items-end justify-between gap-4 px-1 sm:mb-6">
          <div><div className="mono mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[hsl(var(--primary))]"><ShieldCheck className="h-3.5 w-3.5" />your rooms, kept apart</div><h2 className="display text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-none tracking-[-.07em]">Talk to your people.</h2><p className="mt-2 max-w-lg text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Private and group conversations with a little room for the brain, when you want it.</p></div>
          <div className="hidden items-center gap-2 text-right sm:flex"><div className="living-dot h-2 w-2 rounded-full bg-[hsl(var(--primary))]" /><span className="mono text-[9px] uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">private by default</span></div>
        </div>
        <main className="grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className={`flex min-h-[290px] flex-col rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/.74)] p-3 shadow-[var(--shadow-sm)] backdrop-blur ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex items-center justify-between px-2 py-2">
              <div><h3 className="display text-[14px] font-semibold">Your chats</h3><div className="mono mt-1 text-[8px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{chats.length} {chats.length === 1 ? 'room' : 'rooms'}</div></div>
              <button type="button" aria-label="Create chat" onClick={() => setDialogMode('private')} className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition hover:brightness-110"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 px-1">
              <button type="button" data-testid="button-create-private-chat" onClick={() => setDialogMode('private')} className="flex items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border))] px-2 py-2.5 text-[10px] font-bold transition hover:border-[hsl(var(--primary)/.3)] hover:bg-[hsl(var(--primary)/.06)]"><UserRound className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />Private</button>
              <button type="button" data-testid="button-create-group-chat" onClick={() => setDialogMode('group')} className="flex items-center justify-center gap-1.5 rounded-xl border border-[hsl(var(--border))] px-2 py-2.5 text-[10px] font-bold transition hover:border-[hsl(var(--primary)/.3)] hover:bg-[hsl(var(--primary)/.06)]"><UsersRound className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />Group</button>
            </div>
            <div className="scrollbar-thin mt-4 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {chatsQuery.isLoading && <div className="space-y-2 px-1"><div className="h-[82px] animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /><div className="h-[82px] animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /><div className="h-[82px] animate-pulse rounded-2xl bg-[hsl(var(--muted))]" /></div>}
              {chatsQuery.isError && <div className="rounded-2xl border border-[hsl(var(--destructive)/.2)] bg-[hsl(var(--destructive)/.06)] p-4"><RefreshCw className="h-4 w-4 text-[hsl(var(--destructive))]" /><div className="mt-2 text-[11px] font-bold">Chats could not load</div><p className="mt-1 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">Try loading your private rooms again.</p><button type="button" onClick={() => chatsQuery.refetch()} className="mt-3 text-[10px] font-bold text-[hsl(var(--primary))]">Reload chats</button></div>}
              {!chatsQuery.isLoading && !chatsQuery.isError && chats.length === 0 && <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] px-4 py-8 text-center"><MessageCircle className="mx-auto h-5 w-5 text-[hsl(var(--muted-foreground)/.7)]" /><div className="mt-3 text-[11px] font-bold">No rooms yet</div><p className="mt-1 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">Make a private place for the next thing you want to say.</p><button type="button" onClick={() => setDialogMode('private')} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary-foreground))]"><Plus className="h-3 w-3" />Create your first chat</button></div>}
              {!chatsQuery.isLoading && !chatsQuery.isError && chats.map((chat) => <ChatListItem key={chat.id} chat={chat} selected={chat.id === selectedChatId} onSelect={() => setSelectedChatId(chat.id)} />)}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.65)] px-3 py-2.5 text-[9px] leading-relaxed text-[hsl(var(--muted-foreground))]"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary))]" />Only invited participants can see a room.</div>
          </aside>
          <div className={`${selectedChat ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0`}>
             {selectedChat ? <Conversation chat={selectedChat} username={username} onBack={() => setSelectedChatId(null)} onNewChat={() => setDialogMode('private')} /> : <div className="flex min-h-[590px] flex-1 items-center justify-center rounded-[24px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.42)]"><div className="max-w-sm px-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.08)] text-[hsl(var(--primary))]"><Send className="h-6 w-6" /></div><h3 className="display mt-5 text-xl font-semibold tracking-[-.04em]">Choose a room</h3><p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Select a chat on the left, or start a new one when you are ready.</p></div></div>}
          </div>
        </main>
      </div>
      {dialogMode && <CreateChatDialog mode={dialogMode} onModeChange={setDialogMode} username={username} onClose={() => setDialogMode(null)} onCreated={(chat) => { setDialogMode(null); setSelectedChatId(chat.id); }} />}
    </div>
  );
}