// Global state
let currentFormat = "SEA";
let settingsData = null;
let webConfig = null;
let activityData = null;
let distributionsData = null;
let currentHeroData = null;
let currentHeroCards = []; // filtered lists
let draftCards = [];
let comparisonCards = [];

// Pagination states
let heroTablePageSize = 25;
let draftTablePageSize = 25;
let comparisonTablePageSize = 25;
let heroTablePage = 1;
let draftTablePage = 1;
let comparisonTablePage = 1;

// Unregister datalabels globally so it only shows where explicitly added
if (typeof ChartDataLabels !== 'undefined') {
    Chart.unregister(ChartDataLabels);
}

// Table sorting states (supporting multi-column sorts)
let heroTableSorts = [{ col: "pick_rate", dir: "desc" }];
let draftTableSorts = [{ col: "weighted_pick_rate", dir: "desc" }];
let comparisonTableSorts = [{ col: "weighted_pick_rate", dir: "desc" }];

// Filters state
let activeHeroFilter = "";
let activeComparisonTab = "shared";

// Chart instances
let heroPopularityChartInstance = null;
let activityChartInstance = null;
let heroPitchChartInstance = null;
let heroCostChartInstance = null;
let heroDefenseChartInstance = null;

// Tooltip positioning
const tooltipEl = document.getElementById("card-tooltip");
const tooltipImg = document.getElementById("tooltip-img");

// Initialize on DOM Load
document.addEventListener("DOMContentLoaded", async () => {
    setupPageNavigation();
    setupThemeToggle();
    await loadSettingsAndPopulateDropdown();
    setupFormatSelector();
    setupTableSorting();
    setupFilters();
    setupTooltips();

    // Load initial data
    loadFormatData(currentFormat);
});

// Single Page App Router
function setupPageNavigation() {
    const navButtons = document.querySelectorAll(".sidebar-nav .nav-btn");
    const sections = document.querySelectorAll(".page-section");
    const pageTitle = document.getElementById("page-title");

    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPage = btn.getAttribute("data-page");

            // Toggle nav states
            navButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Show target section, hide others
            sections.forEach(sec => {
                if (sec.id === `page-${targetPage}`) {
                    sec.style.display = "block";
                } else {
                    sec.style.display = "none";
                }
            });

            // Set header title
            pageTitle.textContent = btn.textContent.replace(/[^\w\s]/g, "").trim();

            // Fetch extra page specific data if needed
            onPageChange(targetPage);
        });
    });
}

// Fetch Page Data On Switch
function onPageChange(page) {
    if (page === "hero-analysis" && !activeHeroFilter && webConfig && webConfig.heroes.length > 0) {
        // Select first hero by default
        selectHero(webConfig.heroes[0]);
    } else if (page === "draft-analysis" && draftCards.length === 0) {
        loadDraftAnalysisData();
    } else if (page === "type-comparison" && comparisonCards.length === 0) {
        loadComparisonData(activeComparisonTab);
    }
}

// Theme handling
function setupThemeToggle() {
    const themeToggle = document.getElementById("theme-toggle");

    const setTheme = (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
        themeToggle.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
        // Re-render charts to update colors
        if (webConfig) {
            renderOverviewCharts();
        }
        if (currentHeroData) {
            renderHeroCharts();
        }
    };

    // Check saved theme or system preference
    const savedTheme = localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(savedTheme);

    themeToggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        setTheme(currentTheme === "dark" ? "light" : "dark");
    });
}

// Load settings.json and populate set-select dropdown
async function loadSettingsAndPopulateDropdown() {
    try {
        const resp = await fetch('./config/settings.json');
        if (!resp.ok) throw new Error("Could not load settings.json");
        settingsData = await resp.json();

        const selector = document.getElementById("set-select");
        selector.innerHTML = "";

        const setKeys = Object.keys(settingsData.sets);
        if (setKeys.length > 0) {
            currentFormat = setKeys[0]; // Set default format to the first one in settings
        }

        setKeys.forEach(setKey => {
            const setConfig = settingsData.sets[setKey];
            const option = document.createElement("option");
            option.value = setKey;
            option.textContent = `${setConfig.name} (${setKey})`;
            if (setKey === currentFormat) {
                option.selected = true;
            }
            selector.appendChild(option);
        });

        // Update the set badge
        const setLabel = selector.options[selector.selectedIndex].text;
        document.getElementById("set-badge").textContent = `Set: ${setLabel}`;
    } catch (err) {
        console.error('loadSettingsAndPopulateDropdown parsing failed, so it is impossible to initialize the data.');
    }
}

