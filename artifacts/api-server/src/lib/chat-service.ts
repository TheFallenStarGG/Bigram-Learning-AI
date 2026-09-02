import {
  accountExists,
  listAccounts,
  listChatRooms,
  readAccountChat,
  readChatRoom,
  writeChatRoom,
  type AdminAccount,
  type StoredChatRoom,
} from "./auth-service";
import { learnAndRespond } from "./brain-service";

type ChatType = "private" | "group";

export type ChatParticipant = {
  username: string;
  displayName: string;
  isBrain: boolean;
};

export type ChatMessage = {
  id: string;
  sender: ChatParticipant;
  content: string;
  createdAt: string;
};

export type ChatSummary = {
  id: string;
  type: ChatType;
  title: string;
  ownerUsername: string;
  participants: ChatParticipant[];
  includeBrain: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage: ChatMessage | null;
};

export type ChatDetail = ChatSummary & {
  messages: ChatMessage[];
};

export type AdminChatSummary = {
  id: string;
  type: "direct" | "group";
  title: string;
  participants: ChatParticipant[];
  includeBrain: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage: ChatMessage | null;
};

export type AdminChatDetail = AdminChatSummary & {
  messages: ChatMessage[];
};

export class ChatInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatInputError";
  }
}

export class ChatParticipantNotFoundError extends Error {
  constructor(username: string) {
    super(`No account exists for @${username}.`);
    this.name = "ChatParticipantNotFoundError";
  }
}

export class ChatNotFoundError extends Error {
  constructor() {
    super("That chat could not be found.");
    this.name = "ChatNotFoundError";
  }
}

export class ChatPermissionError extends Error {
  constructor(message = "Only the group owner can rename this chat.") {
    super(message);
    this.name = "ChatPermissionError";
  }
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function displayName(username: string) {
  return username
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || username;
}

function publicParticipant(participant: { username: string; isBrain: boolean }): ChatParticipant {
  return {
    username: participant.username,
    displayName: participant.isBrain ? "Little Brain" : displayName(participant.username),
    isBrain: participant.isBrain,
  };
}

function publicMessage(
  message: StoredChatRoom["messages"][number],
  participants: StoredChatRoom["participants"],
): ChatMessage {
  const sender = participants.find((participant) => participant.username === message.senderUsername);
  return {
    id: message.id,
    sender: publicParticipant(
      sender ?? { username: message.senderUsername, isBrain: message.senderUsername === "little-brain" },
    ),
    content: message.content,
    createdAt: message.createdAt,
  };
}

function toPublic(room: StoredChatRoom): ChatDetail {
  const participants = room.participants.map(publicParticipant);
  const messages = room.messages.map((message) => publicMessage(message, room.participants));
  return {
    id: room.id,
    type: room.type,
    title:
      room.type === "private"
        ? participants.find(
            (participant) =>
              !participant.isBrain && participant.username !== room.createdBy,
          )?.displayName ?? "Private chat"
        : room.title?.trim() || "Group chat",
    ownerUsername: room.createdBy,
    participants,
    includeBrain: room.includeBrain,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    lastMessage: messages.at(-1) ?? null,
    messages,
  };
}

function toAdminDirectChat(account: AdminAccount, messages: Awaited<ReturnType<typeof readAccountChat>>): AdminChatDetail {
  const brain: ChatParticipant = {
    username: "little-brain",
    displayName: "Little Brain",
    isBrain: true,
  };
  const user: ChatParticipant = {
    username: account.username,
    displayName: displayName(account.username),
    isBrain: false,
  };
  const publicMessages = messages.map((message) => ({
    id: message.id,
    sender: message.role === "assistant" ? brain : user,
    content: message.content,
    createdAt: message.createdAt,
  }));
  const updatedAt = publicMessages.at(-1)?.createdAt ?? account.createdAt;
  return {
    id: `direct:${account.username}`,
    type: "direct",
    title: `${user.displayName} and Little Brain`,
    participants: [user, brain],
    includeBrain: true,
    createdAt: account.createdAt,
    updatedAt,
    lastMessage: publicMessages.at(-1) ?? null,
    messages: publicMessages,
  };
}

function toAdminGroupChat(room: StoredChatRoom): AdminChatDetail {
  const chat = toPublic(room);
  return {
    ...chat,
    id: `room:${chat.id}`,
    type: "group",
  };
}

export async function getAdminChats(): Promise<AdminChatSummary[]> {
  const [accounts, rooms] = await Promise.all([listAccounts(), listChatRooms()]);
  const directChats = await Promise.all(
    accounts.map(async (account) => toAdminDirectChat(account, await readAccountChat(account.username))),
  );
  return [...directChats, ...rooms.filter((room) => room.includeBrain).map(toAdminGroupChat)]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(({ messages: _messages, ...summary }) => summary);
}

export async function getAdminChat(id: string): Promise<AdminChatDetail | null> {
  if (id.startsWith("direct:")) {
    const username = id.slice("direct:".length);
    const account = (await listAccounts()).find((item) => item.username === username);
    if (!account) return null;
    return toAdminDirectChat(account, await readAccountChat(account.username));
  }
  if (id.startsWith("room:")) {
    const room = await readChatRoom(id.slice("room:".length));
    if (!room || !room.includeBrain) return null;
    return toAdminGroupChat(room);
  }
  return null;
}

async function getAuthorizedRoom(username: string, chatId: string) {
  const room = await readChatRoom(chatId);
  if (!room || !room.participants.some((participant) => participant.username === username)) {
    throw new ChatNotFoundError();
  }
  return room;
}

export async function getChats(username: string) {
  const rooms = await listChatRooms();
  return rooms
    .filter((room) => room.participants.some((participant) => participant.username === username))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toPublic);
}

