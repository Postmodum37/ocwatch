function normalizeApiBase(apiUrl: string | undefined): string {
  return apiUrl?.replace(/\/$/, "") ?? "";
}

export function resolveApiPath(apiUrl: string | undefined, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalized = normalizeApiBase(apiUrl);

  if (!normalized) {
    return normalizedPath;
  }

  return `${normalized}${normalizedPath}`;
}

export function resolveApiEndpoint(apiUrl: string | undefined, resource: "poll" | "sse"): string {
  const suffix = `/api/${resource}`;
  const normalized = normalizeApiBase(apiUrl);

  if (!normalized) {
    return suffix;
  }

  if (normalized.endsWith(suffix)) {
    return normalized;
  }

  if (normalized.endsWith("/api/poll") || normalized.endsWith("/api/sse")) {
    return normalized.replace(/\/api\/(?:poll|sse)$/, suffix);
  }

  return resolveApiPath(normalized, suffix);
}

export function appendProjectId(endpoint: string, projectId?: string | null): string {
  if (!projectId) {
    return endpoint;
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}projectId=${encodeURIComponent(projectId)}`;
}
