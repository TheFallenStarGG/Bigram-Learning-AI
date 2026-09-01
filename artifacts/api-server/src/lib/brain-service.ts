import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import {
  brainStateTable,
  chatMessagesTable,
  db,
  githubSettingsTable,
  modelSnapshotsTable,
} from "@workspace/db";
import {
  SNAPSHOT_REPOSITORY,
  SNAPSHOT_REPOSITORY_URL,
  getLatestSnapshotFromGithub,
  pushSnapshotToGithub,
} from "./github";
import { logger } from "./logger";

const START = "__START__";
const END = "__END__";
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
type Vocabulary = Record<string, number>;
type Transitions = Record<string, Record<string, number>>;

type BrainData = {
  vocabulary: Vocabulary;
  transitions: Transitions;
  messageCount: number;
  learningStartedAt: Date;
  lastSnapshotAt: Date | null;
};

let remoteSnapshotSyncPromise: Promise<void> | null = null;

export type BrainOverview = {
  vocabulary: number;
  bigrams: number;
  messages: number;
  learningStartedAt: string;
  lastSnapshotAt: string | null;
  nextSnapshotAt: string;
  githubConfigured: boolean;
  githubConnected: boolean;
};

export type PublicMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type PublicSnapshot = {
  id: string;
  filename: string;
  createdAt: string;
  vocabulary: number;
  bigrams: number;
  messages: number;
  status: "local" | "github" | "failed";
  error: string | null;
};

