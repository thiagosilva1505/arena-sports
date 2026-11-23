const API_BASE_URL = String(window.ARENA_API_BASE_URL || "").replace(/\/+$/, "");
const apiUrl = (pathname) => `${API_BASE_URL}${pathname}`;

const searchInput = document.querySelector("#search-input");
let newsCards = [...document.querySelectorAll(".news-card")];
const sportButtons = [...document.querySelectorAll(".sport-chip")];
const emptyState = document.querySelector("#empty-state");
const newsCount = document.querySelector("#news-count");
const newsGrid = document.querySelector("#news-grid");
const newsStatus = document.querySelector("#news-status");
const menuToggle = document.querySelector("#menu-toggle");
const mainNav = document.querySelector("#main-nav");
const themeToggle = document.querySelector("#theme-toggle");

let savedTheme = "dark";
try {
  savedTheme = localStorage.getItem("arena-theme") === "light" ? "light" : "dark";
} catch {}

function applyTheme(theme, save = false) {
  const isLight = theme === "light";
  document.documentElement.dataset.theme = isLight ? "light" : "dark";
  if (themeToggle) {
    themeToggle.innerHTML = isLight
      ? '<span aria-hidden="true">☾</span><span>Tema escuro</span>'
      : '<span aria-hidden="true">☀</span><span>Tema claro</span>';
    themeToggle.setAttribute("aria-label", `Ativar tema ${isLight ? "escuro" : "claro"}`);
    themeToggle.setAttribute("aria-pressed", String(isLight));
  }
  if (save) {
    try { localStorage.setItem("arena-theme", isLight ? "light" : "dark"); } catch {}
  }
}

applyTheme(savedTheme);
themeToggle?.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light", true);
});

let activeSport = "Todos";

function filterNews() {
  const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  let visible = 0;
  newsCards.forEach((card) => {
    const matchesSport = activeSport === "Todos" || card.dataset.sport === activeSport;
    const matchesSearch = !query || `${card.dataset.title} ${card.textContent}`.toLocaleLowerCase("pt-BR").includes(query);
    const show = matchesSport && matchesSearch;
    card.hidden = !show;
    if (show) visible++;
  });
  emptyState.hidden = visible > 0 || newsCards.length === 0;
  newsCount.textContent = `${visible} ${visible === 1 ? "notícia" : "notícias"}`;
}

const newsVisuals = {
  "Futebol": ["image-football", "⚽"], "Basquete": ["image-basketball", "🏀"],
  "Vôlei": ["image-volley", "🏐"], "Tênis": ["image-tennis", "🎾"],
  "Fórmula 1": ["image-f1", "🏎️"]
};

function renderNews(items) {
  newsGrid.replaceChildren();
  items.forEach((item) => {
    const [visualClass, emoji] = newsVisuals[item.sport] || ["image-stats", "📰"];
    const card = document.createElement("article");
    card.className = "news-card";
    card.dataset.sport = item.sport || "Todos";
    card.dataset.title = item.title || "";
    const image = document.createElement("div");
    image.className = `news-image ${visualClass}`;
    const label = document.createElement("span");
    label.textContent = (item.sport || "Esportes").toLocaleUpperCase("pt-BR");
    const icon = document.createElement("b");
    icon.textContent = emoji;
    let imageUrl = "";
    try {
      const parsedImageUrl = new URL(item.image);
      if (parsedImageUrl.protocol === "https:") imageUrl = parsedImageUrl.href;
    } catch {}
    if (imageUrl) {
      const cover = document.createElement("img");
      cover.className = "news-cover";
      cover.src = imageUrl;
      cover.alt = "";
      cover.loading = "lazy";
      cover.referrerPolicy = "no-referrer";
      image.classList.add("has-cover");
      icon.hidden = true;
      image.append(cover);
    }
    image.append(label, icon);

    const copy = document.createElement("div");
    copy.className = "news-copy";
    const category = document.createElement("p");
    category.className = "news-category";
    category.textContent = `NOTÍCIAS • ${(item.sport || "ESPORTES").toLocaleUpperCase("pt-BR")}`;
    const heading = document.createElement("h3");
    heading.textContent = item.title;
    const meta = document.createElement("div");
    meta.className = "news-meta";
    const source = document.createElement("span");
    source.className = "read-time";
    source.textContent = item.source || "Fonte original";
    const date = document.createElement("time");
    date.className = "read-time";
    const published = new Date(item.publishedAt);
    if (!Number.isNaN(published.getTime())) {
      date.dateTime = published.toISOString();
      date.textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(published);
    }
    meta.append(source, date);
    const link = document.createElement("a");
    link.className = "news-source-link";
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Ler no site da publicação ↗";
    copy.append(category, heading, meta, link);
    card.append(image, copy);
    newsGrid.append(card);
  });
  newsCards = [...newsGrid.querySelectorAll(".news-card")];
  filterNews();
}

async function loadNews() {
  newsStatus.textContent = "Buscando as notícias mais recentes...";
  try {
    const response = await fetch(apiUrl("/api/news"));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar as notícias.");
    renderNews(data.response || []);
    newsStatus.textContent = "Notícias reunidas de feeds RSS. Selecione uma matéria para abrir a publicação original.";
  } catch (error) {
    newsStatus.textContent = `${error.message} Atualize a página para tentar novamente.`;
    newsCount.textContent = "Feed indisponível";
  }
}

newsGrid.addEventListener("error", event => {
  const cover = event.target;
  if (!(cover instanceof HTMLImageElement) || !cover.classList.contains("news-cover")) return;
  const container = cover.closest(".news-image");
  cover.remove();
  container?.classList.remove("has-cover");
  const icon = container?.querySelector("b");
  if (icon) icon.hidden = false;
}, true);

sportButtons.forEach((button) => button.addEventListener("click", () => {
  sportButtons.forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");
  activeSport = button.dataset.sport;
  filterNews();
}));
searchInput.addEventListener("input", filterNews);
menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
});
mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  mainNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));

document.querySelector("#year").textContent = new Date().getFullYear();
document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long", day: "2-digit", month: "long", year: "numeric"
}).format(new Date()).toLocaleUpperCase("pt-BR");
filterNews();
loadNews();

