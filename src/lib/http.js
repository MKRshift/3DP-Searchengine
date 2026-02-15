const DEFAULT_USER_AGENT = "3DMetaSearchBot/1.0 (+https://localhost)";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status) {
  return status === 429 || status >= 500;
}

export async function fetchJson(
  url,
  {
    headers = {},
    method = "GET",
    body = undefined,
    timeoutMs = 12_000,
    retries = 2,
    retryBaseMs = 350,
  } = {}
) {
  let attempt = 0;

  while (attempt <= retries) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "user-agent": DEFAULT_USER_AGENT,
          accept: "application/json, text/plain, */*",
          ...headers,
        },
        body,
        signal: ctrl.signal,
      });

      if (!response.ok) {
        if (attempt < retries && shouldRetry(response.status)) {
          await wait(retryBaseMs * 2 ** attempt);
          attempt += 1;
          continue;
        }

        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) return await response.json();

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Expected JSON but got ${contentType || "unknown content-type"}`);
      }
    } catch (error) {
      if (attempt < retries && (error?.name === "AbortError" || /fetch failed/i.test(String(error?.message ?? "")))) {
        await wait(retryBaseMs * 2 ** attempt);
        attempt += 1;
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