function tokenize(text: string) {
  return (
    text
      .toLocaleLowerCase()
      .match(/[a-z0-9]+(?:'[a-z0-9]+)?|[.,!?;:]/g) ?? []
  );
}

function formatTokens(tokens: string[]) {
  let result = "";
  for (const token of tokens) {
    if (/[.,!?;:]/.test(token)) result = `${result.trimEnd()}${token} `;
    else result += `${token} `;
  }
  return result.trim();
}

function learn(data: BrainData, text: string) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return;

  let previous = START;
  for (const token of tokens) {
    data.vocabulary[token] = (data.vocabulary[token] ?? 0) + 1;
    data.transitions[previous] ??= {};
    data.transitions[previous][token] =
      (data.transitions[previous][token] ?? 0) + 1;
    previous = token;
  }

  data.transitions[previous] ??= {};
  data.transitions[previous][END] =
    (data.transitions[previous][END] ?? 0) + 1;
  data.messageCount += 1;
}

function chooseNext(options: Record<string, number>) {
  const entries = Object.entries(options);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  let cursor = Math.random() * total;
  for (const [token, count] of entries) {
    cursor -= count;
    if (cursor <= 0) return token;
  }
  return entries[entries.length - 1]?.[0] ?? null;
}

function generate(data: BrainData, prompt: string) {
  if (Object.keys(data.vocabulary).length < 3) {
    return "I am still learning the shape of language. Keep talking with me.";
  }

  const promptTokens = tokenize(prompt);
  let current = promptTokens.at(-1) ?? START;
  const generated: string[] = [];

  for (let index = 0; index < 32; index += 1) {
    const next = chooseNext(data.transitions[current] ?? {});
    if (!next || next === END) break;
    generated.push(next);
    current = next;
  }

  if (generated.length === 0) {
    current = START;
    for (let index = 0; index < 24; index += 1) {
      const next = chooseNext(data.transitions[current] ?? {});
      if (!next || next === END) break;
      generated.push(next);
      current = next;
    }
  }

  return (
    formatTokens(generated) ||
    "I have learned a little more. Give me another thought to connect."
  );
}

async function ensureRows() {
  const [state] = await db
    .select()
    .from(brainStateTable)
    .where(eq(brainStateTable.id, 1))
    .limit(1);

  if (!state) {
    await db
      .insert(brainStateTable)
      .values({
        id: 1,
        vocabulary: {},
        transitions: {},
        messageCount: 0,
      })
      .onConflictDoNothing({ target: brainStateTable.id });
  }

  const [github] = await db
    .select()
    .from(githubSettingsTable)
    .where(eq(githubSettingsTable.id, 1))
    .limit(1);

  if (!github) {
    await db
      .insert(githubSettingsTable)
      .values({
        id: 1,
        owner: SNAPSHOT_REPOSITORY.owner,
        repository: SNAPSHOT_REPOSITORY.repository,
        branch: SNAPSHOT_REPOSITORY.branch,
        configured: true,
      })
      .onConflictDoNothing({ target: githubSettingsTable.id });
  } else if (
    !github.configured ||
    github.owner !== SNAPSHOT_REPOSITORY.owner ||
    github.repository !== SNAPSHOT_REPOSITORY.repository ||
    github.branch !== SNAPSHOT_REPOSITORY.branch
  ) {
    await db
      .update(githubSettingsTable)
      .set({
        owner: SNAPSHOT_REPOSITORY.owner,
        repository: SNAPSHOT_REPOSITORY.repository,
        branch: SNAPSHOT_REPOSITORY.branch,
        configured: true,
        updatedAt: new Date(),
      })
      .where(eq(githubSettingsTable.id, 1));
  }
}

async function getState() {
  await ensureRemoteSnapshotLoaded();
  await ensureRows();
  const [state] = await db
    .select()
    .from(brainStateTable)
    .where(eq(brainStateTable.id, 1))
    .limit(1);
  if (!state) throw new Error("Brain state could not be initialized");
  return {
    vocabulary: state.vocabulary as Vocabulary,
    transitions: state.transitions as Transitions,
    messageCount: state.messageCount,
    learningStartedAt: state.learningStartedAt,
    lastSnapshotAt: state.lastSnapshotAt,
  } satisfies BrainData;
}

async function getGithubRow() {
  await ensureRows();
  const [github] = await db
    .select()
    .from(githubSettingsTable)
    .where(eq(githubSettingsTable.id, 1))
    .limit(1);
  if (!github) throw new Error("GitHub settings could not be initialized");
  return github;
}

async function saveState(state: BrainData) {
  await db
    .update(brainStateTable)
    .set({
      vocabulary: state.vocabulary,
      transitions: state.transitions,
      messageCount: state.messageCount,
      learningStartedAt: state.learningStartedAt,
      lastSnapshotAt: state.lastSnapshotAt,
    })
    .where(eq(brainStateTable.id, 1));
}

function countBigrams(transitions: Transitions) {
  return Object.values(transitions).reduce(
    (total, options) => total + Object.keys(options).filter((key) => key !== END).length,
    0,
  );
}

export async function getOverview(): Promise<BrainOverview> {
  const [state, github] = await Promise.all([getState(), getGithubRow()]);
  const next =
    (state.lastSnapshotAt?.getTime() ?? state.learningStartedAt.getTime()) +
    SNAPSHOT_INTERVAL_MS;
  return {
    vocabulary: Object.keys(state.vocabulary).length,
    bigrams: countBigrams(state.transitions),
    messages: state.messageCount,
    learningStartedAt: state.learningStartedAt.toISOString(),
    lastSnapshotAt: state.lastSnapshotAt?.toISOString() ?? null,
    nextSnapshotAt: new Date(next).toISOString(),
    githubConfigured: github.configured,
    githubConnected: github.configured,
  };
}

export async function getMessages(): Promise<PublicMessage[]> {
  await ensureRemoteSnapshotLoaded();
  const rows = await db
    .select()
    .from(chatMessagesTable)
    .orderBy(chatMessagesTable.createdAt);
  return rows.map((row) => ({
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function sendMessage(prompt: string) {
  await ensureRemoteSnapshotLoaded();
  const state = await getState();
  learn(state, prompt);
  const response = generate(state, prompt);
  const userMessage = {
    id: crypto.randomUUID(),
    role: "user" as const,
    content: prompt,
    createdAt: new Date(),
  };
  const assistantMessage = {
    id: crypto.randomUUID(),
    role: "assistant" as const,
    content: response,
    createdAt: new Date(),
  };

  await db.insert(chatMessagesTable).values([
    userMessage,
    assistantMessage,
  ]);
  await saveState(state);
  return {
    userMessage: {
      ...userMessage,
      createdAt: userMessage.createdAt.toISOString(),
    },
    assistantMessage: {
      ...assistantMessage,
      createdAt: assistantMessage.createdAt.toISOString(),
    },
    overview: await getOverview(),
  };
}

export async function getSnapshots(): Promise<PublicSnapshot[]> {
  const rows = await db
    .select()
    .from(modelSnapshotsTable)
    .orderBy(desc(modelSnapshotsTable.createdAt));
  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    createdAt: row.createdAt.toISOString(),
    vocabulary: row.vocabulary,
    bigrams: row.bigrams,
    messages: row.messages,
    status: row.status === "github" || row.status === "failed" ? row.status : "local",
    error: row.error,
  }));
}

export async function createSnapshot(): Promise<PublicSnapshot> {
  const state = await getState();
  const [github, messages] = await Promise.all([getGithubRow(), getMessages()]);
  const createdAt = new Date();
  const id = crypto.randomUUID();
  const filename = `bigram-model-${createdAt
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  const snapshot = {
    format: "bigram-ai/v1",
    createdAt: createdAt.toISOString(),
    model: {
      vocabulary: state.vocabulary,
      transitions: state.transitions,
      messageCount: state.messageCount,
      learningStartedAt: state.learningStartedAt.toISOString(),
    },
    messages,
    github: {
      configured: github.configured,
      owner: github.owner,
      repository: github.repository,
      branch: github.branch,
      connected: github.configured,
    },
  };

  const outputDir = path.resolve(
    process.env.MODEL_DATA_DIR ?? path.join(process.cwd(), "data", "model-snapshots"),
  );
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, filename),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );

  let status: "local" | "github" | "failed" = "local";
  let error: string | null = null;

  if (github.configured) {
    try {
      await pushSnapshotToGithub({
        filename,
        content: JSON.stringify(snapshot, null, 2),
      });
      status = "github";
    } catch (remoteError) {
      status = "failed";
      error =
        remoteError instanceof Error
          ? remoteError.message
          : "The snapshot could not be written to GitHub.";
      logger.error(
        { err: remoteError, filename },
        "Could not write model snapshot to GitHub",
      );
    }
  }

  await db.insert(modelSnapshotsTable).values({
    id,
    filename,
    createdAt,
    vocabulary: Object.keys(state.vocabulary).length,
    bigrams: countBigrams(state.transitions),
    messages: state.messageCount,
    status,
    error,
  });
  state.lastSnapshotAt = createdAt;
  await saveState(state);
  return (await getSnapshots()).find((item) => item.id === id)!;
}

export async function getGithubSettings() {
  const github = await getGithubRow();
  return {
    owner: github.owner,
    repository: github.repository,
    branch: github.branch,
    configured: github.configured,
    connected: github.configured,
    message: github.configured
      ? `Private GitHub backups are permanently linked to ${SNAPSHOT_REPOSITORY_URL}.`
      : "Private GitHub backups are not configured.",
  };
}

export async function updateGithubSettings(input: {
  owner: string;
  repository: string;
  branch: string;
}) {
  void input;
  await db
    .update(githubSettingsTable)
    .set({
      owner: SNAPSHOT_REPOSITORY.owner,
      repository: SNAPSHOT_REPOSITORY.repository,
      branch: SNAPSHOT_REPOSITORY.branch,
      configured: true,
      updatedAt: new Date(),
    })
    .where(eq(githubSettingsTable.id, 1));
  return getGithubSettings();
}

export function startSnapshotScheduler() {
  void ensureRemoteSnapshotLoaded();
  const timer = setInterval(() => {
    void createSnapshot().catch(() => undefined);
  }, SNAPSHOT_INTERVAL_MS);
  timer.unref();
}

function ensureRemoteSnapshotLoaded() {
  if (!remoteSnapshotSyncPromise) {
    remoteSnapshotSyncPromise = syncStateFromLatestRemoteSnapshot().catch((error) => {
      logger.error(
        { err: error },
        "Could not load the latest model snapshot from GitHub",
      );
      remoteSnapshotSyncPromise = null;
    });
  }
  return remoteSnapshotSyncPromise;
}

async function syncStateFromLatestRemoteSnapshot() {
  const github = await getGithubRow();
  if (!github.configured) return;

  const latest = await getLatestSnapshotFromGithub();
  if (!latest) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(latest.content) as unknown;
  } catch (error) {
    throw new Error(
      `The latest GitHub snapshot ${latest.filename} is not valid JSON.`,
      { cause: error },
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("model" in parsed) ||
    !("messages" in parsed) ||
    typeof parsed.model !== "object" ||
    parsed.model === null ||
    !Array.isArray(parsed.messages)
  ) {
    throw new Error(`The latest GitHub snapshot ${latest.filename} has an invalid format.`);
  }

  const model = parsed.model as Record<string, unknown>;
  const vocabulary = model.vocabulary;
  const transitions = model.transitions;
  const messageCount = model.messageCount;
  const learningStartedAt = model.learningStartedAt;
  const createdAt = "createdAt" in parsed ? parsed.createdAt : null;

  if (
    typeof vocabulary !== "object" ||
    vocabulary === null ||
    typeof transitions !== "object" ||
    transitions === null ||
    typeof messageCount !== "number" ||
    typeof learningStartedAt !== "string" ||
    (createdAt !== null && typeof createdAt !== "string")
  ) {
    throw new Error(`The latest GitHub snapshot ${latest.filename} has an invalid model.`);
  }

  const messages = parsed.messages.map((message) => {
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
      throw new Error(`The latest GitHub snapshot ${latest.filename} has invalid messages.`);
    }
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.createdAt),
    };
  });

  const startedAt = new Date(learningStartedAt);
  const snapshotAt = new Date(createdAt ?? startedAt);
  if (
    Number.isNaN(startedAt.getTime()) ||
    Number.isNaN(snapshotAt.getTime()) ||
    messages.some((message) => Number.isNaN(message.createdAt.getTime()))
  ) {
    throw new Error(`The latest GitHub snapshot ${latest.filename} has invalid dates.`);
  }

  await db.transaction(async (transaction) => {
    await transaction
      .update(brainStateTable)
      .set({
        vocabulary: vocabulary as Vocabulary,
        transitions: transitions as Transitions,
        messageCount,
        learningStartedAt: startedAt,
        lastSnapshotAt: snapshotAt,
      })
      .where(eq(brainStateTable.id, 1));

    await transaction.delete(chatMessagesTable);
    if (messages.length > 0) {
      await transaction.insert(chatMessagesTable).values(messages);
    }
  });

  logger.info(
    { filename: latest.filename, messages: messages.length },
    "Loaded latest model snapshot from GitHub",
  );
}