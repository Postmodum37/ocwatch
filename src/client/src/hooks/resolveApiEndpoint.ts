export function resolveApiEndpoint(apiUrl: string | undefined, resource: "poll" | "sse"): string {
  const suffix = `/api/${resource}`;
  const normalized = apiUrl?.replace(/\/$/, "") ?? "";

  if (!normalized) {
    return suffix;
  }

  if (normalized.endsWith(suffix)) {
    return normalized;
  }

  if (normalized.endsWith("/api/poll") || normalized.endsWith("/api/sse")) {
    return normalized.replace(/\/api\/(?:poll|sse)$/, suffix);
  }

  return `${normalized}${suffix}`;
}

export function appendProjectId(endpoint: string, projectId?: string | null): string {
  if (!projectId) {
    return endpoint;
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}projectId=${encodeURIComponent(projectId)}`;
}
