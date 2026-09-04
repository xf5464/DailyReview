const ALLOWED_ORIGIN = "https://xf5464.github.io";
const MAX_HTML_BYTES = 2_500_000;
const MAX_ARTICLE_CHARS = 32_000;
const TRANSLATION_CHUNK_CHARS = 2_400;

const CORS_HEADERS = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "accept, content-type",
  "access-control-max-age": "86400",
  vary: "Origin",
};

function json(value, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": cacheControl },
  });
}

function assertPublicHttpUrl(rawUrl) {
  let target;
  try { target = new URL(rawUrl); } catch { throw new Error("文章地址格式不正确。"); }
  if (!/^https?:$/.test(target.protocol)) throw new Error("只支持 HTTP 或 HTTPS 文章地址。");
  const host = target.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const blocked = host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  if (blocked) throw new Error("不支持本地或内网地址。");
  target.hash = "";
  return target;
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return named[entity.toLowerCase()] || " ";
  });
}

function cleanText(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/g, " "))
    .replace(/[\t\r ]+/g, " ").replace(/\n\s+/g, "\n").trim();
}

function cleanMarkdown(value) {
  return String(value)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_ARTICLE_CHARS);
}

function metaContent(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const first = html.match(new RegExp("<meta[^>]+(?:property|name)=[\"']" + escaped + "[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>", "i"));
    const reversed = html.match(new RegExp("<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']" + escaped + "[\"'][^>]*>", "i"));
    if (first || reversed) return cleanText((first || reversed)[1]);
  }
  return "";
}

