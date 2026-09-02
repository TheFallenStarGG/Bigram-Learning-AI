import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { listPrivateDirectory, readPrivateFile, writePrivateFile } from "./github";

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
  message?: string;
};

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type StoredAccount = {
  format: typeof ACCOUNT_FORMAT;
  username: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
};

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
    typeof parsed.createdAt !== "string"
  ) {
    throw new Error("The account file has an invalid format.");
  }
  return parsed as StoredAccount;
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
  return normalized;
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

  return {
    format: ROOM_FORMAT,
    id: value.id,
    type: value.type,
    createdBy: normalizeUsername(value.createdBy),
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