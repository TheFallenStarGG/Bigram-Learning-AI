import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  deletePrivateFile,
  listPrivateDirectory,
  readPrivateFile,
  writePrivateFile,
} from "./github";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "bigram_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const ACCOUNT_FORMAT = "bigram-ai/account/v1";
const CHAT_FORMAT = "bigram-ai/chat/v1";
const ROOM_FORMAT = "bigram-ai/room/v1";
const SESSION_SECRET =
  process.env.SESSION_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("SESSION_SECRET is required in production.");
      })()
    : "bigram-development-session-secret");

export type AuthSession = {
  authenticated: boolean;
  username: string | null;
  isAdmin: boolean;
  message?: string;
};

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type StoredAccount = {
  format: typeof ACCOUNT_FORMAT;
  username: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  isAdmin: boolean;
  isBanned: boolean;
};

export type AdminAccount = Pick<
  StoredAccount,
  "username" | "createdAt" | "isAdmin" | "isBanned"
>;

export type StoredRoomParticipant = {
  username: string;
  isBrain: boolean;
};

export type StoredRoomMessage = {
  id: string;
  senderUsername: string;
  content: string;
  createdAt: string;
};

export type StoredChatRoom = {
  format: typeof ROOM_FORMAT;
  id: string;
  type: "private" | "group";
  createdBy: string;
  title?: string;
  participants: StoredRoomParticipant[];
  includeBrain: boolean;
  createdAt: string;
  updatedAt: string;
  messages: StoredRoomMessage[];
};

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function accountPath(username: string) {
  return `accounts/${normalizeUsername(username)}.json`;
}

function chatPath(username: string) {
  return `snapshots/${normalizeUsername(username)}/chat-history.json`;
}

function roomPath(id: string) {
  return `chats/${id}.json`;
}