const scoreGrid = document.querySelector("#score-grid");
const apiStatus = document.querySelector("#api-status");
const refreshButton = document.querySelector("#refresh-scores");
const statsPanel = document.querySelector("#estatisticas");
const matchModal = document.querySelector("#match-modal");
const matchModalContent = document.querySelector("#match-modal-content");
const matchModalClose = document.querySelector("#match-modal-close");

// Se o servidor de imagens do escudo estiver indisponível, mostra uma sigla
// no lugar do ícone quebrado. O listener usa captura porque "error" não borbulha.
scoreGrid.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains("team-logo")) return;
  const fallback = document.createElement("span");
  fallback.className = "team-icon";
  fallback.textContent = image.dataset.fallback || "TIME";
  image.replaceWith(fallback);
}, true);

function formatTime(dateString) {
  if (!dateString) return "Horário indisponível";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(dateString));
}
function scoreValue(value) {
  return value === null || value === undefined ? "—" : value;
}

function normalizeCompetitionLabel(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function translateCompetitionName(league = {}) {
  const name = normalizeCompetitionLabel(league.name);
  const country = normalizeCompetitionLabel(league.country);
  const countrySpecific = {
    "brazil|serie a": "Brasileirão Série A",
    "brazil|serie b": "Brasileirão Série B",
    "argentina|liga profesional argentina": "Liga Profissional Argentina",
    "turkey|super lig": "Campeonato Turco - Süper Lig",
    "saudi-arabia|pro league": "Liga Saudita",
    "usa|major league soccer": "MLS"
  };
  const competitionSpecific = {
    "premier league": "Campeonato Inglês - Premier League",
    "championship": "Campeonato Inglês - Championship",
    "fa cup": "Copa da Inglaterra",
    "la liga": "Campeonato Espanhol - La Liga",
    "copa del rey": "Copa do Rei da Espanha",
    "serie a": country === "italy" ? "Campeonato Italiano - Serie A" : league.name,
    "coppa italia": "Copa da Itália",
    "bundesliga": "Campeonato Alemão - Bundesliga",
    "dfb-pokal": "Copa da Alemanha",
    "dfb pokal": "Copa da Alemanha",
    "ligue 1": "Campeonato Francês - Ligue 1",
    "coupe de france": "Copa da França",
    "primeira liga": "Campeonato Português - Primeira Liga",
    "taca de portugal": "Taça de Portugal",
    "turkish cup": "Copa da Turquia",
    "king's cup": "Copa do Rei da Arábia Saudita",
    "kings cup": "Copa do Rei da Arábia Saudita",
    "us open cup": "Copa dos Estados Unidos",
    "copa argentina": "Copa Argentina",
    "conmebol libertadores": "Copa Libertadores",
    "copa libertadores": "Copa Libertadores",
    "conmebol sudamericana": "Copa Sul-Americana",
    "copa sudamericana": "Copa Sul-Americana",
    "uefa champions league": "Liga dos Campeões da UEFA",
    "uefa europa league": "Liga Europa da UEFA",
    "uefa conference league": "Liga Conferência da UEFA",
    "uefa europa conference league": "Liga Conferência da UEFA",
    "world cup": "Copa do Mundo",
    "fifa world cup": "Copa do Mundo",
    "fifa world cup - qualification": "Eliminatórias da Copa do Mundo",
    "euro championship": "Eurocopa",
    "uefa european championship": "Eurocopa",
    "uefa european championship - qualification": "Eliminatórias da Eurocopa",
    "euro championship - qualification": "Eliminatórias da Eurocopa",
    "uefa nations league": "Liga das Nações da UEFA",
    "copa america": "Copa América",
    "friendlies": "Amistosos internacionais",
    "africa cup of nations": "Copa Africana de Nações",
    "africa cup of nations - qualification": "Eliminatórias da Copa Africana de Nações",
    "asian cup": "Copa da Ásia",
    "asian cup - qualification": "Eliminatórias da Copa da Ásia",
    "concacaf gold cup": "Copa Ouro da CONCACAF",
    "concacaf gold cup - qualification": "Eliminatórias da Copa Ouro da CONCACAF",
    "concacaf nations league": "Liga das Nações da CONCACAF",
    "world cup - qualification africa": "Eliminatórias da Copa do Mundo - África",
    "world cup qualification - africa": "Eliminatórias da Copa do Mundo - África",
    "world cup - qualification asia": "Eliminatórias da Copa do Mundo - Ásia",
    "world cup qualification - asia": "Eliminatórias da Copa do Mundo - Ásia",
    "world cup - qualification concacaf": "Eliminatórias da Copa do Mundo - CONCACAF",
    "world cup qualification - concacaf": "Eliminatórias da Copa do Mundo - CONCACAF",
    "world cup - qualification europe": "Eliminatórias da Copa do Mundo - Europa",
    "world cup qualification - europe": "Eliminatórias da Copa do Mundo - Europa",
    "world cup - qualification oceania": "Eliminatórias da Copa do Mundo - Oceania",
    "world cup qualification - oceania": "Eliminatórias da Copa do Mundo - Oceania",
    "world cup - qualification south america": "Eliminatórias da Copa do Mundo - América do Sul",
    "world cup qualification - south america": "Eliminatórias da Copa do Mundo - América do Sul",
    "world cup - qualification intercontinental play-offs": "Repescagem intercontinental da Copa do Mundo",
    "copa do brasil": "Copa do Brasil",
    "liga profesional argentina": "Liga Profissional Argentina",
    "super lig": "Campeonato Turco - Süper Lig",
    "pro league": country === "saudi-arabia" ? "Liga Saudita" : league.name,
    "major league soccer": "MLS"
  };
  return countrySpecific[`${country}|${name}`] || competitionSpecific[name] || league.name || "Futebol";
}

function translateCompetitionCountry(country) {
  const countries = {
    "world": "Seleções",
    "international": "Seleções",
    "europe": "Europa",
    "south america": "América do Sul",
    "brazil": "Brasil",
    "argentina": "Argentina",
    "england": "Inglaterra",
    "spain": "Espanha",
    "italy": "Itália",
    "germany": "Alemanha",
    "france": "França",
    "portugal": "Portugal",
    "turkey": "Turquia",
    "turkiye": "Turquia",
    "saudi-arabia": "Arábia Saudita",
    "saudi arabia": "Arábia Saudita",
    "usa": "Estados Unidos",
    "united states": "Estados Unidos"
  };
  return countries[normalizeCompetitionLabel(country)] || country;
}

function statusLabel(fixture) {
  const short = fixture?.status?.short || "";
  const elapsed = fixture?.status?.elapsed;
  if (short === "HT") return "INTERVALO";
  if (short === "BT") return "INTERVALO";
  if (["1H", "2H", "ET", "P", "LIVE"].includes(short)) {
    if (short === "ET") return elapsed ? `PRORROGAÇÃO • ${elapsed}′` : "PRORROGAÇÃO";
    if (short === "P") return "DISPUTA DE PÊNALTIS";
    return elapsed ? `AO VIVO • ${elapsed}′` : "AO VIVO";
  }
  if (["FT", "AET", "PEN"].includes(short)) return "ENCERRADO";
  if (short === "SUSP") return "SUSPENSO";
  if (["PST", "CANC", "ABD", "AWD", "WO"].includes(short)) return "ADIADO/CANCELADO";
  if (short === "INT") return "PARTIDA INTERROMPIDA";
  if (short === "NS" || short === "TBD") return "AGENDADO";
  return "STATUS: " + (short || "INDEFINIDO");
}
function renderFixtures(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    scoreGrid.innerHTML = '<div class="score-card"><strong>Nenhuma partida encontrada para hoje.</strong><p class="demo-notice">Isso pode acontecer fora dos dias de jogos ou conforme a cobertura do plano da API.</p></div>';
    return;
  }
  const orderedFixtures = [...fixtures].sort((a, b) => {
    const liveStatuses = ["1H", "2H", "HT", "ET", "P", "LIVE"];
    const aLive = liveStatuses.includes(a.fixture?.status?.short) ? 0 : 1;
    const bLive = liveStatuses.includes(b.fixture?.status?.short) ? 0 : 1;
    return aLive - bLive || new Date(a.fixture?.date || 0) - new Date(b.fixture?.date || 0);
  });
  scoreGrid.innerHTML = orderedFixtures.slice(0, 30).map((item) => {
    const f = item.fixture || {};
    const teams = item.teams || {};
    const goals = item.goals || {};
    const league = item.league || {};
    const status = statusLabel(f);
    const live = status.startsWith("AO VIVO") || status === "INTERVALO";
    const finished = status === "ENCERRADO";
    const timeText = live ? (status === "INTERVALO" ? "Intervalo" : status) : finished ? "Partida finalizada" : `${formatTime(f.date)} • ${f.date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(f.date)) : ""}`;
    const homeName = teams.home?.name || "Mandante";
    const awayName = teams.away?.name || "Visitante";
    const matchId = f.id;
    const homeLogo = teams.home?.logo
      ? `<img class="team-logo" src="${teams.home.logo}" alt="" data-fallback="${homeName.slice(0, 3).toUpperCase()}" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="team-icon">${homeName.slice(0, 3).toUpperCase()}</span>`;
    const awayLogo = teams.away?.logo
      ? `<img class="team-logo" src="${teams.away.logo}" alt="" data-fallback="${awayName.slice(0, 3).toUpperCase()}" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="team-icon">${awayName.slice(0, 3).toUpperCase()}</span>`;
    return `<article class="score-card" data-match-id="${matchId || ""}" data-home-team-id="${teams.home?.id || ""}" data-away-team-id="${teams.away?.id || ""}">
      <div class="score-meta"><span>${escapeHTML(translateCompetitionName(league))}${league.country ? " • " + escapeHTML(translateCompetitionCountry(league.country)) : ""}</span><span class="status ${live ? "live" : finished ? "" : "scheduled"}">${status}</span></div>
      <div class="match">
        <div class="team">${homeLogo}<span>${homeName}</span></div>
        <strong class="score">${scoreValue(goals.home)} <small>:</small> ${scoreValue(goals.away)}</strong>
        <div class="team away"><span>${awayName}</span>${awayLogo}</div>
      </div>
      <div class="score-footer"><span>${timeText}</span><span>${escapeHTML(f.venue?.name || "Futebol")}</span></div>
      <button class="match-details-button" type="button" data-match-id="${matchId || ""}" ${matchId ? "" : "disabled"}>＋ Dados da partida</button>
    </article>`;
  }).join("");
}


