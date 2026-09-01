import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

type GithubRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type GithubContent = {
  name: string;
  type: string;
  download_url?: string | null;
  content?: string;
};

async function githubRequest<T>(
  requestPath: string,
  init?: GithubRequestInit,
  options?: { allowNotFound?: boolean },
) {
  const response = await connectors.proxy("github", requestPath, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      ...(init?.headers ?? {}),
    },
  });

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (response.status === 404 && options?.allowNotFound) {
    return null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : response.statusText || "GitHub request failed";
    throw new Error(`GitHub request failed (${response.status}): ${message}`);
  }

  return payload as T;
}

function repositoryPath(owner: string, repository: string, suffix: string) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${suffix}`;
}

export async function pushSnapshotToGithub(input: {
  owner: string;
  repository: string;
  branch: string;
  filename: string;
  content: string;
}) {
  const filePath = `snapshots/${input.filename}`
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  await githubRequest(
    repositoryPath(
      input.owner,
      input.repository,
      `/contents/${filePath}`,
    ),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Save model snapshot ${input.filename}`,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: input.branch,
      }),
    },
  );
}

export async function getLatestSnapshotFromGithub(input: {
  owner: string;
  repository: string;
  branch: string;
}) {
  const directory = await githubRequest<GithubContent[]>(
    repositoryPath(
      input.owner,
      input.repository,
      `/contents/snapshots?ref=${encodeURIComponent(input.branch)}`,
    ),
    undefined,
    { allowNotFound: true },
  );

  if (!directory) return null;

  const latestFile = directory
    .filter(
      (item) =>
        item.type === "file" &&
        item.name.startsWith("bigram-model-") &&
        item.name.endsWith(".json"),
    )
    .sort((left, right) => right.name.localeCompare(left.name))[0];

  if (!latestFile) return null;

  const file = await githubRequest<GithubContent>(
    repositoryPath(
      input.owner,
      input.repository,
      `/contents/snapshots/${encodeURIComponent(latestFile.name)}?ref=${encodeURIComponent(input.branch)}`,
    ),
  );

  if (!file?.content) {
    throw new Error(`GitHub snapshot ${latestFile.name} did not include file content`);
  }

  return {
    filename: latestFile.name,
    content: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"),
  };
}