function extractArticle(html, finalUrl) {
  const withoutNoise = html
    .replace(/<(script|style|svg|noscript|template|form|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ");
  const article = withoutNoise.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main = withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const scope = article || main || withoutNoise;
  const blocks = [];
  const blockPattern = /<(p|h2|h3|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockPattern.exec(scope)) && blocks.length < 180) {
    const text = cleanText(match[2]);
    if (text.length >= 45 && !blocks.includes(text)) blocks.push(text);
  }
  const titleTag = cleanText(withoutNoise.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  return {
    title: metaContent(html, ["og:title", "twitter:title"]) || titleTag,
    siteName: metaContent(html, ["og:site_name", "application-name"]) || new URL(finalUrl).hostname.replace(/^www\./, ""),
    body: blocks.join("\n\n").slice(0, MAX_ARTICLE_CHARS),
    url: finalUrl,
    extractionSource: "direct",
  };
}

async function extractDirect(target) {
  const response = await fetch(target, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("原网站返回 HTTP " + response.status);
  if (!(response.headers.get("content-type") || "").includes("text/html")) throw new Error("链接不是普通网页");
  if (Number(response.headers.get("content-length") || 0) > MAX_HTML_BYTES) throw new Error("页面过大");
  const article = extractArticle((await response.text()).slice(0, MAX_HTML_BYTES), response.url || target.toString());
  if (article.body.length < 180) throw new Error("正文过短");
  return article;
}

async function extractWithBrowser(env, target) {
  if (!env.BROWSER) throw new Error("未绑定 Browser Run");
  const response = await env.BROWSER.quickAction("markdown", {
    url: target.toString(),
    gotoOptions: { waitUntil: "domcontentloaded", timeout: 20_000 },
  });
  if (!response.ok) throw new Error("Browser Run 返回 HTTP " + response.status);
  const result = await response.json();
  const body = cleanMarkdown(result.result || result.markdown || "");
  if (body.length < 180) throw new Error("Browser Run 未提取到正文");
  return {
    title: String(result.title || body.split("\n")[0] || "").slice(0, 500),
    siteName: target.hostname.replace(/^www\./, ""),
    body,
    url: String(result.url || target),
    extractionSource: "browser-run",
  };
}

async function extractWithJina(target) {
  const response = await fetch("https://r.jina.ai/" + target.toString(), {
    headers: { accept: "text/plain", "x-return-format": "markdown" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("阅读服务返回 HTTP " + response.status);
  const raw = await response.text();
  const title = raw.match(/^Title:\s*(.+)$/mi)?.[1]?.trim() || "";
  const sourceUrl = raw.match(/^URL Source:\s*(.+)$/mi)?.[1]?.trim() || target.toString();
  const markdown = raw.split(/^Markdown Content:\s*$/mi)[1] || raw;
  const body = cleanMarkdown(markdown);
  if (body.length < 180) throw new Error("阅读服务未提取到正文");
  return {
    title,
    siteName: target.hostname.replace(/^www\./, ""),
    body,
    url: sourceUrl,
    extractionSource: "jina-reader",
  };
}

async function extractReadableArticle(env, target) {
  const failures = [];
  for (const attempt of [
    () => extractDirect(target),
    () => extractWithBrowser(env, target),
    () => extractWithJina(target),
  ]) {
    try { return await attempt(); } catch (error) { failures.push(error.message); }
  }
  throw new Error("三种读取方式均失败：" + failures.join("；") + "。");
}

function chunksForTranslation(text) {
  const paragraphs = String(text).split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const parts = paragraph.match(new RegExp("[\\s\\S]{1," + TRANSLATION_CHUNK_CHARS + "}", "g")) || [];
    for (const part of parts) {
      const candidate = current ? current + "\n\n" + part : part;
      if (candidate.length > TRANSLATION_CHUNK_CHARS && current) {
        chunks.push(current);
        current = part;
      } else {
        current = candidate;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 16);
}

function translationValue(result) {
  return String(result?.translated_text || result?.translation || result?.result?.translated_text || "").trim();
}

async function translateArticle(env, text) {
  if (!env.AI) throw new Error("Cloudflare Workers AI 尚未绑定。");
  const chunks = chunksForTranslation(text);
  const translated = [];
  for (let offset = 0; offset < chunks.length; offset += 3) {
    const batch = await Promise.all(chunks.slice(offset, offset + 3).map((chunk) => env.AI.run(
      "@cf/meta/m2m100-1.2b",
      { text: chunk, source_lang: "en", target_lang: "zh" },
    )));
    for (const result of batch) {
      const value = translationValue(result);
      if (!value) throw new Error("翻译模型没有返回译文。");
      translated.push(value);
    }
  }
  return translated.join("\n\n");
}

async function readerApi(request, env, ctx) {
  const requestUrl = new URL(request.url);
  let target;
  try { target = assertPublicHttpUrl(requestUrl.searchParams.get("url") || ""); }
  catch (error) { return json({ error: error.message }, 400); }

  const cache = caches.default;
  const cacheKey = new Request(requestUrl.origin + requestUrl.pathname + "?url=" + encodeURIComponent(target.toString()));
  const cached = await cache.match(cacheKey);
  if (cached) {
    const payload = await cached.json();
    return json({ ...payload, cached: true }, 200, "public, max-age=3600");
  }

  try {
    const article = await extractReadableArticle(env, target);
    const [titleZh, translatedText] = await Promise.all([
      article.title ? translateArticle(env, article.title) : Promise.resolve(""),
      translateArticle(env, article.body),
    ]);
    const payload = {
      url: article.url,
      title: article.title,
      titleZh,
      siteName: article.siteName,
      translatedText,
      extractionSource: article.extractionSource,
      cached: false,
      translatedAt: new Date().toISOString(),
    };
    ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=604800" },
    })));
    return json(payload, 200, "public, max-age=3600");
  } catch (error) {
    return json({ error: error.message || "文章读取或翻译失败。", originalUrl: target.toString() }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method === "GET" && url.pathname === "/reader-api") return readerApi(request, env, ctx);
    return json({
      service: "DailyReview Reader",
      status: "ok",
      browserFallback: Boolean(env.BROWSER),
    });
  },
};