function sign(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

export function createSessionCookie(username: string) {
  const payload = Buffer.from(
    JSON.stringify({
      username: normalizeUsername(username),
      expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      username?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof parsed.username !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }
    return normalizeUsername(parsed.username);
  } catch {
    return null;
  }
}

async function readAccount(username: string) {
  const file = await readPrivateFile(accountPath(username));
  if (!file) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw new Error("The account file is not valid JSON.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("format" in parsed) ||
    parsed.format !== ACCOUNT_FORMAT ||
    !("username" in parsed) ||
    typeof parsed.username !== "string" ||
    !("passwordSalt" in parsed) ||
    typeof parsed.passwordSalt !== "string" ||
    !("passwordHash" in parsed) ||
    typeof parsed.passwordHash !== "string" ||
    !("createdAt" in parsed) ||
    typeof parsed.createdAt !== "string" ||
    ("isAdmin" in parsed && typeof parsed.isAdmin !== "boolean") ||
    ("isBanned" in parsed && typeof parsed.isBanned !== "boolean")
  ) {
    throw new Error("The account file has an invalid format.");
  }
  return {
    ...(parsed as Omit<StoredAccount, "isAdmin" | "isBanned">),
    isAdmin: "isAdmin" in parsed && typeof parsed.isAdmin === "boolean" ? parsed.isAdmin : false,
    isBanned: "isBanned" in parsed && typeof parsed.isBanned === "boolean" ? parsed.isBanned : false,
  };
}

export async function accountExists(username: string) {
  return (await readAccount(username)) !== null;
}

async function hashPassword(password: string, salt = randomBytes(16)) {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return {
    salt: salt.toString("base64url"),
    hash: derived.toString("base64url"),
  };
}

async function verifyPassword(password: string, account: StoredAccount) {
  const salt = Buffer.from(account.passwordSalt, "base64url");
  const expected = Buffer.from(account.passwordHash, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function writeEmptyChat(username: string) {
  await writePrivateFile({
    relativePath: chatPath(username),
    content: JSON.stringify(
      { format: CHAT_FORMAT, username: normalizeUsername(username), messages: [] },
      null,
      2,
    ),
    message: `Create chat history for ${normalizeUsername(username)}`,
  });
}

export async function createAccount(username: string, password: string) {
  const normalized = normalizeUsername(username);
  if (await readAccount(normalized)) {
    const error = new Error("That username is already in use.");
    error.name = "AccountExistsError";
    throw error;
  }
  const passwordParts = await hashPassword(password);
  await writePrivateFile({
    relativePath: accountPath(normalized),
    content: JSON.stringify(
      {
        format: ACCOUNT_FORMAT,
        username: normalized,
        passwordSalt: passwordParts.salt,
        passwordHash: passwordParts.hash,
        createdAt: new Date().toISOString(),
        isAdmin: false,
        isBanned: false,
      } satisfies StoredAccount,
      null,
      2,
    ),
    message: `Create account ${normalized}`,
  });
  await writeEmptyChat(normalized);
  return normalized;
}

export async function authenticateAccount(username: string, password: string) {
  const normalized = normalizeUsername(username);
  const account = await readAccount(normalized);
  if (!account || !(await verifyPassword(password, account))) {
    const error = new Error("Username or password is incorrect.");
    error.name = "InvalidCredentialsError";
    throw error;
  }
  if (account.isBanned) {
    const error = new Error("This account has been banned.");
    error.name = "BannedAccountError";
    throw error;
  }
  return normalized;
}

export async function getSessionAccount(value: string | undefined) {
  const username = readSessionCookie(value);
  if (!username) return null;
  const account = await readAccount(username);
  if (!account || account.isBanned) return null;
  return account;
}

export async function getAuthSession(value: string | undefined): Promise<AuthSession> {
  const username = readSessionCookie(value);
  if (!username) {
    return {
      authenticated: false,
      username: null,
      isAdmin: false,
      message: "Sign in to continue.",
    };
  }
  const account = await readAccount(username);
  if (!account) {
    return {
      authenticated: false,
      username: null,
      isAdmin: false,
      message: "That account is no longer available.",
    };
  }
  if (account.isBanned) {
    return {
      authenticated: false,
      username: null,
      isAdmin: false,
      message: "This account has been banned.",
    };
  }
  return {
    authenticated: true,
    username: account.username,
    isAdmin: account.isAdmin,
    message: "Account session active.",
  };
}

export async function listAccounts(): Promise<StoredAccount[]> {
  const directory = await listPrivateDirectory("accounts");
  const accountFiles = directory.filter(
    (item) => item.type === "file" && item.name.endsWith(".json"),
  );
  return Promise.all(
    accountFiles.map(async (item) => readAccount(item.name.slice(0, -".json".length))),
  ).then((accounts) => accounts.filter((account): account is StoredAccount => account !== null));
}

async function writeAccount(account: StoredAccount, message: string) {
  await writePrivateFile({
    relativePath: accountPath(account.username),
    content: JSON.stringify(account, null, 2),
    message,
  });
}

export async function setAccountAdmin(username: string, isAdmin = true) {
  const account = await readAccount(username);
  if (!account) return null;
  const updated = { ...account, isAdmin };
  await writeAccount(updated, `${isAdmin ? "Grant" : "Remove"} admin access for ${account.username}`);
  return updated;
}

export async function banAccount(username: string) {
  const account = await readAccount(username);
  if (!account) return null;
  if (!account.isBanned) {
    await writeAccount(
      { ...account, isBanned: true },
      `Ban account ${account.username}`,
    );
  }

  await deletePrivateFile({
    relativePath: chatPath(account.username),
    message: `Delete chat history for banned account ${account.username}`,
  });

  const rooms = await listChatRooms();
  for (const room of rooms) {
    const hasAccount = room.participants.some(
      (participant) => participant.username === account.username,
    );
    const hasMessages = room.messages.some(
      (message) => message.senderUsername === account.username,
    );
    if (!hasAccount && !hasMessages) continue;

    const participants = room.participants.filter(
      (participant) => participant.username !== account.username,
    );
    const messages = room.messages.filter(
      (message) => message.senderUsername !== account.username,
    );
    if (!participants.some((participant) => !participant.isBrain)) {
      await deletePrivateFile({
        relativePath: roomPath(room.id),
        message: `Delete empty chat room after banning ${account.username}`,
      });
      continue;
    }

    const nextOwner =
      room.createdBy === account.username
        ? participants.find((participant) => !participant.isBrain)?.username ?? room.createdBy
        : room.createdBy;
    await writeChatRoom({
      ...room,
      createdBy: nextOwner,
      participants,
      messages,
      updatedAt: new Date().toISOString(),
    });
  }

  return { ...account, isBanned: true };
}

export async function readAccountChat(username: string): Promise<StoredChatMessage[]> {
  const file = await readPrivateFile(chatPath(username));
  if (!file) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw new Error("The chat history file is not valid JSON.");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("messages" in parsed) ||
    !Array.isArray(parsed.messages)
  ) {
    throw new Error("The chat history file has an invalid format.");
  }
  return parsed.messages.map((message) => {
    if (
      typeof message !== "object" ||
      message === null ||
      !("id" in message) ||
      !("role" in message) ||
      !("content" in message) ||
      !("createdAt" in message) ||
      typeof message.id !== "string" ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      typeof message.createdAt !== "string"
    ) {
      throw new Error("The chat history contains an invalid message.");
    }
    return message as StoredChatMessage;
  });
}

export async function writeAccountChat(username: string, messages: StoredChatMessage[]) {
  await writePrivateFile({
    relativePath: chatPath(username),
    content: JSON.stringify(
      { format: CHAT_FORMAT, username: normalizeUsername(username), messages },
      null,
      2,
    ),
    message: `Update chat history for ${normalizeUsername(username)}`,
  });
}

function parseStoredRoomMessage(value: unknown): StoredRoomMessage {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    !("senderUsername" in value) ||
    !("content" in value) ||
    !("createdAt" in value) ||
    typeof value.id !== "string" ||
    typeof value.senderUsername !== "string" ||
    typeof value.content !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    throw new Error("The chat room contains an invalid message.");
  }
  return {
    id: value.id,
    senderUsername: normalizeUsername(value.senderUsername),
    content: value.content,
    createdAt: value.createdAt,
  };
}

function parseStoredRoom(value: unknown, fallbackId?: string): StoredChatRoom {
  if (
    typeof value !== "object" ||
    value === null ||
    !("format" in value) ||
    value.format !== ROOM_FORMAT ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    (fallbackId && value.id !== fallbackId) ||
    !("type" in value) ||
    (value.type !== "private" && value.type !== "group") ||
    !("createdBy" in value) ||
    typeof value.createdBy !== "string" ||
    ("title" in value && value.title !== undefined && typeof value.title !== "string") ||
    !("participants" in value) ||
    !Array.isArray(value.participants) ||
    !("includeBrain" in value) ||
    typeof value.includeBrain !== "boolean" ||
    !("createdAt" in value) ||
    typeof value.createdAt !== "string" ||
    !("updatedAt" in value) ||
    typeof value.updatedAt !== "string" ||
    !("messages" in value) ||
    !Array.isArray(value.messages)
  ) {
    throw new Error("The chat room file has an invalid format.");
  }

  const participants = value.participants.map((participant) => {
    if (
      typeof participant !== "object" ||
      participant === null ||
      !("username" in participant) ||
      !("isBrain" in participant) ||
      typeof participant.username !== "string" ||
      typeof participant.isBrain !== "boolean"
    ) {
      throw new Error("The chat room contains an invalid participant.");
    }
    return {
      username: normalizeUsername(participant.username),
      isBrain: participant.isBrain,
    };
  });
  const title =
    "title" in value && typeof value.title === "string"
      ? value.title
      : undefined;

  return {
    format: ROOM_FORMAT,
    id: value.id,
    type: value.type,
    createdBy: normalizeUsername(value.createdBy),
    title,
    participants,
    includeBrain: value.includeBrain,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    messages: value.messages.map(parseStoredRoomMessage),
  };
}

export async function readChatRoom(id: string) {
  const file = await readPrivateFile(roomPath(id));
  if (!file) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw new Error("The chat room file is not valid JSON.");
  }
  return parseStoredRoom(parsed, id);
}

export async function listChatRooms() {
  const directory = await listPrivateDirectory("chats");
  const roomFiles = directory.filter(
    (item) => item.type === "file" && item.name.endsWith(".json"),
  );
  return Promise.all(
    roomFiles.map(async (item) => {
      const id = item.name.slice(0, -".json".length);
      return readChatRoom(id);
    }),
  ).then((rooms) => rooms.filter((room): room is StoredChatRoom => room !== null));
}

export async function writeChatRoom(room: StoredChatRoom) {
  await writePrivateFile({
    relativePath: roomPath(room.id),
    content: JSON.stringify(room, null, 2),
    message: `Update chat room ${room.id}`,
  });
}

export { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS };