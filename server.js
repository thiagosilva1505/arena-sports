require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",").map(origin => origin.trim()).filter(Boolean)
);
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE = "https://v3.football.api-sports.io";
const HIGHLIGHTLY_API_KEY = process.env.HIGHLIGHTLY_API_KEY;
const HIGHLIGHTLY_BASE = "https://soccer.highlightly.net";
const highlightlyCupCache = new Map();
const CUP_FIXTURE_CACHE_TTL = 60 * 1000;
const FIXTURE_CACHE_TTL = 60 * 1000;
const MATCH_DETAILS_CACHE_TTL = 5 * 60 * 1000;
const matchDetailsCache = new Map();
let fixtureRefreshPromise = null;
const NEWS_CACHE_TTL = 10 * 60 * 1000;
let newsCache = { expiresAt: 0, items: [] };
let fixtureCache = { expiresAt: 0, date: "", response: [] };

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  next();
});

app.use(express.static(path.join(__dirname, "public")));

async function apiFootball(pathname, params = {}) {
  if (!API_KEY) {
    const error = new Error("Chave da API ausente. Copie .env.example para .env e preencha API_FOOTBALL_KEY.");
    error.status = 503;
    throw error;
  }
  const url = new URL(`${API_BASE}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url, {
    method: "GET",
    headers: { "x-apisports-key": API_KEY }
  });
  const data = await response.json();
  if (!response.ok || (data.errors && Object.keys(data.errors).length > 0)) {
    const detail = data.message || JSON.stringify(data.errors) || `HTTP ${response.status}`;
    const error = new Error(`A API esportiva retornou um erro: ${detail}`);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  return data;
}

async function apiHighlightly(pathname, params = {}) {
  if (!HIGHLIGHTLY_API_KEY) {
    const error = new Error("Chave da Highlightly não configurada.");
    error.status = 503;
    throw error;
  }

  const url = new URL(`${HIGHLIGHTLY_BASE}${pathname}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-key": HIGHLIGHTLY_API_KEY
    },
    signal: AbortSignal.timeout(10000)
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || `Erro na Highlightly: HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// Placares incluem os torneios disponíveis em Classificações e competições
// oficiais de seleções principais. Amistosos e torneios de base ficam de fora.
const ALLOWED_HIGHLIGHTLY_COMPETITIONS = [
  { countries: ["brazil"], names: ["serie a", "serie b", "copa do brasil"] },
  { countries: ["argentina"], names: ["liga profesional", "copa argentina"] },
  { countries: ["england"], names: ["premier league", "championship", "fa cup"] },
  { countries: ["spain"], names: ["la liga", "copa del rey"] },
  { countries: ["italy"], names: ["serie a", "coppa italia"] },
  { countries: ["germany"], names: ["bundesliga", "dfb-pokal", "dfb pokal"] },
  { countries: ["france"], names: ["ligue 1", "coupe de france"] },
  { countries: ["portugal"], names: ["primeira liga", "taca de portugal"] },
  { countries: ["turkey", "turkiye"], names: ["super lig", "turkish cup", "turkiye kupasi"] },
  { countries: ["saudi arabia"], names: ["pro league", "king's cup", "kings cup"] },
  { countries: ["united states", "usa", "united states of america"], names: ["major league soccer", "us open cup"] },
  { countries: ["world", "europe", "south america", "africa", "asia", "north america", "oceania"], names: [
    "conmebol libertadores", "copa libertadores", "libertadores",
    "conmebol sudamericana", "copa sudamericana", "sudamericana",
    "uefa champions league", "champions league", "uefa europa league", "europa league",
    "uefa conference league", "uefa europa conference league", "conference league",
    "copa do mundo", "world cup", "fifa world cup", "euro championship",
    "uefa european championship", "euro championship - qualification",
    "uefa european championship - qualification", "euro qualification", "uefa nations league",
    "africa cup of nations", "african cup of nations", "afcon", "asian cup", "afc asian cup",
    "ofc nations cup", "arab cup",
    "copa america", "concacaf gold cup", "gold cup", "concacaf nations league",
    "world cup - qualification", "world cup qualification",
    "africa cup of nations - qualification", "asian cup - qualification",
    "concacaf gold cup - qualification", "gold cup qualification", "intercontinental play-offs"
  ] }
];

function normalizeProviderLabel(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isAllowedHighlightlyFixture(match) {
  const leagueName = normalizeProviderLabel(match.league?.name);
  const countryName = normalizeProviderLabel(match.country?.name || match.league?.country?.name);
  const youthCompetitionPattern = /\b(?:u[\s._-]*\d{2,3}|under[\s._-]*\d{2,3}|sub[\s._-]*\d{2,3}|women|woman|female|feminino|feminina|youth|junior|juvenil|reserves?|primavera|academy|olympics?|premier league 2|pl2|professional development league|development league|liga revelacao|elite league)\b/i;
  const fixtureLabels = [
    leagueName,
    normalizeProviderLabel(match.round),
    normalizeProviderLabel(match.homeTeam?.name || match.homeTeam?.fullName),
    normalizeProviderLabel(match.awayTeam?.name || match.awayTeam?.fullName)
  ];
  if (fixtureLabels.some(label => youthCompetitionPattern.test(label))) return false;
  return ALLOWED_HIGHLIGHTLY_COMPETITIONS.some(group => {
    const countryMatches = group.countries.includes(countryName)
      || (group.countries.includes("world") && countryName === "international");
    return countryMatches && group.names.some(name => leagueName === name || leagueName.includes(name));
  });
}

function normalizeHighlightlyFixture(match) {
  const state = match.state || {};
  const descriptions = {
    "to be announced": "TBD", "not started": "NS", "first half": "1H",
    "second half": "2H", "half time": "HT", "break time": "BT",
    "extra time": "ET", "penalties": "P", "in progress": "LIVE",
    "finished": "FT", "finished after penalties": "PEN",
    "finished after extra time": "AET", "postponed": "PST",
    "suspended": "SUSP", "cancelled": "CANC", "abandoned": "ABD",
    "awarded": "AWD", "interrupted": "INT"
  };
  const currentScore = String(state.score?.current || "").match(/(\d+)\s*[-–:]\s*(\d+)/);
  return {
    fixture: {
      id: match.id,
      date: match.date,
      status: {
        short: descriptions[normalizeProviderLabel(state.description)] || "TBD",
        long: state.description || "Unknown",
        elapsed: state.clock ?? null
      }
    },
    league: {
      id: match.league?.id,
      name: match.league?.name,
      country: match.country?.name || match.league?.country?.name
    },
    teams: {
      home: match.homeTeam ? { id: match.homeTeam.id, name: match.homeTeam.name, logo: match.homeTeam.logo } : null,
      away: match.awayTeam ? { id: match.awayTeam.id, name: match.awayTeam.name, logo: match.awayTeam.logo } : null
    },
    goals: { home: currentScore ? Number(currentScore[1]) : null, away: currentScore ? Number(currentScore[2]) : null }
  };
}

const HIGHLIGHTLY_KNOCKOUT_COMPETITIONS = {
  73: { name: "Copa do Brasil", aliases: ["Copa do Brasil"], country: "Brazil", knownId: 62907 },
  130: { name: "Copa Argentina", aliases: ["Copa Argentina"], country: "Argentina" },
  45: { name: "FA Cup", aliases: ["FA Cup"], country: "England" },
  143: { name: "Copa del Rey", aliases: ["Copa del Rey"], country: "Spain" },
  137: { name: "Coppa Italia", aliases: ["Coppa Italia"], country: "Italy" },
  81: { name: "DFB-Pokal", aliases: ["DFB-Pokal", "DFB Pokal"], country: "Germany" },
  66: { name: "Coupe de France", aliases: ["Coupe de France"], country: "France" },
  96: { name: "Taça de Portugal", aliases: ["Taça de Portugal", "Taca de Portugal"], country: "Portugal" },
  206: { name: "Turkish Cup", aliases: ["Turkish Cup", "Türkiye Kupası", "Turkiye Kupasi"], country: "Turkey" },
  504: { name: "King's Cup", aliases: ["King's Cup", "Kings Cup"], country: "Saudi Arabia" },
  257: { name: "US Open Cup", aliases: ["US Open Cup"], country: "USA" },
  13: { name: "Libertadores", aliases: ["CONMEBOL Libertadores", "Copa Libertadores"], country: "World", knownId: 11847 },
  11: { name: "Sudamericana", aliases: ["CONMEBOL Sudamericana", "Copa Sudamericana"], country: "World", knownId: 10145 },
  2: { name: "Champions League", aliases: ["UEFA Champions League"], country: "World", knownId: 2486 },
  3: { name: "Europa League", aliases: ["UEFA Europa League"], country: "World", knownId: 3337 },
  848: { name: "Conference League", aliases: ["UEFA Conference League", "UEFA Europa Conference League"], country: "World", knownId: 722432 }
};

function decodeXml(value = "") {
  const decodeEntities = text => text
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  const decoded = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // RSS descriptions can contain HTML encoded once or twice. Decode before
  // stripping tags so encoded anchors and their attributes never reach UI.
  return decodeEntities(decodeEntities(decoded))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ").trim();
}

function rssTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function rssImage(block) {
  const candidates = [
    { tag: "media:thumbnail", imageByDefault: true },
    { tag: "media:content", imageByDefault: false },
    { tag: "enclosure", imageByDefault: false }
  ];
  for (const candidate of candidates) {
    const match = block.match(new RegExp(`<${candidate.tag}\\b([^>]*)\\/?\\s*>`, "i"));
    if (!match) continue;
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, name, doubleQuoted, singleQuoted]) => [name.toLowerCase(), doubleQuoted ?? singleQuoted]));
    const isImage = candidate.imageByDefault || attributes.medium === "image" || /^image\//i.test(attributes.type || "");
    if (!isImage || !attributes.url) continue;
    try {
      const imageUrl = new URL(decodeXml(attributes.url));
      if (imageUrl.protocol === "https:") return imageUrl.href;
    } catch {}
  }
  return "";
}

function htmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeXml(match[1] ?? match[2] ?? match[3]) : "";
}

function openGraphImage(html, pageUrl) {
  for (const [, tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const property = htmlAttribute(tag, "property").toLowerCase();
    const name = htmlAttribute(tag, "name").toLowerCase();
    if (property !== "og:image" && property !== "og:image:url" && name !== "twitter:image") continue;
    const value = htmlAttribute(tag, "content");
    if (!value) continue;
    try {
      const imageUrl = new URL(value, pageUrl);
      if (imageUrl.protocol === "https:") return imageUrl.href;
    } catch {}
  }
  return "";
}

async function fetchArticleImage(articleUrl) {
  try {
    const url = new URL(articleUrl);
    if (url.protocol !== "https:" || url.hostname !== "news.google.com") return "";
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ArenaSports/1.0)" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow"
    });
    const finalUrl = new URL(response.url);
    if (!response.ok || finalUrl.protocol !== "https:" || !response.headers.get("content-type")?.includes("text/html")) return "";

    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks = [];
    let size = 0;
    while (size < 160_000) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = 160_000 - size;
      chunks.push(value.subarray(0, remaining));
      size += Math.min(value.byteLength, remaining);
      if (value.byteLength > remaining) break;
    }
    await reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))));
    return openGraphImage(html, finalUrl.href);
  } catch {
    return "";
  }
}

async function addArticleImages(items) {
  const targets = items.filter(item => !item.image).slice(0, 12);
  let next = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (next < targets.length) {
      const item = targets[next++];
      item.image = await fetchArticleImage(item.link);
    }
  });
  await Promise.all(workers);
  return items;
}

async function fetchNewsFeed(sport, terms) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", terms);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  url.searchParams.set("ceid", "BR:pt-419");
  const response = await fetch(url, {
    headers: { "user-agent": "ArenaSports/1.0 (RSS reader)" },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Feed de ${sport}: HTTP ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([, block]) => {
    const title = rssTag(block, "title");
    const link = rssTag(block, "link");
    const source = rssTag(block, "source");
    const publishedAt = rssTag(block, "pubDate");
    const image = rssImage(block);
    return { title, link, source, publishedAt, image, sport };
  }).filter(item => item.title && /^https:\/\//i.test(item.link));
}

app.get("/api/news", async (_req, res) => {
  if (newsCache.expiresAt > Date.now()) return res.json({ response: newsCache.items, cached: true });
  const feeds = [
    ["Futebol", "futebol Brasil OR Brasileirão"],
    ["Basquete", "basquete Brasil NBA"],
    ["Vôlei", "vôlei Brasil"],
    ["Tênis", "tênis Brasil"],
    ["Fórmula 1", "Fórmula 1 Brasil"]
  ];
  try {
    const results = await Promise.allSettled(feeds.map(([sport, terms]) => fetchNewsFeed(sport, terms)));
    const items = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
    const unique = [...new Map(items.map(item => [`${item.title}|${item.link}`, item])).values()]
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 30);
    if (!unique.length) throw new Error("Os feeds não retornaram matérias. Tente novamente mais tarde.");
    const enriched = await addArticleImages(unique);
    newsCache = { items: enriched, expiresAt: Date.now() + NEWS_CACHE_TTL };
    res.json({ response: enriched, cached: false });
  } catch (error) {
    res.status(502).json({ error: error.message || "Não foi possível consultar as notícias." });
  }
});

async function fetchTodayFixtures(today) {
  const limit = 100;
  const firstPage = await apiHighlightly("/matches", {
    date: today,
    timezone: "America/Sao_Paulo",
    limit,
    offset: 0
  });

  const matches = [...(firstPage.data || firstPage.response || [])];
  const totalCount = Number(firstPage.pagination?.totalCount || matches.length);
  const offsets = [];
  for (let offset = limit; offset < totalCount && offset < 500; offset += limit) offsets.push(offset);

  // As páginas adicionais são consultadas em paralelo, em vez de uma por vez.
  if (offsets.length) {
    const pages = await Promise.all(offsets.map(offset => apiHighlightly("/matches", {
      date: today,
      timezone: "America/Sao_Paulo",
      limit,
      offset
    })));
    pages.forEach(page => matches.push(...(page.data || page.response || [])));
  }

  return matches.filter(isAllowedHighlightlyFixture).map(normalizeHighlightlyFixture);
}

async function refreshTodayFixtures(today) {
  if (fixtureRefreshPromise) return fixtureRefreshPromise;
  fixtureRefreshPromise = fetchTodayFixtures(today)
    .then(response => {
      fixtureCache = { date: today, response, expiresAt: Date.now() + FIXTURE_CACHE_TTL };
      return response;
    })
    .finally(() => { fixtureRefreshPromise = null; });
  return fixtureRefreshPromise;
}

app.get("/api/fixtures", async (_req, res) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());

  if (fixtureCache.date === today && fixtureCache.response.length) {
    const cached = fixtureCache.response;
    if (fixtureCache.expiresAt > Date.now()) {
      return res.json({ response: cached, results: cached.length, cached: true });
    }
    // Entrega o último resultado imediatamente e atualiza em segundo plano.
    refreshTodayFixtures(today).catch(error => console.error("Falha ao atualizar placares:", error.message));
    return res.json({ response: cached, results: cached.length, cached: true, refreshing: true });
  }

  try {
    const response = await refreshTodayFixtures(today);
    res.json({ response, results: response.length, cached: false });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erro interno ao consultar partidas na Highlightly." });
  }
});

app.get("/api/matches/:matchId/details", async (req, res) => {
  const matchId = String(req.params.matchId || "");
  if (!/^\d+$/.test(matchId)) return res.status(400).json({ error: "ID de partida inválido." });

  const cached = matchDetailsCache.get(matchId);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ response: cached.response, cached: true });
  }

  try {
    const [statisticsResult, lineupsResult] = await Promise.allSettled([
      apiHighlightly(`/statistics/${matchId}`),
      apiHighlightly(`/lineups/${matchId}`)
    ]);
    const response = {
      statistics: statisticsResult.status === "fulfilled" ? statisticsResult.value : null,
      lineups: lineupsResult.status === "fulfilled" ? lineupsResult.value : null,
      errors: {
        statistics: statisticsResult.status === "rejected" ? statisticsResult.reason.message : null,
        lineups: lineupsResult.status === "rejected" ? lineupsResult.reason.message : null
      }
    };
    matchDetailsCache.set(matchId, { response, expiresAt: Date.now() + MATCH_DETAILS_CACHE_TTL });
    if (matchDetailsCache.size > 300) matchDetailsCache.delete(matchDetailsCache.keys().next().value);
    res.json({ response, cached: false });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Não foi possível carregar os dados da partida." });
  }
});

app.get("/api/standings", async (req, res) => {
  try {
    const league = String(req.query.league || "71");
    const season = String(req.query.season || new Date().getFullYear());
    if (!/^\d+$/.test(league) || !/^\d{4}$/.test(season)) {
      return res.status(400).json({ error: "Informe league e season válidos." });
    }
    const data = await apiFootball("/standings", { league, season });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erro interno ao consultar classificação." });
  }
});

app.get("/api/highlightly/cup-fixtures", async (req, res) => {
  const cupKey = String(req.query.cup || "");
  const cup = HIGHLIGHTLY_KNOCKOUT_COMPETITIONS[cupKey];
  const season = String(req.query.season || new Date().getFullYear());
  if (!cup || !/^\d{4}$/.test(season)) {
    return res.status(400).json({ error: "Informe uma copa e temporada validas." });
  }

  const cacheKey = `${cupKey}:${season}`;
  const cached = highlightlyCupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json({ response: cached.matches, cached: true });

  try {
    let leagueId = cup.knownId;
    if (!leagueId) {
      let catalog = await apiHighlightly("/leagues", {
        season,
        leagueName: cup.name,
        countryName: cup.country,
        limit: 100,
        offset: 0
      });
      let leagues = catalog.data || catalog.response || [];
      if (!leagues.length) {
        catalog = await apiHighlightly("/leagues", { season, leagueName: cup.name, limit: 100, offset: 0 });
        leagues = catalog.data || catalog.response || [];
      }
      const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const country = normalize(cup.country);
      const aliases = cup.aliases.map(normalize);
      let match = leagues.find(item => aliases.includes(normalize(item.name)) && normalize(item.country?.name) === country)
        || leagues.find(item => aliases.includes(normalize(item.name)));
      if (!match) {
        catalog = await apiHighlightly("/leagues", { season, countryName: cup.country, limit: 100, offset: 0 });
        leagues = catalog.data || catalog.response || [];
        match = leagues.find(item => aliases.includes(normalize(item.name)));
      }
      if (!match) {
        return res.status(404).json({ error: `A Highlightly nao encontrou ${cup.name} na temporada ${season}.` });
      }
      leagueId = match.id;
    }

    const matches = [];
    let offset = 0;
    let totalCount = 0;
    let hasMore = true;
    const limit = 100;
    do {
      const page = await apiHighlightly("/matches", {
        leagueId,
        season,
        timezone: "America/Sao_Paulo",
        limit,
        offset
      });
      const batch = page.data || page.response || [];
      matches.push(...batch);
      totalCount = Number(page.pagination?.totalCount || batch.length);
      offset += batch.length;
      hasMore = batch.length > 0;
    } while (hasMore && offset < totalCount && offset < 300);

    highlightlyCupCache.set(cacheKey, { matches, expiresAt: Date.now() + CUP_FIXTURE_CACHE_TTL });
    res.json({ response: matches, cached: false, leagueId });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erro ao consultar jogos da copa na Highlightly." });
  }
});

app.get("/api/highlightly/leagues", async (req, res) => {
  try {
    const season = String(req.query.season || "2026");
    const leagueName = String(req.query.name || "");
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 100);

    const data = await apiHighlightly("/leagues", {
      season,
      leagueName,
      offset,
      limit
    });

    res.json(data);

  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Erro ao consultar campeonatos na Highlightly."
    });
  }
});

app.get("/api/highlightly/standings", async (req, res) => {
  try {
    const leagueId = String(req.query.leagueId || "");
    const season = String(req.query.season || "");

    if (!/^\d+$/.test(leagueId) || !/^\d{4}$/.test(season)) {
      return res.status(400).json({
        error: "Informe leagueId e season válidos."
      });
    }

    const data = await apiHighlightly("/standings", {
      leagueId,
      season
    });

    res.json(data);

  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Erro ao consultar classificação na Highlightly."
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", apiKeyConfigured: Boolean(API_KEY) });
});

app.listen(PORT, () => {
  console.log(`Arena Sports rodando em http://localhost:${PORT}`);
});