export async function getChat(username: string, chatId: string) {
  return toPublic(await getAuthorizedRoom(username, chatId));
}

export async function createChat(
  username: string,
  input: { type: ChatType; participantUsernames: string[]; includeBrain: boolean },
) {
  const normalizedUsername = normalizeUsername(username);
  const requestedParticipants = input.participantUsernames.map(normalizeUsername);
  if (requestedParticipants.some((participant) => !/^[a-z0-9_-]{3,32}$/i.test(participant))) {
    throw new ChatInputError(
      "Usernames use 3–32 letters, numbers, underscores, or hyphens.",
    );
  }
  if (new Set(requestedParticipants).size !== requestedParticipants.length) {
    throw new ChatInputError("Each participant can only be added once.");
  }
  if (requestedParticipants.includes(normalizedUsername)) {
    throw new ChatInputError("You are already included in this chat.");
  }
  const participants = requestedParticipants;

  if (input.type === "private" && participants.length !== 1) {
    throw new ChatInputError("A private chat needs exactly one other username.");
  }
  if (input.type === "group" && participants.length < 1) {
    throw new ChatInputError("A group chat needs at least one other username.");
  }
  if (input.type === "private" && input.includeBrain) {
    throw new ChatInputError("Little Brain can be added to group chats only.");
  }

  for (const participant of participants) {
    if (!(await accountExists(participant))) {
      throw new ChatParticipantNotFoundError(participant);
    }
  }

  const now = new Date().toISOString();
  const room: StoredChatRoom = {
    format: "bigram-ai/room/v1",
    id: crypto.randomUUID(),
    type: input.type,
    createdBy: normalizedUsername,
    participants: [
      { username: normalizedUsername, isBrain: false },
      ...participants.map((participant) => ({ username: participant, isBrain: false })),
      ...(input.includeBrain ? [{ username: "little-brain", isBrain: true }] : []),
    ],
    includeBrain: input.includeBrain,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await writeChatRoom(room);
  return toPublic(room);
}

export async function sendChatMessage(username: string, chatId: string, content: string) {
  const room = await getAuthorizedRoom(username, chatId);
  const now = new Date().toISOString();
  room.messages.push({
    id: crypto.randomUUID(),
    senderUsername: username,
    content,
    createdAt: now,
  });

  if (room.includeBrain) {
    const brain = await learnAndRespond(content);
    room.messages.push({
      id: brain.assistantMessage.id,
      senderUsername: "little-brain",
      content: brain.assistantMessage.content,
      createdAt: brain.assistantMessage.createdAt.toISOString(),
    });
  }

  room.updatedAt = new Date().toISOString();
  await writeChatRoom(room);
  return toPublic(room);
}

export async function renameChat(username: string, chatId: string, title: string) {
  const room = await getAuthorizedRoom(username, chatId);
  if (room.type !== "group") {
    throw new ChatInputError("Only group chats can be renamed.");
  }
  if (room.createdBy !== username) {
    throw new ChatPermissionError();
  }
  const nextTitle = title.trim();
  if (!nextTitle) {
    throw new ChatInputError("A group chat name cannot be empty.");
  }
  room.title = nextTitle;
  room.updatedAt = new Date().toISOString();
  await writeChatRoom(room);
  return toPublic(room);
}