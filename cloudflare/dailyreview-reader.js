const ALLOWED_ORIGIN = "https://xf5464.github.io";
const MAX_HTML_BYTES = 2_500_000;
const MAX_ARTICLE_CHARS = 32_000;
const TRANSLATION_CHUNK_CHARS = 2_400;

const CORS_HEADERS = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "accept",
  "access-control-max-age": "86400",
  "vary": "Origin",
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

function metaContent(html, names) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const first = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"));
    const reversed = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"));
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
  const body = blocks.join("\n\n").slice(0, MAX_ARTICLE_CHARS);
  const titleTag = cleanText(withoutNoise.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  return {
    title: metaContent(html, ["og:title", "twitter:title"]) || titleTag,
    siteName: metaContent(html, ["og:site_name", "application-name"]) || new URL(finalUrl).hostname.replace(/^www\./, ""),
    body,
  };
}

function chunksForTranslation(text) {
  const paragraphs = String(text).split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const parts = paragraph.match(new RegExp(`[\\s\\S]{1,${TRANSLATION_CHUNK_CHARS}}`, "g")) || [];
    for (const part of parts) {
      const candidate = current ? `${current}\n\n${part}` : part;
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
  const cacheKey = new Request(`${requestUrl.origin}${requestUrl.pathname}?url=${encodeURIComponent(target.toString())}`, request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const payload = await cached.json();
    return json({ ...payload, cached: true }, 200, "public, max-age=3600");
  }

  try {
    const response = await fetch(target, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`原网站返回 HTTP ${response.status}。`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) throw new Error("这个链接不是普通网页文章。");
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error("文章页面过大，暂时无法读取。");
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const article = extractArticle(html, response.url || target.toString());
    if (article.body.length < 180) throw new Error("没有提取到足够的文章正文，网站可能限制自动读取。");
    const [titleZh, translatedText] = await Promise.all([
      article.title ? translateArticle(env, article.title) : Promise.resolve(""),
      translateArticle(env, article.body),
    ]);
    const payload = {
      url: response.url || target.toString(),
      title: article.title,
      titleZh,
      siteName: article.siteName,
      translatedText,
      cached: false,
      translatedAt: new Date().toISOString(),
    };
    const result = json(payload, 200, "public, max-age=3600");
    ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=604800" },
    })));
    return result;
  } catch (error) {
    return json({ error: error.message || "文章读取或翻译失败。", originalUrl: target.toString() }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method === "GET" && url.pathname === "/reader-api") return readerApi(request, env, ctx);
    return json({ service: "DailyReview Reader", status: "ok" });
  },
};