function renderMatchStatistics(statistics, homeTeamId, awayTeamId) {
  let teams = Array.isArray(statistics)
    ? statistics
    : statistics?.data || [];

  if (homeTeamId && awayTeamId && teams.length > 1) {
    const home = teams.find(team =>
      String(team.team?.id) === String(homeTeamId)
    );
    const away = teams.find(team =>
      String(team.team?.id) === String(awayTeamId)
    );

    if (home && away) teams = [home, away];
  }

  if (teams.length < 2) {
    return '<p class="match-empty">Estatísticas ainda não disponíveis.</p>';
  }

  const allowed = [
    {
      names: ["Ball Possession", "Posse de bola"],
      label: "POSSE DE BOLA"
    },
    {
      names: ["Total Shots", "Total de chutes", "Total shots"],
      label: "TOTAL DE CHUTES"
    },
    {
      names: ["Shots on Goal", "Chutes ao gol", "Shots on target"],
      label: "CHUTES AO GOL"
    },
    {
      names: ["Duels Won", "Disputas ganhas", "Duels won"],
      label: "DISPUTAS GANHAS"
    }
  ];

  const safe = value => escapeHTML(
    value === null || value === undefined || value === ""
      ? "—"
      : String(value)
  );

  const getValue = (team, names) => {
    const stat = (team.statistics || []).find(item =>
      names.some(name =>
        String(item.displayName || item.name || "")
          .toLowerCase() === name.toLowerCase()
      )
    );
    return stat?.value ?? null;
  };

  const rows = allowed.map(item => {
    const home = getValue(teams[0], item.names);
    const away = getValue(teams[1], item.names);

    if (home === null && away === null) return "";

    const number = value =>
      parseFloat(String(value ?? "").replace("%", "").replace(",", "."));

    const h = number(home);
    const a = number(away);
    const total = h + a;

    const homeWidth = total > 0 && Number.isFinite(total)
      ? (h / total) * 100 : 50;

    const awayWidth = total > 0 && Number.isFinite(total)
      ? (a / total) * 100 : 50;

    return `
      <div class="match-stat-item">
        <div class="match-stat-name">${item.label}</div>

        <div class="match-stat-values">
          <strong>${safe(home)}</strong>
          <strong>${safe(away)}</strong>
        </div>

        <div class="match-stat-bars">
          <div class="match-stat-track">
            <div class="match-stat-fill" style="width:${homeWidth}%"></div>
          </div>
          <div class="match-stat-track">
            <div class="match-stat-fill" style="width:${awayWidth}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return rows
    ? `<div class="match-stats-comparison">${rows}</div>`
    : '<p class="match-empty">A API não disponibilizou essas estatísticas.</p>';
}

const translations = {
  "Ball Possession": "Posse de bola",
  "Total Shots": "Total de chutes",
  "Shots on Goal": "Chutes ao gol",
  "Duels Won": "Disputas ganhas"
};

  };

  const safe = value => escapeHTML(
    value === null || value === undefined || value === "" ? "—" : String(value)
  );

  const allowedStats = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "Duels Won"
];

const allNames = allowedStats.filter(name =>
  teams.some(team =>
    (team.statistics || []).some(stat => stat.displayName === name)
  )
);

  if (!allNames.length) {
    return '<p class="match-empty">A API ainda não disponibilizou estatísticas.</p>';
  }

  const rows = allNames.map(name => {
    const home = teams[0]?.statistics?.find(item => item.displayName === name)?.value;
    const away = teams[1]?.statistics?.find(item => item.displayName === name)?.value;

    const homeNumber = parseFloat(String(home ?? "").replace("%", "").replace(",", "."));
    const awayNumber = parseFloat(String(away ?? "").replace("%", "").replace(",", "."));

    const validNumbers = Number.isFinite(homeNumber) && Number.isFinite(awayNumber);
    const total = validNumbers ? homeNumber + awayNumber : 0;

    const homePercent = total > 0 ? (homeNumber / total) * 100 : 50;
    const awayPercent = total > 0 ? (awayNumber / total) * 100 : 50;

    const label = translations[name] || name;

    return `
      <div class="match-stat-item">
        <span class="match-stat-name">${safe(label)}</span>

        <div class="match-stat-values">
          <strong>${safe(home)}</strong>
          <strong>${safe(away)}</strong>
        </div>

        <div class="match-stat-bars">
          <div class="match-stat-track">
            <div class="match-stat-fill" style="width:${homePercent}%"></div>
          </div>
          <div class="match-stat-track">
            <div class="match-stat-fill" style="width:${awayPercent}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `<div class="match-stats-comparison">${rows}</div>`;
}


function renderLineupTeam(team, fallbackName) {
  if (!team) return `<section class="lineup-team"><h4>${escapeHTML(fallbackName)}</h4><p class="match-empty">Escalação ainda não divulgada.</p></section>`;
  const starters = (team.initialLineup || []).flat();
  const players = starters.map(player => `<li><b>${player.number ?? "–"}</b> ${escapeHTML(player.name || "Jogador")}</li>`).join("");
  const substitutes = (team.substitutes || []).map(player => `<li><b>${player.number ?? "–"}</b> ${escapeHTML(player.name || "Jogador")}</li>`).join("");
  return `<section class="lineup-team"><h4>${escapeHTML(team.name || fallbackName)} <small>${escapeHTML(team.formation || "")}</small></h4><h5>Titulares</h5>${players ? `<ol class="lineup-list">${players}</ol>` : '<p class="match-empty">Escalação titular não disponível.</p>'}<h5>Reservas</h5>${substitutes ? `<ul class="lineup-list substitutes-list">${substitutes}</ul>` : '<p class="match-empty">Reservas não disponíveis.</p>'}</section>`;
}

async function openMatchDetails(matchId, card) {
  if (!matchModal || !matchModalContent) return;
  matchModalContent.innerHTML = '<p class="match-loading">Carregando estatísticas e escalações...</p>';
  matchModal.showModal();
  try {
    const response = await fetch(apiUrl(`/api/matches/${encodeURIComponent(matchId)}/details`));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar os dados.");
    const details = data.response || {};
    const stats = renderMatchStatistics(details.statistics, card.dataset.homeTeamId, card.dataset.awayTeamId);
    const lineups = details.lineups || {};
    const homeName = card.querySelector(".team span")?.textContent || "Mandante";
    const awayName = card.querySelector(".team.away span")?.textContent || "Visitante";
    const statsError = details.errors?.statistics;
    const lineupError = details.errors?.lineups;
    matchModalContent.innerHTML = `
  <section class="match-modal-section">
    <h3>Escalações</h3>
    ${lineupError
      ? '<p class="match-empty">Não foi possível consultar as escalações agora.</p>'
      : `<div class="lineups-grid">
          ${renderLineupTeam(lineups.homeTeam, homeName)}
          ${renderLineupTeam(lineups.awayTeam, awayName)}
        </div>`
    }
  </section>

  <section class="match-modal-section">
    <h3>Estatísticas ao vivo</h3>
    ${statsError
      ? '<p class="match-empty">Não foi possível consultar as estatísticas agora.</p>'
      : stats
    }
  </section>

  <p class="match-data-note">
    Os dados dependem da cobertura da partida e da divulgação oficial das escalações.
  </p>
`;
  } catch (error) {
    matchModalContent.innerHTML = `<p class="match-empty">${escapeHTML(error.message || "Erro ao carregar os dados da partida.")}</p>`;
  }
}

scoreGrid.addEventListener("click", event => {
  const button = event.target.closest(".match-details-button");
  if (!button || button.disabled) return;
  const card = button.closest(".score-card");
  openMatchDetails(button.dataset.matchId, card);
});
matchModalClose?.addEventListener("click", () => matchModal.close());
matchModal?.addEventListener("click", event => {
  if (event.target === matchModal) matchModal.close();
});

async function loadFixtures(isAutomatic = false) {
  if (document.hidden && isAutomatic) return;
  refreshButton.disabled = true;
  refreshButton.textContent = "Carregando...";
  apiStatus.textContent = "Consultando a Highlightly...";
  try {
    if (!isAutomatic) {
      try {
        const cached = JSON.parse(sessionStorage.getItem("arena-fixtures-cache") || "null");
        const todayCacheKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        if (cached?.date === todayCacheKey && Array.isArray(cached.response)) {
          renderFixtures(cached.response);
          apiStatus.textContent = "Exibindo placares recentes enquanto atualizamos os dados...";
        }
      } catch {}
    }
    const response = await fetch(apiUrl("/api/fixtures"));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível consultar a API.");
    renderFixtures(data.response || []);
    try {
      sessionStorage.setItem("arena-fixtures-cache", JSON.stringify({
        date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
        response: data.response || []
      }));
    } catch {}
    const updated = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
    apiStatus.textContent = `Dados reais recebidos da Highlightly • última consulta às ${updated}. Atualização automática a cada 20 minutos.`;
  } catch (error) {
    apiStatus.textContent = `${error.message} Confira HIGHLIGHTLY_API_KEY no arquivo .env e se o servidor está rodando.`;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "↻ Atualizar placares";
  }
}
refreshButton.addEventListener("click", () => loadFixtures(false));

// O plano gratuito da API possui limite diário de requisições.
// O intervalo de 20 minutos reduz o consumo e evita consultas excessivas.
const AUTO_REFRESH_INTERVAL = 20 * 60 * 1000;
loadFixtures();
setInterval(() => loadFixtures(true), AUTO_REFRESH_INTERVAL);


// ======================================
// CLASSIFICAÇÃO DOS CAMPEONATOS
// ======================================

const standingsBody = document.querySelector("#standings-body");
const leagueSelect = document.querySelector("#league-select");
const standingsStatus = document.querySelector("#standings-status");
const standingsSeason = document.querySelector("#standings-season");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function renderChampionshipStatistics(groups, seasonLabel, message) {
  const rows = [...statsPanel.querySelectorAll(".stat-item")];
  const available = Array.isArray(groups);
  const teams = available ? groups.flatMap(group => group.standings || []) : [];
  const totals = teams.reduce((result, team) => {
    const stats = team.all || team.total || {};
    const goals = stats.goals || {};
    result.teamGames += Number(stats.played ?? stats.games ?? 0) || 0;
    result.goals += Number(goals.for ?? stats.scoredGoals ?? 0) || 0;
    return result;
  }, { teamGames: 0, goals: 0 });
  const matches = Math.floor(totals.teamGames / 2);
  const average = matches ? (totals.goals / matches).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
  const values = available ? [
    ["Partidas disputadas", matches, " jogos", Math.min(matches, 100)],
    ["Gols marcados", totals.goals, " gols", Math.min(totals.goals / 10, 100)],
    ["Média de gols", average, " gols / partida", matches ? Math.min((totals.goals / matches / 5) * 100, 100) : 0]
  ] : [
    ["Partidas disputadas", "—", " jogos", 0],
    ["Gols marcados", "—", " gols", 0],
    ["Média de gols", "—", " gols / partida", 0]
  ];

  rows.forEach((row, index) => {
    const [label, value, suffix, width] = values[index];
    row.querySelector(".stat-info > span").textContent = label;
    const strong = row.querySelector(".stat-info strong");
    strong.replaceChildren(document.createTextNode(String(value)));
    const small = document.createElement("small");
    small.textContent = suffix;
    strong.append(" ", small);
    row.querySelector(".stat-bar i").style.width = `${width}%`;
  });

  const title = statsPanel.querySelector(".section-heading h2");
  title.textContent = leagueSelect.selectedOptions[0]?.textContent.trim() || "Campeonato selecionado";
  statsPanel.querySelector(".demo-notice.small").textContent = message ||
    `Dados da classificação • temporada ${seasonLabel} • ${teams.length} equipes`;
}

function renderCupStatistics(fixtures, seasonLabel, message) {
  const games = Array.isArray(fixtures) ? fixtures : [];
  const finishedStates = new Set(["Finished", "Finished after penalties", "Finished after extra time", "Awarded"]);
  const finished = games.filter(item => finishedStates.has(item.state?.description));
  const goals = finished.reduce((sum, item) => {
    const scores = String(item.state?.score?.current || "").match(/(\d+)\s*[-:]\s*(\d+)/);
    return sum + (scores ? Number(scores[1]) + Number(scores[2]) : 0);
  }, 0);
  const teams = new Set(games.flatMap(item => [item.homeTeam?.name, item.awayTeam?.name]).filter(Boolean));
  const average = finished.length ? (goals / finished.length).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
  const values = Array.isArray(fixtures) ? [
    ["Partidas disputadas", finished.length, " jogos", Math.min(finished.length, 100)],
    ["Gols marcados", goals, " gols", Math.min(goals / 10, 100)],
    ["Média de gols", average, " gols / partida", finished.length ? Math.min((goals / finished.length / 5) * 100, 100) : 0]
  ] : [
    ["Partidas disputadas", "—", " jogos", 0], ["Gols marcados", "—", " gols", 0], ["Média de gols", "—", " gols / partida", 0]
  ];
  [...statsPanel.querySelectorAll(".stat-item")].forEach((row, index) => {
    const [label, value, suffix, width] = values[index];
    row.querySelector(".stat-info > span").textContent = label;
    const strong = row.querySelector(".stat-info strong");
    strong.replaceChildren(document.createTextNode(String(value)));
    const small = document.createElement("small");
    small.textContent = suffix;
    strong.append(" ", small);
    row.querySelector(".stat-bar i").style.width = `${width}%`;
  });
  statsPanel.querySelector(".section-heading h2").textContent = leagueSelect.selectedOptions[0]?.textContent.trim() || "Copa selecionada";
  statsPanel.querySelector(".demo-notice.small").textContent = message ||
    `Dados da Highlightly • temporada ${seasonLabel} • ${teams.size} equipes`;
}

function translateCupRound(round) {
  return String(round || "Fases e partidas")
    .replace(/\bsemi[- ]finals?\b/gi, "Semifinais")
    .replace(/\bquarter[- ]finals?\b/gi, "Quartas de final")
    .replace(/\bround of 16\b/gi, "Oitavas de final")
    .replace(/\bround of 32\b/gi, "16 avos de final")
    .replace(/\bround of 64\b/gi, "32 avos de final")
    .replace(/\bround of 128\b/gi, "64 avos de final")
    .replace(/\bround of 8\b/gi, "Quartas de final")
    .replace(/\bround of 4\b/gi, "Semifinais")
    .replace(/\bround of 2\b/gi, "Final")
    .replace(/\bgroup stage\b/gi, "Fase de grupos")
    .replace(/\bgroup\s*[-:]?\s*([a-z])\b/gi, "Grupo $1")
    .replace(/\bround\s*(\d+)\b/gi, "$1ª fase")
    .replace(/\bfinals\b/gi, "Finais")
    .toLocaleUpperCase("pt-BR");
}

function translateCupStatus(description) {
  const translations = {
    "Not started": "Agendado",
    "First half": "1º tempo",
    "Half time": "Intervalo",
    "Second half": "2º tempo",
    "Extra time": "Prorrogação",
    "Break time": "Intervalo da prorrogação",
    "Penalties": "Disputa de pênaltis",
    "Finished": "Encerrado",
    "Finished after penalties": "Encerrado nos pênaltis",
    "Finished after extra time": "Encerrado na prorrogação",
    "Postponed": "Adiado",
    "Suspended": "Suspenso",
    "Cancelled": "Cancelado",
    "Interrupted": "Interrompido",
    "Abandoned": "Abandonado",
    "Awarded": "Resultado administrativo",
    "In progress": "Em andamento",
    "To be announced": "A definir",
    "Unknown": "Status desconhecido"
  };
  return translations[description] || "Status desconhecido";
}

function formatCupScore(state) {
  const description = state.description || "";
  const rawScore = state.score?.current;
  if (description === "Not started" || !rawScore) return "— : —";
  const score = String(rawScore).replace(/\s*-\s*/, " : ");
  const normalScore = String(rawScore).match(/(\d+)\s*[-:]\s*(\d+)/);
  const penaltyScore = String(state.score?.penalties || "").match(/(\d+)\s*[-:]\s*(\d+)/);
  const endedInPenalties = description === "Finished after penalties";
  if (endedInPenalties && normalScore && penaltyScore && normalScore[1] === normalScore[2]) {
    return `${score} (${penaltyScore[1]} : ${penaltyScore[2]})`;
  }
  return score;
}

function renderCupFixtures(fixtures, append = false) {
  if (!fixtures.length) {
    if (!append) standingsBody.innerHTML = '<tr><td colspan="10">Nenhuma partida encontrada para esta copa na temporada selecionada.</td></tr>';
    return 0;
  }
  const rounds = new Map();
  fixtures.forEach(item => {
    const round = translateCupRound(item.round);
    if (!rounds.has(round)) rounds.set(round, []);
    rounds.get(round).push(item);
  });
  const rows = [...rounds].map(([round, games]) => `
    <tr class="standings-group-row"><td colspan="10">${escapeHTML(round)}</td></tr>
    ${games.map(item => {
      const state = item.state || {};
      const home = item.homeTeam?.name || "Mandante";
      const away = item.awayTeam?.name || "Visitante";
      const date = item.date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(item.date)) : "Data indisponível";
      const score = formatCupScore(state);
      const translatedStatus = translateCupStatus(state.description);
      const status = state.clock ? `${translatedStatus} • ${state.clock}′` : translatedStatus;
      return `<tr class="cup-fixture-row"><td colspan="10"><div class="cup-fixture"><time>${escapeHTML(date)}</time><span>${escapeHTML(home)}</span><strong>${escapeHTML(score)}</strong><span>${escapeHTML(away)}</span><span class="cup-fixture-status">${escapeHTML(status)}</span></div></td></tr>`;
    }).join("")}
  `).join("");
  if (append) standingsBody.insertAdjacentHTML("beforeend", rows);
  else standingsBody.innerHTML = rows;
  return fixtures.length;
}

function isKnockoutRound(round) {
  return /\b(final|semi[- ]finals?|quarter[- ]finals?|round of (2|4|8|16|32|64)|last 16|knockout|play.?offs?)\b/i
    .test(String(round || ""));
}


// ======================================
// REGRAS DE CLASSIFICAÇÃO
// ======================================

function getClassificationZone(leagueId, rank) {
  const pos = Number(rank);

  if (!Number.isFinite(pos) || pos < 1) return "";

  // Brasileirão Série A
  if (leagueId === "71") {
    if (pos <= 4) return "zone-direct";
    if (pos <= 6) return "zone-preliminary";
    if (pos <= 12) return "zone-secondary";
    if (pos >= 17) return "zone-relegation";
  }

  // Premier League
  if (leagueId === "39") {
    if (pos <= 4) return "zone-direct";
    if (pos === 5) return "zone-secondary";
    if (pos >= 18) return "zone-relegation";
  }

  // La Liga e Serie A italiana
  if (["140", "135"].includes(leagueId)) {
    if (pos <= 4) return "zone-direct";
    if (pos === 5) return "zone-secondary";
    if (pos === 6) return "zone-conference";
    if (pos >= 18) return "zone-relegation";
  }

  // Bundesliga
  if (leagueId === "78") {
    if (pos <= 4) return "zone-direct";
    if (pos === 5) return "zone-secondary";
    if (pos === 6) return "zone-conference";
    if (pos === 16) return "zone-playoff-relegation";
    if (pos >= 17) return "zone-relegation";
  }

  // Ligue 1
  if (leagueId === "61") {
    if (pos <= 3) return "zone-direct";
    if (pos === 4) return "zone-preliminary";
    if (pos === 5) return "zone-secondary";
    if (pos === 6) return "zone-conference";
    if (pos === 16) return "zone-playoff-relegation";
    if (pos >= 17) return "zone-relegation";
  }

  // Portugal e Turquia
  if (["94", "203"].includes(leagueId)) {
    if (pos <= 2) return "zone-direct";
    if (pos === 3) return "zone-preliminary";
    if (pos === 4) return "zone-secondary";
    if (pos === 5) return "zone-conference";
    if (pos === 16) return "zone-playoff-relegation";
    if (pos >= 17) return "zone-relegation";
  }

  // Arábia Saudita
  if (leagueId === "307") {
    if (pos <= 4) return "zone-direct";
    if (pos === 5) return "zone-preliminary";
    if (pos === 6) return "zone-secondary";
    if (pos >= 16) return "zone-relegation";
  }

  // Championship e Série B
  if (leagueId === "40" || leagueId === "72") {
    if (pos <= 2) return "zone-promotion";
    if (pos <= 6) return "zone-playoff";
    const relegationStart = leagueId === "40" ? 22 : 17;
    if (pos >= relegationStart) return "zone-relegation";
  }

  // MLS: sete primeiros avançam diretamente;
  // oitavo e nono disputam playoff.
  if (leagueId === "253") {
    if (pos <= 7) return "zone-promotion";
    if (pos <= 9) return "zone-playoff";
  }

  // Argentina: oito primeiros de cada grupo avançam.
  if (leagueId === "128") {
    if (pos <= 8) return "zone-promotion";
  }

  // Libertadores e Sul-Americana:
  if (leagueId === "13") {
    if (pos <= 2) return "zone-promotion";
    if (pos === 3) return "zone-preliminary";
  }

  if (leagueId === "11") {
    if (pos === 1) return "zone-promotion";
    if (pos === 2) return "zone-preliminary";
  }

  // Champions, Europa League e Conference League:
  if (["2", "3", "848"].includes(leagueId)) {
    if (pos <= 8) return "zone-direct";
    if (pos <= 24) return "zone-preliminary";
  }

  return "";
}


const HIGHLIGHTLY_LEAGUE_IDS = {
  "71": 61205,   // Brasileirão Série A
  "72": 62056,   // Brasileirão Série B
  "73": 62907,   // Copa do Brasil
  "39": 33973,   // Premier League
  "40": 34824,   // Championship
  "140": 119924, // La Liga
  "135": 115669, // Serie A - Itália
  "78": 67162,   // Bundesliga
  "61": 52695,   // Ligue 1
  "94": 80778,   // Primeira Liga
  "128": 109712, // Argentina
  "203": 173537, // Turquia
  "307": 262041, // Arábia Saudita
  "253": 216087, // MLS
  "13": 11847,   // Libertadores
  "11": 10145,   // Sul-Americana
  "2": 2486,     // Champions League
  "3": 3337,     // Europa League
  "848": 722432, // Conference League
  "1": 1635      // Copa do Mundo
};

const NATIONAL_CUP_IDS = new Set(["73", "130", "45", "143", "137", "81", "66", "96", "206", "504", "257"]);
const CONTINENTAL_KNOCKOUT_IDS = new Set(["13", "11", "2", "3", "848"]);

// Campeonatos que devem exibir somente a temporada atual.
const LEAGUES_SEASON_2026 = new Set([
  "71",  // Brasileirão Série A
  "72",  // Brasileirão Série B
  "73",  // Copa do Brasil
  "130", // Copa Argentina
  "253", // MLS
  "257", // US Open Cup
  "128", // Liga Argentina
  "13",  // Libertadores
  "11"   // Sul-Americana
]);

async function loadStandings() {
  if (!standingsBody || !leagueSelect) return;

  const leagueId = leagueSelect.value;
  const highlightlyLeagueId = HIGHLIGHTLY_LEAGUE_IDS[leagueId];

  // Season IDs follow their starting year; deriving them avoids the table
  // silently staying on a stale season after the calendar rolls over.
  const currentSeason = new Date().getFullYear();
  const seasonApiFootball = currentSeason;
  const seasonHighlightly = currentSeason;

  const seasonLabel = LEAGUES_SEASON_2026.has(leagueId)
    ? String(currentSeason)
    : `${currentSeason}–${String(currentSeason + 1).slice(-2)}`;

  renderChampionshipStatistics(null, seasonLabel, "Consultando os dados do campeonato selecionado...");
  const tableTitle = standingsBody.closest(".table-panel")?.querySelector(".section-heading h2");
  if (tableTitle) tableTitle.textContent = NATIONAL_CUP_IDS.has(leagueId) ? "Fases e partidas" : "Classificação";
  standingsBody.innerHTML = `
    <tr><td colspan="10">Carregando classificação...</td></tr>
  `;

  standingsSeason.textContent = `Temporada ${seasonLabel}`;

  standingsStatus.textContent = highlightlyLeagueId
    ? "Consultando classificação na Highlightly..."
    : "Consultando classificação na API-Football...";

  try {
    let groups = [];
    let totalTeams = 0;
    let source = "";

    if (NATIONAL_CUP_IDS.has(leagueId)) {
      standingsStatus.textContent = "Consultando jogos e fases da copa...";
      const response = await fetch(
        apiUrl(`/api/highlightly/cup-fixtures?cup=${encodeURIComponent(leagueId)}&season=${seasonHighlightly}`)
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao consultar as partidas da copa.");
      const fixtures = Array.isArray(data.response) ? data.response : [];
      renderCupFixtures(fixtures);
      renderCupStatistics(fixtures, seasonLabel);
      standingsStatus.textContent = `Fases e resultados recebidos da Highlightly • ${fixtures.length} partidas na temporada.`;
      return;
    } else if (highlightlyLeagueId) {
      // Consulta Highlightly
      const response = await fetch(
        apiUrl(`/api/highlightly/standings?leagueId=${highlightlyLeagueId}&season=${seasonHighlightly}`)
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Erro ao consultar a classificação na Highlightly."
        );
      }

      groups = (data.groups || [])
        .map(group => ({
          name: group.name || "",
          standings: group.standings || []
        }))
        .filter(group => group.standings.length > 0);

      if (groups.length === 0) {
        throw new Error(
          `A Highlightly não retornou classificação para este campeonato na temporada ${seasonLabel}.`);
      }

      source = "Highlightly";

    } else {
      // Alternativa: API-Football para campeonatos sem correspondência
      const response = await fetch(
        apiUrl(`/api/standings?league=${encodeURIComponent(leagueId)}&season=${seasonApiFootball}`)
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Erro ao consultar a classificação na API-Football."
        );
      }

      const standingsGroups = data.response?.[0]?.league?.standings;

      if (!Array.isArray(standingsGroups) || standingsGroups.length === 0) {
        throw new Error(
          "Não há classificação disponível para este campeonato."
        );
      }

      groups = standingsGroups
        .filter(group => Array.isArray(group) && group.length > 0)
        .map(group => ({
          name: group[0]?.group || "",
          standings: group,
          apiFootball: true
        }));

      source = "API-Football";
    }

    renderChampionshipStatistics(groups, seasonLabel);

    const showGroupHeaders = ["13", "11", "128", "253"].includes(leagueId);

    standingsBody.innerHTML = groups.map((group, index) => {
      let groupName = group.name ||
        `Grupo ${String.fromCharCode(65 + index)}`;

      // Padroniza os nomes dos quatro grupos da Liga Argentina.
      if (leagueId === "128") {
        const argentinaGroupNames = {
          "Apertura - Group A": "Apertura – Grupo A",
          "Apertura - Group B": "Apertura – Grupo B",
          "Clausura - Group A": "Clausura – Grupo A",
          "Clausura - Group B": "Clausura – Grupo B"
        };

        groupName = argentinaGroupNames[groupName] || groupName
          .replace("Group", "Grupo");
      }

      // Padroniza os nomes das conferências da MLS.
      if (leagueId === "253") {
        const mlsGroupNames = {
          "Major League Soccer - Eastern Conference": "Conferência Leste",
          "Major League Soccer - Western Conference": "Conferência Oeste"
        };

        groupName = mlsGroupNames[groupName] || groupName;
      }

      const groupHeader = showGroupHeaders
        ? `
          <tr class="standings-group-row">
            <td colspan="10">${escapeHTML(groupName)}</td>
          </tr>
        `
        : "";

      const teamRows = group.standings.map(team => {
        totalTeams++;

        let teamName;
        let logo;
        let rank;
        let points;
        let played;
        let wins;
        let draws;
        let losses;
        let goalsFor;
        let goalsAgainst;
        let goalDifference;

        if (group.apiFootball) {
          // Estrutura da API-Football
          const stats = team.all || {};
          const goals = stats.goals || {};

          teamName = team.team?.name || "Clube";
          logo = team.team?.logo || "";
          rank = team.rank ?? "—";
          points = team.points ?? 0;
          played = stats.played ?? 0;
          wins = stats.win ?? 0;
          draws = stats.draw ?? 0;
          losses = stats.lose ?? 0;
          goalsFor = goals.for ?? 0;
          goalsAgainst = goals.against ?? 0;
          goalDifference = team.goalsDiff ?? 0;

        } else {
          // Estrutura da Highlightly
          const stats = team.total || {};

          teamName = team.team?.name || "Clube";
          logo = team.team?.logo || "";
          rank = team.position ?? "—";
          points = team.points ?? 0;
          played = stats.games ?? 0;
          wins = stats.wins ?? 0;
          draws = stats.draws ?? 0;
          losses = stats.loses ?? 0;
          goalsFor = stats.scoredGoals ?? 0;
          goalsAgainst = stats.receivedGoals ?? 0;
          goalDifference = goalsFor - goalsAgainst;
        }

        const initials = teamName.slice(0, 3).toUpperCase();

        return `
          <tr>
            <td>
              <span class="position ${getClassificationZone(leagueId, rank)}">
                ${escapeHTML(String(rank))}
              </span>
            </td>
            <td>
              <div class="standing-team">
                ${logo
            ? `<img class="standing-logo" src="${escapeHTML(logo)}" alt="Escudo ${escapeHTML(teamName)}" loading="lazy">`
            : `<span class="team-icon">${escapeHTML(initials)}</span>`
          }
                <span>${escapeHTML(teamName)}</span>
              </div>
            </td>
            <td><strong>${points}</strong></td>
            <td>${played}</td>
            <td>${wins}</td>
            <td>${draws}</td>
            <td>${losses}</td>
            <td>${goalsFor}</td>
            <td>${goalsAgainst}</td>
            <td>${Number(goalDifference) > 0 ? "+" : ""}${goalDifference}</td>
          </tr>
        `;
      }).join("");

      return groupHeader + teamRows;
    }).join("");

    let knockoutNote = "";
    if (CONTINENTAL_KNOCKOUT_IDS.has(leagueId)) {
      try {
        standingsStatus.textContent = `Classificação recebida • buscando fases eliminatórias na Highlightly...`;
        const response = await fetch(
          apiUrl(`/api/highlightly/cup-fixtures?cup=${encodeURIComponent(leagueId)}&season=${seasonHighlightly}`)
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Falha ao consultar as fases eliminatórias.");
        const fixtures = Array.isArray(data.response) ? data.response : [];
        const knockoutFixtures = fixtures.filter(item => isKnockoutRound(item.round));
        const knockoutCount = renderCupFixtures(knockoutFixtures, true);
        knockoutNote = knockoutCount
          ? `${knockoutCount} partidas de mata-mata`
          : "mata-mata ainda sem partidas disponíveis";
      } catch {
        knockoutNote = "mata-mata indisponível no momento";
      }
    }

    standingsStatus.textContent =
      `Dados recebidos da ${source} • ${totalTeams} equipes na classificação.${knockoutNote ? ` • ${knockoutNote}` : ""}`;

  } catch (error) {
    renderChampionshipStatistics(null, seasonLabel, "Estatísticas indisponíveis para este campeonato.");
    standingsBody.innerHTML = `
      <tr>
        <td colspan="10">${escapeHTML(error.message)}</td>
      </tr>
    `;

    standingsStatus.textContent =
      "Não foi possível carregar a classificação.";
  }
}

// Fallback para escudos que não carregarem na classificação.
standingsBody?.addEventListener("error", event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) ||
    !image.classList.contains("standing-logo")) return;

  const fallback = document.createElement("span");
  fallback.className = "team-icon";
  fallback.textContent = image.alt.replace("Escudo ", "").slice(0, 3).toUpperCase();
  image.replaceWith(fallback);
}, true);

leagueSelect?.addEventListener("change", loadStandings);
loadStandings();