// Format Select handler
function setupFormatSelector() {
    const selector = document.getElementById("set-select");
    selector.addEventListener("change", (e) => {
        currentFormat = e.target.value;
        const setLabel = selector.options[selector.selectedIndex].text;
        document.getElementById("set-badge").textContent = `Set: ${setLabel}`;
        loadFormatData(currentFormat);
    });
}

// Core Data Loading for Selected Set/Format
async function loadFormatData(formatId) {
    const setPath = `./data/${formatId}/analysis/`;

    try {
        // Show loaders
        document.getElementById("stat-total-decks").textContent = "...";
        document.getElementById("stat-heroes-count").textContent = "...";
        document.getElementById("stat-last-updated").textContent = "...";

        // 1. Fetch web_config
        const configResp = await fetch(`${setPath}web_config.json`);
        if (!configResp.ok) throw new Error("Could not load set configuration.");
        webConfig = await configResp.json();

        // Populate stats
        document.getElementById("stat-total-decks").textContent = webConfig.total_decks;
        document.getElementById("stat-heroes-count").textContent = webConfig.heroes.length;

        const lastUpdated = new Date(webConfig.last_updated);
        document.getElementById("stat-last-updated").textContent = lastUpdated.toLocaleDateString() + ' ' + lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // 2. Fetch activity data
        const activityResp = await fetch(`${setPath}activity_over_time.json`);
        if (activityResp.ok) {
            activityData = await activityResp.json();
        } else {
            activityData = null;
        }

        // Setup Hero selectors for the Hero Analysis page
        setupHeroSelectorBar();

        // Render charts
        renderOverviewCharts();

        // Reset page states
        draftCards = [];
        comparisonCards = [];
        currentHeroData = null;
        activeHeroFilter = "";
        heroTablePage = 1;
        draftTablePage = 1;
        comparisonTablePage = 1;

        // Reset current active page data
        const activeNavBtn = document.querySelector(".sidebar-nav .nav-btn.active");
        if (activeNavBtn) {
            onPageChange(activeNavBtn.getAttribute("data-page"));
        }
    } catch (err) {
        console.error(err);
        alert(`Error loading set data: ${err.message}`);
    }
}

// Render Overview Charts
function renderOverviewCharts() {
    const theme = document.documentElement.getAttribute("data-theme");
    const textColor = theme === "dark" ? "#9ca3af" : "#4b5563";
    const gridColor = theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";

    // 1. Hero Popularity Chart
    const heroLabels = Object.keys(webConfig.hero_deck_counts);
    const heroCounts = heroLabels.map(label => webConfig.hero_deck_counts[label]);
    const heroColors = heroLabels.map(label => webConfig.hero_color[label]);

    if (heroPopularityChartInstance) {
        heroPopularityChartInstance.destroy();
    }

    const ctxPop = document.getElementById("heroPopularityChart").getContext("2d");
    heroPopularityChartInstance = new Chart(ctxPop, {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: heroLabels,
            datasets: [{
                data: heroCounts,
                backgroundColor: heroColors,
                borderColor: theme === 'dark' ? '#161d30' : '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, font: { family: 'Outfit', size: 12 } }
                },
                datalabels: {
                    color: '#ffffff',
                    font: { family: 'Outfit', weight: 'bold', size: 13 },
                    formatter: (value) => value
                }
            }
        }
    });

    // 2. Activity Chart
    if (activityChartInstance) {
        activityChartInstance.destroy();
    }

    const ctxAct = document.getElementById("activityChart").getContext("2d");
    if (!activityData) {
        ctxAct.canvas.style.display = "none";
        return;
    }
    ctxAct.canvas.style.display = "block";

    // We construct datasets from activityData
    const allDatesSet = new Set();

    heroLabels.forEach(h => {
        activityData[h].forEach(item => allDatesSet.add(item[0]));
    });

    const sortedDates = Array.from(allDatesSet).sort();

    const datasets = heroLabels.map((hero, idx) => {
        const dataMap = new Map(activityData[hero]);
        let cumulative = 0;
        const dataPoints = sortedDates.map(date => {
            cumulative += (dataMap.get(date) || 0);
            return cumulative;
        });

        return {
            label: hero,
            data: dataPoints,
            borderColor: heroColors[idx],
            backgroundColor: heroColors[idx] + '20',
            borderWidth: 2,
            tension: 0.3,
            fill: false
        };
    });

    activityChartInstance = new Chart(ctxAct, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, font: { family: 'Outfit' } }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Outfit' } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Outfit' }, stepSize: 1 }
                }
            }
        }
    });
}

// Hero List selector on Hero Analysis page
function setupHeroSelectorBar() {
    const bar = document.querySelector(".hero-selector-bar");
    bar.innerHTML = "";

    webConfig.heroes.forEach(hero => {
        const btn = document.createElement("button");
        btn.className = "hero-btn";
        btn.textContent = hero;
        btn.addEventListener("click", () => selectHero(hero));
        bar.appendChild(btn);
    });
}

// Selecting Hero Analysis
async function selectHero(heroName) {
    activeHeroFilter = heroName;

    // Toggle active classes
    const buttons = document.querySelectorAll(".hero-selector-bar .hero-btn");
    buttons.forEach(btn => {
        if (btn.textContent === heroName) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    const setPath = `./data/${currentFormat}/analysis/`;
    const heroFilename = `hero_${heroName.replace(/ /g, "_")}.json`;

    try {
        const resp = await fetch(`${setPath}${heroFilename}`);
        if (!resp.ok) throw new Error(`Could not load details for ${heroName}`);
        currentHeroData = await resp.json();

        // Show layout
        document.getElementById("hero-dashboard").style.display = "block";
        document.getElementById("hero-detail-name").textContent = `${heroName} Detailed Analysis`;
        document.getElementById("hero-deck-count").textContent = currentHeroData.deck_count;

        // Render charts & cards lists
        renderHeroCharts();
        renderCardTypeSummaries();

        // Initial cards load
        currentHeroCards = currentHeroData.cards;
        heroTablePage = 1;
        renderHeroCardsTable();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// Render Hero Charts
function renderHeroCharts() {
    const theme = document.documentElement.getAttribute("data-theme");
    const textColor = theme === "dark" ? "#9ca3af" : "#4b5563";
    const gridColor = theme === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";

    // Pitch Distribution
    if (heroPitchChartInstance) heroPitchChartInstance.destroy();
    const pitchData = currentHeroData.pitch_distribution;
    const pitchCtx = document.getElementById("heroPitchChart").getContext("2d");
    const pitchMap = {
        "1": "Red",
        "2": "Yellow",
        "3": "Blue",
    };
    heroPitchChartInstance = new Chart(pitchCtx, {
        type: 'bar',
        data: {
            labels: pitchData.map(p => pitchMap[p.pitch] || "None"),
            datasets: [{
                label: 'Avg per standard 30-card deck',
                data: pitchData.map(p => p.average_count),
                backgroundColor: ['#ef444499', '#f59e0b99', '#3b82f699'],
                borderColor: ['#ef4444', '#f59e0b', '#3b82f6'],
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { display: false } },
                y: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { color: gridColor } }
            }
        }
    });

    // Cost Distribution
    if (heroCostChartInstance) heroCostChartInstance.destroy();
    const costData = currentHeroData.cost_distribution;
    const costCtx = document.getElementById("heroCostChart").getContext("2d");
    heroCostChartInstance = new Chart(costCtx, {
        type: 'bar',
        data: {
            labels: costData.map(c => `Cost ${c.cost}`),
            datasets: [{
                label: 'Avg per standard 30-card deck',
                data: costData.map(c => c.average_count),
                backgroundColor: 'rgba(168, 85, 247, 0.65)',
                borderColor: '#a855f7',
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { display: false } },
                y: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { color: gridColor } }
            }
        }
    });

    // Defense Distribution
    if (heroDefenseChartInstance) heroDefenseChartInstance.destroy();
    const defData = currentHeroData.defense_distribution;
    const defCtx = document.getElementById("heroDefenseChart").getContext("2d");
    heroDefenseChartInstance = new Chart(defCtx, {
        type: 'bar',
        data: {
            labels: defData.map(d => `Def ${d.defense}`),
            datasets: [{
                label: 'Avg per standard 30-card deck',
                data: defData.map(d => d.average_count),
                backgroundColor: 'rgba(16, 185, 129, 0.65)',
                borderColor: '#10b981',
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { display: false } },
                y: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { color: gridColor } }
            }
        }
    });
}

// Render Card Type Makeup Boxes
function renderCardTypeSummaries() {
    const container = document.getElementById("type-summaries-container");
    container.innerHTML = "";

    const sums = currentHeroData.card_type_summaries;
    const labelMapping = {
        attack_action: "Attack Action",
        non_attack_action: "Non-Attack Action",
        attack_reaction: "Attack Reaction",
        defense_reaction: "Defense Reaction",
        block: "Block",
        instant: "Instant",
    };

    Object.keys(sums).forEach(key => {
        let label = labelMapping[key];
        if (!label && key.startsWith("class_")) {
            label = key.replace("class_", "") + " Cards";
        }
        if (!label) label = key;

        const box = document.createElement("div");
        box.className = "summary-type-box";
        box.innerHTML = `
            <div class="summary-type-title">${label}</div>
            <div class="summary-type-value">${sums[key].average_count}</div>
            <div class="summary-type-sub">${sums[key].total_count} Total Count</div>
        `;
        container.appendChild(box);
    });
}

// Filters implementation
function setupFilters() {
    // Search inputs
    const heroSearch = document.getElementById("hero-card-search");
    heroSearch.addEventListener("input", () => {
        heroTablePage = 1;
        renderHeroCardsTable();
    });

    const draftSearch = document.getElementById("draft-card-search");
    draftSearch.addEventListener("input", () => {
        draftTablePage = 1;
        renderDraftAnalysisTable();
    });

    const comparisonSearch = document.getElementById("comparison-card-search");
    comparisonSearch.addEventListener("input", () => {
        comparisonTablePage = 1;
        renderComparisonTable();
    });

    // Comparison Selector Tabs
    const compTabs = document.querySelectorAll(".type-comparison-selector-tabs .comparison-tab");
    compTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            compTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeComparisonTab = tab.getAttribute("data-type");

            const titles = {
                equipment: "Equipment Card Comparison",
                shared: "Shared Card Comparison (Non-Equipment)",
            };
            document.getElementById("comparison-table-title").textContent = titles[activeComparisonTab];

            comparisonTablePage = 1;
            loadComparisonData(activeComparisonTab);
        });
    });
}

// Render Hero Cards Table
function renderHeroCardsTable() {
    const tbody = document.getElementById("hero-cards-tbody");
    tbody.innerHTML = "";

    const searchQuery = document.getElementById("hero-card-search").value.trim();

    // Filter cards by search
    let cardsToShow = currentHeroCards;
    if (searchQuery) {
        cardsToShow = currentHeroCards.filter(card => matchSearchQuery(card, searchQuery));
    }

    // Sort
    cardsToShow.sort((a, b) => multiColumnCompare(a, b, heroTableSorts));

    const totalItems = cardsToShow.length;
    const effectivePageSize = heroTablePageSize === 0 ? totalItems : heroTablePageSize;
    const paginatedCards = cardsToShow.slice((heroTablePage - 1) * effectivePageSize, heroTablePage * effectivePageSize);

    if (paginatedCards.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">No cards match the search.</td></tr>`;
        renderPaginationControls("hero-cards-pagination", heroTablePage, totalItems, effectivePageSize, heroTablePageSize, (p) => {
            heroTablePage = p;
            renderHeroCardsTable();
        }, (size) => {
            heroTablePageSize = size;
            heroTablePage = 1;
            renderHeroCardsTable();
        });
        return;
    }

    paginatedCards.forEach(card => {
        const tr = document.createElement("tr");
        const rarityClass = `rarity-${card.rarity}`;

        tr.innerHTML = `
            <td>
                <a href="#" class="card-link" data-image="${card.image_url}">${card.name}</a>
            </td>
            <td>${card.average_count_per_deck.toFixed(3)}</td>
            <td>${card.average_count_per_normalized_deck.toFixed(3)}</td>
            <td style="font-weight: 600; color: var(--accent-hover);">${(card.pick_rate * 100).toFixed(1)}%</td>
            <td>${card.total_count}</td>
            <td><span class="${rarityClass}">${card.rarity}</span></td>
            <td>${card.types || '-'}</td>
            <td>${card.keywords || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPaginationControls("hero-cards-pagination", heroTablePage, totalItems, effectivePageSize, heroTablePageSize, (p) => {
        heroTablePage = p;
        renderHeroCardsTable();
    }, (size) => {
        heroTablePageSize = size;
        heroTablePage = 1;
        renderHeroCardsTable();
    });
}

// Load Draft Occurrence Table Data
async function loadDraftAnalysisData() {
    const setPath = `./data/${currentFormat}/analysis/`;

    try {
        const resp = await fetch(`${setPath}draft_file_analysis.json`);
        if (!resp.ok) throw new Error("Could not load draft file analysis.");
        draftCards = await resp.json();

        // Dynamically add draft columns to table header
        const theadTr = document.getElementById("draft-analysis-thead-tr");
        // Clear columns beyond fixed ones (Card Name, Weighted Pick Rate, Avg Pick Rate, Total Count, Avg/Deck)
        const fixedColsCount = 5;
        while (theadTr.cells.length > fixedColsCount) {
            theadTr.deleteCell(fixedColsCount);
        }

        // Identify draft average columns in the first item
        if (draftCards.length > 0) {
            const firstItem = draftCards[0];
            const draftColKeys = Object.keys(firstItem).filter(k => k.startsWith("draft_average_occurrence")).sort();

            draftColKeys.forEach((key, index) => {
                const th = document.createElement("th");
                th.textContent = `Draft V${index + 1} Avg`;
                th.setAttribute("data-sort", key);
                th.className = "sortable";
                theadTr.appendChild(th);
            });
        }

        // Setup sorting bindings for newly created columns
        setupTableSorting();

        renderDraftAnalysisTable();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// Render Draft Occurrence Table
function renderDraftAnalysisTable() {
    const tbody = document.getElementById("draft-analysis-tbody");
    tbody.innerHTML = "";

    const searchQuery = document.getElementById("draft-card-search").value.trim();
    let cardsToShow = draftCards;

    if (searchQuery) {
        cardsToShow = draftCards.filter(card => matchSearchQuery(card, searchQuery));
    }

    // Sort
    cardsToShow.sort((a, b) => multiColumnCompare(a, b, draftTableSorts));

    const totalItems = cardsToShow.length;
    const effectivePageSize = draftTablePageSize === 0 ? totalItems : draftTablePageSize;
    const paginatedCards = cardsToShow.slice((draftTablePage - 1) * effectivePageSize, draftTablePage * effectivePageSize);

    if (paginatedCards.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">No cards match the search.</td></tr>`;
        renderPaginationControls("draft-analysis-pagination", draftTablePage, totalItems, effectivePageSize, draftTablePageSize, (p) => {
            draftTablePage = p;
            renderDraftAnalysisTable();
        }, (size) => {
            draftTablePageSize = size;
            draftTablePage = 1;
            renderDraftAnalysisTable();
        });
        return;
    }

    // Get draft keys
    let draftColKeys = [];
    if (paginatedCards.length > 0) {
        draftColKeys = Object.keys(paginatedCards[0]).filter(k => k.startsWith("draft_average_occurrence")).sort();
    }

    paginatedCards.forEach(card => {
        const tr = document.createElement("tr");

        let draftColsHTML = "";
        draftColKeys.forEach(k => {
            draftColsHTML += `<td>${card[k] ? card[k].toFixed(3) : '0.000'}</td>`;
        });

        tr.innerHTML = `
            <td>
                <a href="#" class="card-link" data-image="${card.image_url}">${card.name}</a>
            </td>
            <td style="font-weight: 700; color: var(--accent-hover);">${(card.weighted_pick_rate * 100).toFixed(1)}%</td>
            <td>${(card.pick_rate * 100).toFixed(1)}%</td>
            <td>${card.total_count}</td>
            <td>${card.average_count_per_deck.toFixed(3)}</td>
            ${draftColsHTML}
        `;
        tbody.appendChild(tr);
    });

    renderPaginationControls("draft-analysis-pagination", draftTablePage, totalItems, effectivePageSize, draftTablePageSize, (p) => {
        draftTablePage = p;
        renderDraftAnalysisTable();
    }, (size) => {
        draftTablePageSize = size;
        draftTablePage = 1;
        renderDraftAnalysisTable();
    });
}

// Fetch Global Comparisons
async function loadComparisonData(tabId) {
    const setPath = `./data/${currentFormat}/analysis/`;
    const filename = `${tabId}_comparison.json`;

    try {
        const resp = await fetch(`${setPath}${filename}`);
        if (!resp.ok) throw new Error(`Could not load comparison data for ${tabId}`);
        comparisonCards = await resp.json();

        // Dynamically recreate table header to show all active heroes
        const theadTr = document.getElementById("comparison-thead-tr");
        const fixedColsCount = 5;
        while (theadTr.cells.length > fixedColsCount) {
            theadTr.deleteCell(fixedColsCount);
        }

        webConfig.heroes.forEach(hero => {
            const th = document.createElement("th");
            th.textContent = `${hero} Pick Rate`;
            th.setAttribute("data-sort", `${hero}_pick_rate`);
            th.className = "sortable";
            theadTr.appendChild(th);
        });

        setupTableSorting();
        renderComparisonTable();

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// Render Comparison Table
function renderComparisonTable() {
    const tbody = document.getElementById("comparison-tbody");
    tbody.innerHTML = "";

    const searchQuery = document.getElementById("comparison-card-search").value.trim();
    let cardsToShow = comparisonCards;

    if (searchQuery) {
        cardsToShow = comparisonCards.filter(card => matchSearchQuery(card, searchQuery));
    }

    // Sort
    cardsToShow.sort((a, b) => multiColumnCompare(a, b, comparisonTableSorts));

    const totalItems = cardsToShow.length;
    const effectivePageSize = comparisonTablePageSize === 0 ? totalItems : comparisonTablePageSize;
    const paginatedCards = cardsToShow.slice((comparisonTablePage - 1) * effectivePageSize, comparisonTablePage * effectivePageSize);

    if (paginatedCards.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">No cards match the search.</td></tr>`;
        renderPaginationControls("comparison-pagination", comparisonTablePage, totalItems, effectivePageSize, comparisonTablePageSize, (p) => {
            comparisonTablePage = p;
            renderComparisonTable();
        }, (size) => {
            comparisonTablePageSize = size;
            comparisonTablePage = 1;
            renderComparisonTable();
        });
        return;
    }

    paginatedCards.forEach(card => {
        const tr = document.createElement("tr");

        let heroColsHTML = "";
        webConfig.heroes.forEach(hero => {
            const rateKey = `${hero}_pick_rate`;
            const rate = card[rateKey] || 0;
            heroColsHTML += `<td style="font-weight: 500;">${(rate * 100).toFixed(1)}%</td>`;
        });

        tr.innerHTML = `
            <td>
                <a href="#" class="card-link" data-image="${card.image_url}">${card.name}</a>
            </td>
            <td style="font-weight: 700; color: var(--accent-hover);">${(card.weighted_pick_rate * 100).toFixed(1)}%</td>
            <td>${(card.pick_rate * 100).toFixed(1)}%</td>
            <td>${card.average_count.toFixed(3)}</td>
            <td>${card.total_count}</td>
            ${heroColsHTML}
        `;
        tbody.appendChild(tr);
    });

    renderPaginationControls("comparison-pagination", comparisonTablePage, totalItems, effectivePageSize, comparisonTablePageSize, (p) => {
        comparisonTablePage = p;
        renderComparisonTable();
    }, (size) => {
        comparisonTablePageSize = size;
        comparisonTablePage = 1;
        renderComparisonTable();
    });
}

// Table Sort Click Binder with Multi-column (Shift-click) support
function setupTableSorting() {
    const tables = ["hero-cards-table", "draft-analysis-table", "comparison-table"];

    tables.forEach(tableId => {
        const table = document.getElementById(tableId);
        if (!table) return;

        const headers = table.querySelectorAll("th.sortable");

        headers.forEach(th => {
            const newTh = th.cloneNode(true);
            th.parentNode.replaceChild(newTh, th);

            newTh.addEventListener("click", (e) => {
                const colKey = newTh.getAttribute("data-sort");

                let sorts = null;
                let renderFn = null;
                let pageResetFn = null;

                if (tableId === "hero-cards-table") {
                    sorts = heroTableSorts;
                    renderFn = renderHeroCardsTable;
                    pageResetFn = () => { heroTablePage = 1; };
                } else if (tableId === "draft-analysis-table") {
                    sorts = draftTableSorts;
                    renderFn = renderDraftAnalysisTable;
                    pageResetFn = () => { draftTablePage = 1; };
                } else if (tableId === "comparison-table") {
                    sorts = comparisonTableSorts;
                    renderFn = renderComparisonTable;
                    pageResetFn = () => { comparisonTablePage = 1; };
                }

                const isShift = e.shiftKey;

                if (isShift) {
                    // Multi-sort
                    const existingIdx = sorts.findIndex(s => s.col === colKey);
                    if (existingIdx !== -1) {
                        // Toggle direction
                        sorts[existingIdx].dir = sorts[existingIdx].dir === "asc" ? "desc" : "asc";
                    } else {
                        // Add to sorts
                        sorts.push({ col: colKey, dir: "desc" });
                    }
                } else {
                    // Single sort
                    const existing = sorts.find(s => s.col === colKey);
                    const dir = (sorts.length === 1 && existing) ? (existing.dir === "asc" ? "desc" : "asc") : "desc";
                    sorts.length = 0;
                    sorts.push({ col: colKey, dir: dir });
                }

                pageResetFn();
                updateSortHeaderIndicators(table, sorts);
                renderFn();
            });
        });

        let initialSorts = null;
        if (tableId === "hero-cards-table") initialSorts = heroTableSorts;
        else if (tableId === "draft-analysis-table") initialSorts = draftTableSorts;
        else if (tableId === "comparison-table") initialSorts = comparisonTableSorts;
        updateSortHeaderIndicators(table, initialSorts);
    });
}

// Update visual indicators for active sorts on table headers
function updateSortHeaderIndicators(table, sorts) {
    const headers = table.querySelectorAll("th.sortable");
    headers.forEach(h => {
        h.classList.remove("asc", "desc");
        const badge = h.querySelector(".sort-badge");
        if (badge) badge.remove();
    });

    sorts.forEach((sort, idx) => {
        const header = Array.from(headers).find(h => h.getAttribute("data-sort") === sort.col);
        if (header) {
            header.classList.add(sort.dir);
            if (sorts.length > 1) {
                const badge = document.createElement("span");
                badge.className = "sort-badge";
                badge.textContent = `${idx + 1}`;
                header.appendChild(badge);
            }
        }
    });
}

// Tooltips on Hover
function setupTooltips() {
    document.body.addEventListener("pointerover", (e) => {
        if (e.pointerType === "touch") return;

        const link = e.target.closest(".card-link");
        if (!link) return;

        showTooltip(link, e.clientX, e.clientY);
    });

    document.body.addEventListener("pointerout", (e) => {
        if (e.pointerType === "touch") return;

        const link = e.target.closest(".card-link");
        if (link) {
            tooltipEl.style.display = "none";
        }
    });

    document.body.addEventListener("click", (e) => {
        const link = e.target.closest(".card-link");

        if (!link) {
            tooltipEl.style.display = "none";
            return;
        }

        e.preventDefault();
        const isTouchClick = e.pointerType === "touch";

        if (isTouchClick) {
            if (tooltipEl.style.display === "block") {
                tooltipEl.style.display = "none";
            } else {
                const rect = link.getBoundingClientRect();
                showTooltip(link, rect.left, rect.bottom + 10);
            }
        }
    });

    function showTooltip(link, clientX, clientY) {
        const imageUrl = link.getAttribute("data-image");
        if (!imageUrl) return;

        tooltipImg.src = imageUrl;
        tooltipEl.style.display = "block";

        const tooltipWidth = 250;
        const tooltipHeight = 350;

        let x = clientX + 20;
        let y = clientY + 15;

        if (x + tooltipWidth > window.innerWidth) {
            x = clientX - tooltipWidth - 20;
        }
        if (y + tooltipHeight > window.innerHeight) {
            y = window.innerHeight - tooltipHeight - 20;
        }

        x = Math.max(10, x);
        y = Math.max(10, y);

        tooltipEl.style.left = `${x}px`;
        tooltipEl.style.top = `${y}px`;
    }
}

// Render dynamic pagination controls for a container
function renderPaginationControls(containerId, currentPage, totalItems, effectivePageSize, rawPageSize, onPageChangeCallback, onPageSizeChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

    // Build page size options
    const pageSizeOptions = [10, 25, 50, 0]; // 0 = All
    const pageSizeOptionsHTML = pageSizeOptions.map(size => {
        const label = size === 0 ? 'All' : size;
        const selected = rawPageSize === size ? 'selected' : '';
        return `<option value="${size}" ${selected}>${label}</option>`;
    }).join('');

    container.innerHTML = `
        <div class="pagination-left">
            <label class="pagination-size-label">Rows:
                <select class="pagination-size-select" id="${containerId}-size">${pageSizeOptionsHTML}</select>
            </label>
        </div>
        <div class="pagination-center">
            <button class="pagination-btn" id="${containerId}-first" ${currentPage === 1 ? 'disabled' : ''} title="First page">«</button>
            <button class="pagination-btn" id="${containerId}-prev" ${currentPage === 1 ? 'disabled' : ''} title="Previous page">‹</button>
            <span class="pagination-info">
                Page
                <input type="number" class="pagination-page-input" id="${containerId}-goto" value="${currentPage}" min="1" max="${totalPages}">
                of ${totalPages}
                <span class="pagination-total">(${totalItems} items)</span>
            </span>
            <button class="pagination-btn" id="${containerId}-next" ${currentPage === totalPages ? 'disabled' : ''} title="Next page">›</button>
            <button class="pagination-btn" id="${containerId}-last" ${currentPage === totalPages ? 'disabled' : ''} title="Last page">»</button>
        </div>
        <div class="pagination-right"></div>
    `;

    // Navigation button events
    document.getElementById(`${containerId}-first`).addEventListener("click", () => onPageChangeCallback(1));
    document.getElementById(`${containerId}-prev`).addEventListener("click", () => onPageChangeCallback(currentPage - 1));
    document.getElementById(`${containerId}-next`).addEventListener("click", () => onPageChangeCallback(currentPage + 1));
    document.getElementById(`${containerId}-last`).addEventListener("click", () => onPageChangeCallback(totalPages));

    // Go-to-page input
    const gotoInput = document.getElementById(`${containerId}-goto`);
    const handleGoto = () => {
        let target = parseInt(gotoInput.value, 10);
        if (isNaN(target) || target < 1) target = 1;
        if (target > totalPages) target = totalPages;
        onPageChangeCallback(target);
    };
    gotoInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleGoto();
        }
    });
    gotoInput.addEventListener("blur", handleGoto);

    // Page size selector
    document.getElementById(`${containerId}-size`).addEventListener("change", (e) => {
        const newSize = parseInt(e.target.value, 10);
        onPageSizeChangeCallback(newSize);
    });
}

// Advanced search parser supporting conjunctions (&) and exclusions (!)
function matchSearchQuery(card, queryStr) {
    if (!queryStr) return true;

    const terms = queryStr.split("&");

    for (let term of terms) {
        term = term.trim().toLowerCase();
        if (!term) continue;

        let isNegated = false;
        if (term.startsWith("!")) {
            isNegated = true;
            term = term.slice(1).trim();
            if (!term) continue;
        }

        const nameMatch = card.name && card.name.toLowerCase().includes(term);
        const typeMatch = card.types && card.types.toLowerCase().includes(term);
        const keywordMatch = card.keywords && card.keywords.toLowerCase().includes(term);
        const rarityMatch = card.rarity && card.rarity.toLowerCase().includes(term);

        const isMatch = nameMatch || typeMatch || keywordMatch || rarityMatch;

        if (isNegated) {
            if (isMatch) return false;
        } else {
            if (!isMatch) return false;
        }
    }

    return true;
}

// Generic multi-column compare function
function multiColumnCompare(a, b, sorts) {
    for (const sort of sorts) {
        let valA = a[sort.col];
        let valB = b[sort.col];

        if (typeof valA === "string") {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA !== valB) {
            if (valA < valB) return sort.dir === "asc" ? -1 : 1;
            if (valA > valB) return sort.dir === "asc" ? 1 : -1;
        }
    }
    return 0;
}
