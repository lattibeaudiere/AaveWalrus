// Explorer page functionality
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? window.location.origin 
    : 'https://defeyes-api.vercel.app';
let userTier = 'public'; // 'public', 'free', 'developer' (legacy: 'starter'), 'pro'
let apiKey = null;
let currentPage = 1;
let totalPages = 1;
let totalResults = 0;
let pageSize = 50;
let autoRefreshInterval = null;
let marketPulseInterval = null;
let marketPulseInsightInterval = null;
let explorerVolumeInterval = null;
let tickerDataInterval = null;
let autoRefreshEnabled = false;
let currentEvents = [];
let currentTier = 'public';

function getTopInsertAnchor() {
    return document.querySelector('.ticker-stack')
        || document.querySelector('.metric-ribbon');
}

function closeFilters() {
    const filtersContainer = document.getElementById('filters-container');
    const filterFab = document.getElementById('filter-fab');
    const filterBackdrop = document.getElementById('filter-backdrop');
    if (filtersContainer) {
        filtersContainer.classList.remove('expanded');
        if (isMobile()) {
            filtersContainer.style.removeProperty('top');
            filtersContainer.style.removeProperty('left');
            filtersContainer.style.removeProperty('right');
            filtersContainer.style.removeProperty('width');
        }
    }
    if (filterBackdrop) filterBackdrop.classList.remove('expanded');
    if (filterFab) {
        filterFab.setAttribute('aria-expanded', 'false');
    }
}

function positionFiltersPopover() {
    const filtersContainer = document.getElementById('filters-container');
    const filterFab = document.getElementById('filter-fab');
    if (!filtersContainer || !filterFab || !isMobile()) return;

    const rect = filterFab.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 32, 340);
    const left = Math.max(16, rect.right - width);
    const top = rect.bottom + 10;

    filtersContainer.style.width = `${width}px`;
    filtersContainer.style.left = `${left}px`;
    filtersContainer.style.right = 'auto';
    filtersContainer.style.top = `${top}px`;
}

function toggleFilters(forceState) {
    const filtersContainer = document.getElementById('filters-container');
    const filterFab = document.getElementById('filter-fab');
    const filterBackdrop = document.getElementById('filter-backdrop');
    if (!filtersContainer) return;

    const shouldOpen = typeof forceState === 'boolean'
        ? forceState
        : !filtersContainer.classList.contains('expanded');

    filtersContainer.classList.toggle('expanded', shouldOpen);
    if (filterBackdrop) {
        filterBackdrop.classList.toggle('expanded', shouldOpen);
    }
    if (filterFab) {
        filterFab.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }
    if (shouldOpen) {
        positionFiltersPopover();
    }
}

// Helper function to detect mobile viewport
function isMobile() {
    return window.innerWidth < 768;
}

// Theme
function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const themeIcon = document.getElementById('theme-icon');
    if (!themeIcon) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeIcon.innerHTML = isDark
        ? '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>'
        : '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1z"/>';
}

// Check user authentication and tier (with timeout to prevent page from hanging)
async function checkUserTier() {
    apiKey = localStorage.getItem('defeyes_api_key');
    if (!apiKey) {
        userTier = 'public';
        showApiKeyWarning('<strong>Sign up free</strong> for <strong>API access</strong>, <strong>wallet profiling</strong>, <strong>AI insights</strong>, <strong>APY data</strong>, and <strong>real-time webhooks</strong>. <a href="/payment" style="color: var(--frosted-mint); font-weight: 600; text-decoration: underline;">Sign up free →</a>');
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s max
        const response = await fetch(`${API_URL}/api/usage`, {
            headers: { 'X-API-Key': apiKey },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            userTier = data.customer.plan.toLowerCase() || 'free';
            // Update UI to show user is logged in
            updateUIForLoggedInUser();
            // Show/hide webhooks link based on plan
            toggleWebhooksLink(userTier === 'pro');
            clearApiKeyWarning();
        } else {
            userTier = 'public';
            localStorage.removeItem('defeyes_api_key');
            showApiKeyWarning('Your session may have expired. <a href="/payment" style="color: var(--frosted-mint); font-weight: 600; text-decoration: underline;">Sign in again</a> to restore APY data and full access.');
        }
    } catch (e) {
        userTier = 'public';
        toggleWebhooksLink(false);
        showApiKeyWarning('<strong>Sign up free</strong> for <strong>API access</strong>, <strong>wallet profiling</strong>, <strong>AI insights</strong>, <strong>APY data</strong>, and <strong>real-time webhooks</strong>. <a href="/payment" style="color: var(--frosted-mint); font-weight: 600; text-decoration: underline;">Sign up free →</a>');
    }
}

function toggleWebhooksLink(show) {
    const webhooksLink = document.getElementById('webhooks-nav-link');
    if (webhooksLink) {
        webhooksLink.style.display = show ? '' : 'none';
    }
}

function updateUIForLoggedInUser() {
    // Show upgrade prompt if free tier
    if (userTier === 'free' || userTier === 'public') {
        const upgradePrompt = document.createElement('div');
        upgradePrompt.id = 'upgrade-prompt';
        upgradePrompt.style.cssText = 'background: rgba(133, 208, 203, 0.1); border: 1px solid var(--frosted-mint); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;';
        upgradePrompt.innerHTML = `
            <p style="margin-bottom: 8px; color: var(--text-main);">
                <strong>Upgrade to see wallet addresses, APY data, and detailed token info</strong>
            </p>
            <a href="/upgrade" class="btn btn-primary" style="display: inline-block; margin-top: 8px;">Upgrade Plan</a>
        `;
        const container = document.querySelector('.container');
        const anchor = getTopInsertAnchor();
        if (container && anchor && anchor.parentNode === container) {
            anchor.insertAdjacentElement('afterend', upgradePrompt);
        } else if (container) {
            container.insertBefore(upgradePrompt, container.firstChild);
        }
    }
}

function showApiKeyWarning(message) {
    const existing = document.getElementById('api-key-warning');
    if (existing) {
        existing.innerHTML = message;
        return;
    }
    const warning = document.createElement('div');
    warning.id = 'api-key-warning';
    warning.style.cssText = 'background: rgba(133, 208, 203, 0.10); border-bottom: 1px solid rgba(133, 208, 203, 0.25); padding: 10px 18px; color: var(--text-main); text-align: center; font-size: 0.9rem; width: 100%; box-sizing: border-box;';
    warning.innerHTML = message;
    const header = document.querySelector('header.navbar');
    if (header) {
        header.insertAdjacentElement('afterend', warning);
    } else {
        document.body.insertBefore(warning, document.body.firstChild);
    }
}

function clearApiKeyWarning() {
    const existing = document.getElementById('api-key-warning');
    if (existing) {
        existing.remove();
    }
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatCompactUsd(value) {
    if (!Number.isFinite(value) || value <= 0) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: value >= 1000 ? 'compact' : 'standard',
        maximumFractionDigits: value >= 1000 ? 1 : 0
    }).format(value);
}

function getHeatLabel(heatIndex) {
    if (heatIndex >= 85) return 'Hot';
    if (heatIndex >= 65) return 'Active';
    if (heatIndex >= 45) return 'Steady';
    if (heatIndex >= 25) return 'Cooling';
    return 'Calm';
}

function getSentimentLabel(sentimentDeg) {
    if (sentimentDeg >= 55) return 'Supply';
    if (sentimentDeg >= 20) return 'Supply Tilt';
    if (sentimentDeg <= -55) return 'Borrow';
    if (sentimentDeg <= -20) return 'Borrow Tilt';
    return 'Balanced';
}

function getWhaleLabel(whaleRatio) {
    if (whaleRatio >= 0.7) return 'Whale Led';
    if (whaleRatio >= 0.55) return 'Whale Tilt';
    if (whaleRatio <= 0.3) return 'Retail Led';
    return 'Even Mix';
}

function getActionMixLeadLabel(shares = {}) {
    const entries = [
        ['Supply Lead', Number(shares.supply) || 0],
        ['Borrow Lead', Number(shares.borrow) || 0],
        ['Withdraw Lead', Number(shares.withdraw) || 0],
        ['Repay Lead', Number(shares.repay) || 0]
    ].sort((a, b) => b[1] - a[1]);
    if (!entries.length || entries[0][1] <= 0) return 'Balanced Mix';
    return entries[0][0];
}

function pickMetricVariant(options, seed) {
    if (!Array.isArray(options) || !options.length) return '';
    const safeSeed = Math.abs(Math.round(seed)) % options.length;
    return options[safeSeed];
}

function getHeatCaptionCopy(data = {}) {
    const currentEvents = Number(data.current_events) || 0;
    const baselineEvents = Number(data.baseline_events) || 0;
    const changePct = Number(data.change_vs_baseline_pct);
    const deltaPct = Number.isFinite(changePct)
        ? changePct
        : (baselineEvents > 0 ? ((currentEvents - baselineEvents) / baselineEvents) * 100 : 0);
    const seed = currentEvents + (baselineEvents * 3) + ((Number(data.heat_index) || 0) * 11);

    if (currentEvents <= 0 && baselineEvents <= 0) {
        return 'Activity is still warming up.';
    }
    if (deltaPct <= -35) {
        return pickMetricVariant([
            'Things feel quieter than usual.',
            'The market feels subdued today.',
            'Flow is coming in lighter today.',
            'Activity has cooled off a bit.'
        ], seed);
    }
    if (deltaPct <= -12) {
        return pickMetricVariant([
            'Below its usual pace right now.',
            'Flow looks a little softer now.',
            'The market feels a bit quieter.',
            'Things are moving more slowly.'
        ], seed);
    }
    if (deltaPct < 12) {
        return pickMetricVariant([
            'Activity is close to normal.',
            'The market is moving at a normal pace.',
            'Flow is near its usual rhythm.',
            'Things look fairly steady right now.'
        ], seed);
    }
    if (deltaPct < 35) {
        return pickMetricVariant([
            'Activity is starting to pick up.',
            'Flow is heating up a bit.',
            'The market feels busier than usual.',
            'Things are moving a little faster.'
        ], seed);
    }
    return pickMetricVariant([
        'Activity is surging right now.',
        'Flow is running especially hot.',
        'The market is moving unusually fast.',
        'Things are running at full speed.'
    ], seed);
}

function ensureActionMixBarMarkup() {
    const wrapper = document.querySelector('.actionmix-grid')?.closest('.metric-wrapper');
    if (!wrapper) return;
    if (wrapper.querySelector('.actionmix-bars')) return;

    const bars = document.createElement('div');
    bars.className = 'actionmix-bars';
    bars.innerHTML = ['supply', 'borrow', 'withdraw', 'repay'].map(action => {
        const label = action === 'withdraw' ? 'Withdraw' : action.charAt(0).toUpperCase() + action.slice(1);
        return `<div class="actionmix-bar-row">
            <span class="actionmix-bar-label">${label}</span>
            <div class="actionmix-bar-track">
                <div class="actionmix-bar-fill actionmix-bar-fill-${action}" id="${action}-bar-fill"></div>
            </div>
            <span class="actionmix-bar-pct" id="${action}-bar-pct">0%</span>
            <span class="actionmix-bar-vol" id="${action}-bar-vol">$0</span>
        </div>`;
    }).join('');
    wrapper.appendChild(bars);
}

function applyActionMixBars(mixShares, data) {
    ensureActionMixBarMarkup();

    ['supply', 'borrow', 'withdraw', 'repay'].forEach(action => {
        const fill = document.getElementById(`${action}-bar-fill`);
        const pct = document.getElementById(`${action}-bar-pct`);
        const vol = document.getElementById(`${action}-bar-vol`);
        const share = mixShares[action] || 0;
        const pctVal = Math.round(clamp(share * 100, 0, 100));
        if (fill) fill.style.width = `${Math.max(2, pctVal)}%`;
        if (pct) pct.textContent = `${pctVal}%`;
        const usdKey = `${action}_usd`;
        const usdVal = Number(data[usdKey]) || 0;
        if (vol) vol.textContent = formatCompactUsd(usdVal);
    });
}

function ensureActionMixGaugeMarkup() {
    const grid = document.querySelector('.actionmix-grid');
    if (!grid) return;
    const wrapper = grid.closest('.metric-wrapper');
    if (wrapper) {
        const title = wrapper.querySelector('#actionmix-value, .actionmix-title, .metric-kicker');
        if (title) title.textContent = 'Action Mix';
        const duplicateBottomLabel = wrapper.querySelector('.label-text');
        if (duplicateBottomLabel) duplicateBottomLabel.remove();
    }

    const supplyFill = document.getElementById('supply-mix-fill');
    const alreadyGauge = supplyFill && supplyFill.tagName && supplyFill.tagName.toLowerCase() === 'circle';
    if (alreadyGauge) return;

    grid.innerHTML = `
        <div class="actionmix-gauge">
            <div class="actionmix-ring">
                <svg class="actionmix-svg" viewBox="0 0 40 40" aria-hidden="true">
                    <circle class="actionmix-gauge-bg" cx="20" cy="20" r="15"></circle>
                    <circle class="actionmix-fill actionmix-fill-supply" id="supply-mix-fill" cx="20" cy="20" r="15"></circle>
                </svg>
                <span class="actionmix-pct actionmix-pct-supply" id="supply-mix-pct">0%</span>
            </div>
            <span class="actionmix-label">Supply</span>
        </div>
        <div class="actionmix-gauge">
            <div class="actionmix-ring">
                <svg class="actionmix-svg" viewBox="0 0 40 40" aria-hidden="true">
                    <circle class="actionmix-gauge-bg" cx="20" cy="20" r="15"></circle>
                    <circle class="actionmix-fill actionmix-fill-borrow" id="borrow-mix-fill" cx="20" cy="20" r="15"></circle>
                </svg>
                <span class="actionmix-pct actionmix-pct-borrow" id="borrow-mix-pct">0%</span>
            </div>
            <span class="actionmix-label">Borrow</span>
        </div>
        <div class="actionmix-gauge">
            <div class="actionmix-ring">
                <svg class="actionmix-svg" viewBox="0 0 40 40" aria-hidden="true">
                    <circle class="actionmix-gauge-bg" cx="20" cy="20" r="15"></circle>
                    <circle class="actionmix-fill actionmix-fill-withdraw" id="withdraw-mix-fill" cx="20" cy="20" r="15"></circle>
                </svg>
                <span class="actionmix-pct actionmix-pct-withdraw" id="withdraw-mix-pct">0%</span>
            </div>
            <span class="actionmix-label">Withdr</span>
        </div>
        <div class="actionmix-gauge">
            <div class="actionmix-ring">
                <svg class="actionmix-svg" viewBox="0 0 40 40" aria-hidden="true">
                    <circle class="actionmix-gauge-bg" cx="20" cy="20" r="15"></circle>
                    <circle class="actionmix-fill actionmix-fill-repay" id="repay-mix-fill" cx="20" cy="20" r="15"></circle>
                </svg>
                <span class="actionmix-pct actionmix-pct-repay" id="repay-mix-pct">0%</span>
            </div>
            <span class="actionmix-label">Repay</span>
        </div>
    `;

    const caption = document.getElementById('actionmix-caption');
    if (caption) caption.remove();
}

function applyMarketPulse(data = {}) {
    const heatIndex = clamp(Number(data.heat_index) || 0, 0, 100);
    const sentimentDeg = clamp(Number(data.sentiment_deg) || 0, -90, 90);
    ensureActionMixGaugeMarkup();

    const heatFill = document.getElementById('heat-fill');
    const heatValue = document.getElementById('heat-value');
    const heatCaption = document.getElementById('heat-caption');
    const sentimentNeedle = document.getElementById('sentiment-needle');
    const sentimentValue = document.getElementById('sentiment-value');
    const sentimentCaption = document.getElementById('sentiment-caption');
    const supplyMixFill = document.getElementById('supply-mix-fill');
    const borrowMixFill = document.getElementById('borrow-mix-fill');
    const withdrawMixFill = document.getElementById('withdraw-mix-fill');
    const repayMixFill = document.getElementById('repay-mix-fill');
    const supplyMixPct = document.getElementById('supply-mix-pct');
    const borrowMixPct = document.getElementById('borrow-mix-pct');
    const withdrawMixPct = document.getElementById('withdraw-mix-pct');
    const repayMixPct = document.getElementById('repay-mix-pct');

    if (heatFill) {
        heatFill.style.width = `${Math.max(8, heatIndex)}%`;
        heatFill.style.opacity = heatIndex < 12 ? '0.35' : '1';

        const t = heatIndex / 100;
        const cold = [133, 208, 203];
        const mid  = [251, 207, 127];
        const hot  = [240, 128, 100];
        let r, g, b;
        if (t <= 0.45) {
            r = cold[0]; g = cold[1]; b = cold[2];
        } else if (t <= 0.55) {
            const p = (t - 0.45) / 0.1;
            r = Math.round(cold[0] + (mid[0] - cold[0]) * p);
            g = Math.round(cold[1] + (mid[1] - cold[1]) * p);
            b = Math.round(cold[2] + (mid[2] - cold[2]) * p);
        } else {
            const p = (t - 0.55) / 0.45;
            r = Math.round(mid[0] + (hot[0] - mid[0]) * p);
            g = Math.round(mid[1] + (hot[1] - mid[1]) * p);
            b = Math.round(mid[2] + (hot[2] - mid[2]) * p);
        }
        const fillColor = `rgb(${r}, ${g}, ${b})`;
        const fadeColor = `rgba(${r}, ${g}, ${b}, 0.35)`;
        heatFill.style.setProperty('--thermo-bg', `linear-gradient(90deg, ${fillColor} 0%, ${fadeColor} 100%)`);
        heatFill.style.setProperty('--thermo-glow', `0 0 ${heatIndex >= 70 ? 24 : 16}px rgba(${r}, ${g}, ${b}, ${heatIndex >= 70 ? 0.9 : 0.45})`);
    }
    if (heatValue) heatValue.textContent = getHeatLabel(heatIndex);
    if (heatCaption) {
        const currentEvents = Number(data.current_events) || 0;
        const baselineEvents = Number(data.baseline_events) || 0;
        heatCaption.textContent = getHeatCaptionCopy(data);
        heatCaption.title = `${Math.round(currentEvents)} events in 4h vs ${Math.round(baselineEvents)} baseline`;
    }

    if (sentimentNeedle) {
        sentimentNeedle.style.transform = `rotate(${sentimentDeg}deg)`;
    }
    if (sentimentValue) sentimentValue.textContent = getSentimentLabel(sentimentDeg);
    if (sentimentCaption) {
        const supplyUsd = Number(data.supply_usd) || 0;
        const borrowUsd = Number(data.borrow_usd) || 0;
        if ((supplyUsd + borrowUsd) > 0) {
            const topFlow = supplyUsd >= borrowUsd
                ? `${formatCompactUsd(supplyUsd)} supply`
                : `${formatCompactUsd(borrowUsd)} borrow`;
            const bottomFlow = supplyUsd >= borrowUsd
                ? `${formatCompactUsd(borrowUsd)} borrow`
                : `${formatCompactUsd(supplyUsd)} supply`;
            sentimentCaption.textContent = `${topFlow}, ${bottomFlow}`;
        } else {
            sentimentCaption.textContent = 'No supply or borrow flow in the last 4h';
        }
    }

    const supplyEvents = Number(data.supply_events) || 0;
    const borrowEvents = Number(data.borrow_events) || 0;
    const withdrawEvents = Number(data.withdraw_events) || 0;
    const repayEvents = Number(data.repay_events) || 0;
    const actionTotalEvents = Number(data.action_total_events) || (supplyEvents + borrowEvents + withdrawEvents + repayEvents);
    const shareFrom = (shareValue, eventCount) => {
        const normalizedShare = Number(shareValue);
        if (Number.isFinite(normalizedShare)) return clamp(normalizedShare, 0, 1);
        if (actionTotalEvents > 0) return clamp(eventCount / actionTotalEvents, 0, 1);
        return 0;
    };
    const mixShares = {
        supply: shareFrom(data.supply_share, supplyEvents),
        borrow: shareFrom(data.borrow_share, borrowEvents),
        withdraw: shareFrom(data.withdraw_share, withdrawEvents),
        repay: shareFrom(data.repay_share, repayEvents)
    };
    const setMixGauge = (el, share) => {
        if (!el) return;
        const pct = clamp(share * 100, 0, 100);
        const circumference = 94.25;
        const offset = circumference - ((pct / 100) * circumference);
        if (!el.dataset.mixInit) {
            el.style.strokeDashoffset = circumference.toFixed(2);
            el.dataset.mixInit = '1';
            requestAnimationFrame(() => {
                el.style.strokeDashoffset = offset.toFixed(2);
            });
            return;
        }
        el.style.strokeDashoffset = offset.toFixed(2);
    };
    const setMixPct = (el, share) => {
        if (!el) return;
        el.textContent = `${Math.round(clamp(share * 100, 0, 100))}%`;
    };

    setMixGauge(supplyMixFill, mixShares.supply);
    setMixGauge(borrowMixFill, mixShares.borrow);
    setMixGauge(withdrawMixFill, mixShares.withdraw);
    setMixGauge(repayMixFill, mixShares.repay);
    setMixPct(supplyMixPct, mixShares.supply);
    setMixPct(borrowMixPct, mixShares.borrow);
    setMixPct(withdrawMixPct, mixShares.withdraw);
    setMixPct(repayMixPct, mixShares.repay);

    applyActionMixBars(mixShares, data);
}

async function loadMarketPulse() {
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 15000);
        const response = await fetch(`${API_URL}/api/v1/market-pulse`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!response.ok) throw new Error(`Pulse endpoint failed (${response.status})`);
        const data = await response.json();
        applyMarketPulse(data);
    } catch (e) {
        console.error('Failed to load market pulse', e);
        applyMarketPulse();
    }
}

function startMarketPulse() {
    loadMarketPulse();
    if (marketPulseInterval) clearInterval(marketPulseInterval);
    marketPulseInterval = setInterval(loadMarketPulse, 300000);
}

function sanitizeMarketPulseInsightForUi(data = {}) {
    return {
        ribbon_line: typeof data.ribbon_line === 'string' ? data.ribbon_line : '',
        headline: typeof data.headline === 'string' ? data.headline : '',
        confidence: Number(data.confidence),
        summary: typeof data.summary === 'string' ? data.summary : ''
    };
}

function applyMarketPulseInsight(data = {}) {
    const lineText = document.getElementById('market-pulse-insight-text');
    const lineContainer = document.getElementById('market-pulse-insight-line');
    const detailEl = document.getElementById('pulse-insight-detail');
    const toggleBtn = document.getElementById('pulse-insight-toggle');
    if (!lineText || !lineContainer) return;

    const fallbackText = 'Live interpretation is warming up.';
    const headline = typeof data.headline === 'string' ? data.headline.trim() : '';
    const ribbon = typeof data.ribbon_line === 'string' ? data.ribbon_line.trim() : '';
    lineText.textContent = headline || ribbon || fallbackText;

    const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
    if (detailEl) detailEl.textContent = summary;
    if (toggleBtn) toggleBtn.style.display = summary ? '' : 'none';
}

async function loadMarketPulseInsight() {
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 15000);
        const response = await fetch(`${API_URL}/api/v1/market-pulse-insight`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!response.ok) throw new Error(`Pulse insight failed (${response.status})`);
        const data = await response.json();
        applyMarketPulseInsight(sanitizeMarketPulseInsightForUi(data));
    } catch (e) {
        console.error('Failed to load pulse insight', e);
        applyMarketPulseInsight({ ribbon_line: 'Pulse insight is refreshing right now.' });
    }
}

function startMarketPulseInsight() {
    loadMarketPulseInsight();
    if (marketPulseInsightInterval) clearInterval(marketPulseInsightInterval);
    marketPulseInsightInterval = setInterval(loadMarketPulseInsight, 300000);

    const toggleBtn = document.getElementById('pulse-insight-toggle');
    const body = document.getElementById('pulse-insight-body');
    const ellipsis = document.getElementById('pulse-insight-ellipsis');
    const insightLine = document.getElementById('market-pulse-insight-line');
    if (toggleBtn && body) {
        toggleBtn.addEventListener('click', () => {
            const open = body.classList.toggle('expanded');
            if (insightLine) insightLine.classList.toggle('expanded', open);
            toggleBtn.textContent = open ? 'less' : 'more';
            if (ellipsis) ellipsis.classList.toggle('hidden', open);
        });
    }
}

function applyExplorerVolume(data = {}) {
    const volumeTitleEl = document.getElementById('volume-title');
    let volumeChange1hEl = document.getElementById('volume-change-1h');
    let volumeChange24hEl = document.getElementById('volume-change-24h');
    if (!volumeChange1hEl || !volumeChange24hEl) {
        const titleWrap = volumeTitleEl ? volumeTitleEl.closest('.table-title-wrap') : null;
        if (titleWrap && !titleWrap.querySelector('.volume-metrics')) {
            const metrics = document.createElement('div');
            metrics.className = 'volume-metrics';
            metrics.innerHTML = '<span class="volume-change" id="volume-change-1h">--</span><span class="volume-divider" aria-hidden="true">|</span><span class="volume-change" id="volume-change-24h">--</span>';
            titleWrap.appendChild(metrics);
            const legacy = document.getElementById('volume-change');
            if (legacy) legacy.remove();
            volumeChange1hEl = document.getElementById('volume-change-1h');
            volumeChange24hEl = document.getElementById('volume-change-24h');
        }
    }
    if (!volumeTitleEl || !volumeChange1hEl || !volumeChange24hEl) return;

    const volume24h = Number(data.volume_24h_usd);
    const changePct1h = Number(data.change_pct_1h);
    const changePct24h = Number(data.change_pct_24h);
    const hasVolume = Number.isFinite(volume24h) && volume24h > 0;
    volumeTitleEl.textContent = hasVolume ? `Vol. ${formatCompactUsd(volume24h)}` : 'Vol. --';

    const setDelta = (el, pct, label) => {
        el.classList.remove('volume-change-up', 'volume-change-down', 'volume-change-neutral');
        if (!Number.isFinite(pct)) {
            el.textContent = `-- ${label}`;
            el.classList.add('volume-change-neutral');
            return;
        }
        const rounded = Math.round(pct * 10) / 10;
        const prefix = rounded > 0 ? '+' : '';
        el.textContent = `${prefix}${rounded.toFixed(1)}% ${label}`;
        if (rounded > 0) el.classList.add('volume-change-up');
        else if (rounded < 0) el.classList.add('volume-change-down');
        else el.classList.add('volume-change-neutral');
    };

    setDelta(volumeChange1hEl, changePct1h, '1h');
    setDelta(volumeChange24hEl, changePct24h, '24h');
}

async function loadExplorerVolume() {
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 15000);
        const response = await fetch(`${API_URL}/api/v1/explorer-volume`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!response.ok) throw new Error(`Explorer volume failed (${response.status})`);
        const data = await response.json();
        applyExplorerVolume(data);
    } catch (e) {
        console.error('Failed to load explorer volume', e);
        applyExplorerVolume();
    }
}

function startExplorerVolume() {
    loadExplorerVolume();
    if (explorerVolumeInterval) clearInterval(explorerVolumeInterval);
    explorerVolumeInterval = setInterval(loadExplorerVolume, 300000);
}

function formatTickerPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '$0.00';
    if (num >= 1000) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2
        }).format(num);
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: num < 1 ? 4 : 2,
        maximumFractionDigits: num < 1 ? 6 : 2
    }).format(num);
}

function renderTickerTrack(trackEl, itemsHtml) {
    if (!trackEl) return;
    const hasRealContent = !!(itemsHtml && itemsHtml.trim());
    const content = hasRealContent
        ? itemsHtml
        : '<span class="ticker-item"><span class="ticker-dot"></span>No recent assets yet<span class="ticker-sep">*<\/span><\/span>';
    trackEl.innerHTML = `<div class="ticker-inner">${content}</div><div class="ticker-inner" aria-hidden="true">${content}</div>`;

    // The most important assets are first in the list. Restart the scroll
    // animation once real data arrives so the CSS animation-delay re-applies
    // from this moment — giving the user a few seconds to actually read the
    // leading items before they slide off-screen. (No effect on subsequent
    // refreshes since we only do this on the first real render.)
    if (hasRealContent && trackEl.dataset.firstRenderDone !== '1') {
        trackEl.dataset.firstRenderDone = '1';
        // Force the animation to restart by clearing then re-applying it.
        const previousInline = trackEl.style.animation;
        trackEl.style.animation = 'none';
        // Reading offsetWidth forces a reflow so the browser actually picks up
        // the change before we clear it.
        void trackEl.offsetWidth;
        trackEl.style.animation = previousInline || '';
    }
}

function initTickerDrag(trackEl) {
    if (!trackEl || trackEl.dataset.dragBound === '1') return;
    trackEl.dataset.dragBound = '1';
    let dragging = false;
    let startX = 0;
    let currentOffset = 0;
    let resumeTimer = null;

    const pointerX = (event) => {
        if (event.touches && event.touches[0]) return event.touches[0].clientX;
        return event.clientX;
    };

    const readCurrentTranslateX = () => {
        const transform = window.getComputedStyle(trackEl).transform;
        if (!transform || transform === 'none') return 0;
        const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
        if (matrix3d) {
            const values = matrix3d[1].split(',').map((v) => Number(v.trim()));
            return Number.isFinite(values[12]) ? values[12] : 0;
        }
        const matrix2d = transform.match(/^matrix\((.+)\)$/);
        if (matrix2d) {
            const values = matrix2d[1].split(',').map((v) => Number(v.trim()));
            return Number.isFinite(values[4]) ? values[4] : 0;
        }
        return 0;
    };

    const startDrag = (event) => {
        if (event.cancelable) event.preventDefault();
        dragging = true;
        currentOffset = readCurrentTranslateX();
        startX = pointerX(event);
        trackEl.style.animation = 'none';
        trackEl.style.transform = `translate3d(${currentOffset}px, 0, 0)`;
        trackEl.classList.add('is-paused');
        if (resumeTimer) {
            clearTimeout(resumeTimer);
            resumeTimer = null;
        }
    };

    const moveDrag = (event) => {
        if (!dragging) return;
        if (event.cancelable) event.preventDefault();
        const delta = pointerX(event) - startX;
        const nextOffset = currentOffset + delta;
        trackEl.style.transform = `translate3d(${nextOffset}px, 0, 0)`;
        startX = pointerX(event);
        currentOffset = nextOffset;
    };

    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        resumeTimer = setTimeout(() => {
            currentOffset = 0;
            trackEl.style.removeProperty('animation');
            trackEl.style.removeProperty('transform');
            trackEl.classList.remove('is-paused');
        }, 3000);
    };

    trackEl.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);
    trackEl.addEventListener('touchstart', startDrag, { passive: false });
    trackEl.addEventListener('touchmove', moveDrag, { passive: false });
    trackEl.addEventListener('touchend', endDrag);
    trackEl.addEventListener('touchcancel', endDrag);
}

function renderTickers(data = {}) {
    const apyTrack = document.getElementById('apy-ticker-track');
    const priceTrack = document.getElementById('price-ticker-track');
    if (!apyTrack || !priceTrack) return;

    const apys = Array.isArray(data.apys) ? data.apys : [];
    const prices = Array.isArray(data.prices) ? data.prices : [];

    const apyHtml = apys.slice(0, 40).map((entry) => {
        const symbol = String(entry.symbol || '').toUpperCase();
        const apy = Number(entry.apy_percent);
        if (!symbol || !Number.isFinite(apy)) return '';
        const trend = entry.trend;
        const cls = trend === 'up' ? 'apy-hot' : trend === 'down' ? 'apy-cool' : '';
        return `<span class="ticker-item ${cls}"><span class="ticker-dot"></span>${symbol} APY: ${apy.toFixed(2)}%<span class="ticker-sep">*</span></span>`;
    }).filter(Boolean).join('');

    const priceHtml = prices.slice(0, 40).map((entry) => {
        const symbol = String(entry.symbol || '').toUpperCase();
        const price = Number(entry.price_usd);
        if (!symbol || !Number.isFinite(price)) return '';
        const trend = entry.trend;
        const cls = trend === 'up' ? 'apy-hot' : trend === 'down' ? 'apy-cool' : '';
        return `<span class="ticker-item ${cls}"><span class="ticker-dot"></span>${symbol}: ${formatTickerPrice(price)}<span class="ticker-sep">*</span></span>`;
    }).filter(Boolean).join('');

    renderTickerTrack(apyTrack, apyHtml);
    renderTickerTrack(priceTrack, priceHtml);
    initTickerDrag(apyTrack);
    initTickerDrag(priceTrack);
}

async function loadTickerData() {
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 15000);
        const response = await fetch(`${API_URL}/api/v1/ticker-data`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!response.ok) throw new Error(`Ticker endpoint failed (${response.status})`);
        const data = await response.json();
        renderTickers(data);
    } catch (e) {
        console.error('Failed to load ticker data', e);
        renderTickers();
    }
}

function startTickerData() {
    loadTickerData();
    if (tickerDataInterval) clearInterval(tickerDataInterval);
    tickerDataInterval = setInterval(loadTickerData, 120000);
}

// Get favorite wallets from localStorage
function getFavoriteWallets() {
    const favorites = localStorage.getItem('defeyes_favorite_wallets');
    return favorites ? JSON.parse(favorites) : [];
}

// Load data
async function loadData() {
    const protocolEl = document.getElementById('filter-protocol');
    const actionEl = document.getElementById('filter-action');
    const walletEl = document.getElementById('filter-wallet');
    const filterTypeEl = document.getElementById('filter-type');
    const limitEl = document.getElementById('filter-limit');
    const timeRangeEl = document.getElementById('filter-time-range');
    
    if (!protocolEl || !actionEl || !walletEl || !limitEl || !timeRangeEl) return;
    
    const protocol = protocolEl.value;
    const action = actionEl.value;
    const wallet = walletEl.value;
    const filterType = filterTypeEl ? filterTypeEl.value : 'all';
    const limit = limitEl.value;
    const timeRange = timeRangeEl.value;

    const loadingEl = document.getElementById('loading');
    const tableWrapperEl = document.getElementById('table-wrapper');
    const resultCountEl = document.getElementById('result-count');
    
    if (!loadingEl || !tableWrapperEl || !resultCountEl) return;
    
    loadingEl.style.display = 'block';
    tableWrapperEl.style.display = 'none';
    resultCountEl.textContent = 'Loading...';

    try {
        // Use authenticated endpoint if user has API key (always attempt to show APY)
        let endpoint = '/api/explorer/events'; // Public endpoint
        let headers = {};
        
        if (apiKey) {
            // Use full events endpoint for authenticated users
            endpoint = '/api/events';
            headers['X-API-Key'] = apiKey;
        }

        // Set page size - ensure we get the requested amount (default 50 for pagination)
        const requestedLimit = parseInt(limit) || 50;
        // Use requested limit directly - API handles max limits based on user tier
        pageSize = requestedLimit;
        // Request the full page size - API will enforce tier limits
        const apiLimit = pageSize;
        
        // Debug: Log what we're requesting
        console.log(`Explorer: Requesting ${apiLimit} items (pageSize: ${pageSize}, limit dropdown: ${limit})`);
        
        // Calculate offset from current page
        const offset = (currentPage - 1) * pageSize;
        
        // Build query params - prioritize recent data
        let url = `${API_URL}${endpoint}?limit=${apiLimit}&offset=${offset}`;
        // Always send time_range param (server defaults to '24h' if missing, which breaks 'all')
        if (timeRange) url += `&time_range=${encodeURIComponent(timeRange)}`;
        if (protocol) url += `&protocol=${encodeURIComponent(protocol)}`;
        if (action) url += `&action_type=${encodeURIComponent(action)}`;
        
        // Wallet filter only for authenticated users
        if (wallet && (userTier === 'developer' || userTier === 'starter' || userTier === 'pro')) {
            url += `&wallet=${encodeURIComponent(wallet)}`;
        } else if (wallet) {
            // Show message that wallet filtering requires upgrade
            alert('Wallet address filtering requires Developer or Pro plan. Upgrade to unlock this feature.');
        }

        if (currentPage === 1 && !protocol && !action) url += '&fast=1';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        // First-paint shortcut: if the HTML preloaded the canonical first-page
        // request, consume it instead of issuing a duplicate fetch. This
        // overlaps the network round-trip with HTML/CSS/JS download.
        const canUsePreload = currentPage === 1
            && !protocol
            && !action
            && !apiKey
            && timeRange === '24h'
            && pageSize <= 50
            && !!window.__eventsPromise;

        let response;
        try {
            if (canUsePreload) {
                const preloaded = await window.__eventsPromise;
                window.__eventsPromise = null;
                if (preloaded) {
                    clearTimeout(timeoutId);
                    response = {
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        json: async () => preloaded
                    };
                }
            }
            if (!response) {
                response = await fetch(url, {
                    headers,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
            }
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            // If explorer endpoint fails, try public events endpoint as fallback
            if (endpoint === '/api/explorer/events' && !apiKey) {
                console.warn('Explorer endpoint failed, trying public events endpoint');
                const fallbackUrl = `${API_URL}/api/events?limit=${limit}`;
                const fallbackController = new AbortController();
                const fallbackTimeout = setTimeout(() => fallbackController.abort(), 15000);
                try {
                    response = await fetch(fallbackUrl, { 
                        signal: fallbackController.signal
                    });
                    clearTimeout(fallbackTimeout);
                } catch (fallbackError) {
                    clearTimeout(fallbackTimeout);
                    throw new Error('Unable to connect to API. Please check your connection.');
                }
            } else {
                throw new Error('Unable to connect to API. Please check your connection.');
            }
        }
        
        if (!response.ok) {
            if (response.status === 402) {
                // Payment required - show upgrade message
                const errorData = await response.json().catch(() => ({}));
                alert('This feature requires a subscription. ' + (errorData.message || 'Upgrade to access full data.'));
                loadingEl.style.display = 'none';
                tableWrapperEl.style.display = 'block';
                resultCountEl.textContent = 'Subscription required';
                renderTable([], userTier); // Show empty table
                return;
            }
            if (response.status === 401 || response.status === 403) {
                showApiKeyWarning('Your session was rejected. <a href="/payment" style="color: var(--frosted-mint); font-weight: 600; text-decoration: underline;">Sign in again</a> to access APY data.');
            }
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Handle different response formats
        let events = [];
        if (Array.isArray(data)) {
            events = data;
        } else if (data.data && Array.isArray(data.data)) {
            events = data.data;
        } else if (data.events && Array.isArray(data.events)) {
            events = data.events;
        } else if (data.results && Array.isArray(data.results)) {
            events = data.results;
        }
        
        // Filter events - but now allow pending enrichment events (they'll be marked as pending)
        // The API now returns pending events, so we just filter out RESERVE_DATA_UPDATED
        const filteredEvents = events.filter(event => {
            // Allow pending events (they'll be shown with "Enriching..." status)
            if (event.is_pending_enrichment || !event.action_type || event.action_type === 'UNKNOWN' || !event.protocol_name) {
                return true; // Show pending events
            }
            const action = (event.action_type || '').toUpperCase();
            // Filter out RESERVE_DATA_UPDATED (not a user action)
            return action !== 'RESERVE_DATA_UPDATED';
        });
        
        // Apply favorites filter if selected (client-side filtering)
        const filterTypeEl = document.getElementById('filter-type');
        const filterType = filterTypeEl ? filterTypeEl.value : 'all';
        if (filterType === 'favorites' && (userTier === 'developer' || userTier === 'starter' || userTier === 'pro')) {
            const favorites = getFavoriteWallets();
            if (favorites.length > 0) {
                const favoritesLower = favorites.map(f => f.toLowerCase());
                events = filteredEvents.filter(event => {
                    const eventWallet = (event.origin_user || '').toLowerCase();
                    return eventWallet && favoritesLower.includes(eventWallet);
                });
            } else {
                events = []; // No favorites, show empty
            }
        } else {
            events = filteredEvents;
        }
        
        // If we don't have enough events after filtering, we might need to request more
        // But for now, just limit to what we have (up to pageSize)
        const eventsToShow = events.slice(0, pageSize);
        
        // Extract pagination info (use original total from API, not filtered count)
        if (data.pagination) {
            totalResults = data.pagination.total || eventsToShow.length;
            totalPages = Math.ceil(totalResults / pageSize) || 1;
            console.log(`Pagination info from API:`, {
                total: data.pagination.total,
                limit: data.pagination.limit,
                offset: data.pagination.offset,
                total_pages: data.pagination.total_pages,
                has_more: data.pagination.has_more,
                calculatedTotalPages: totalPages
            });
        } else {
            // If no pagination info, estimate based on filtered results
            // But use the original API response count for better accuracy
            const originalCount = Array.isArray(data) ? data.length : 
                                 (data.data?.length || data.events?.length || data.results?.length || 0);
            totalResults = originalCount > 0 ? originalCount : eventsToShow.length;
            totalPages = Math.ceil(totalResults / pageSize) || 1;
            console.log(`No pagination info from API, using fallback:`, {
                originalCount,
                totalResults,
                totalPages
            });
        }
        
        // Use the limited events for rendering
        events = eventsToShow;
        
        // Debug: Log what we got
        console.log(`Explorer: Received ${events.length} events after filtering (requested ${pageSize}, API returned ${Array.isArray(data) ? data.length : (data.data?.length || data.events?.length || data.results?.length || 0)})`);
        
        // Render table with events (even if empty)
        const tier = data.tier || data.userTier || userTier || 'public';
        renderTable(events, tier);
        
        // Update result count with pagination info
        const startResult = totalResults > 0 ? (currentPage - 1) * pageSize + 1 : 0;
        const endResult = Math.min(currentPage * pageSize, totalResults);
        let resultText = '';
        if (totalResults > 0) {
            resultText = `Showing <strong>${startResult}-${endResult}</strong> of <strong>${totalResults.toLocaleString()}</strong> result${totalResults !== 1 ? 's' : ''}`;
        } else {
            resultText = 'No results found';
        }
        if (tier === 'public') {
            resultText += ` • <a href="/payment" style="color: var(--frosted-mint); text-decoration: none;">Sign up</a> for full access`;
        }
        resultCountEl.innerHTML = resultText;
        
        // Render pagination
        renderPagination();
        
        // Update last updated time
        if (data.metadata && data.metadata.mostRecent) {
            updateLastUpdated(data.metadata.mostRecent);
        } else {
            updateLastUpdated(new Date().toISOString());
        }
        
        // Hide loading and show table
        loadingEl.style.display = 'none';
        tableWrapperEl.style.display = 'block';
        
    } catch (e) {
        console.error('Failed to load data', e);
        
        // Show error state but still display the table (with error message)
        loadingEl.style.display = 'none';
        tableWrapperEl.style.display = 'block';
        
        // Show error in result count
        resultCountEl.textContent = `Error loading data: ${e.message}`;
        
        // Render empty table with error message
        const tbody = document.getElementById('table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--error-red);">
                Failed to load data. Please check your connection and try again.
                <br><small style="color: var(--text-muted); margin-top: 8px; display: block;">Error: ${e.message}</small>
            </td></tr>`;
        }
    }
}

function updateLastUpdated(timestamp) {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (!lastUpdatedEl) return;
    if (!timestamp) {
        lastUpdatedEl.textContent = 'Just now';
        return;
    }
    
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now - updated;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
        lastUpdatedEl.textContent = 'Just now';
    } else if (diffMins < 60) {
        lastUpdatedEl.textContent = `${diffMins}m ago`;
    } else {
        const diffHours = Math.floor(diffMins / 60);
        lastUpdatedEl.textContent = `${diffHours}h ago`;
    }
}

// Render pagination controls
function renderPagination() {
    const paginationEl = document.getElementById('pagination');
    if (!paginationEl) return;
    
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})" aria-label="Previous page">‹ Previous</button>`;
    } else {
        html += `<button class="pagination-btn" disabled>‹ Previous</button>`;
    }
    
    // Page numbers (show up to 5 pages around current)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="pagination-btn pagination-btn-active">${i}</button>`;
        } else {
            html += `<button class="pagination-btn" onclick="goToPage(${i})">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
        html += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})" aria-label="Next page">Next ›</button>`;
    } else {
        html += `<button class="pagination-btn" disabled>Next ›</button>`;
    }
    
    html += '</div>';
    paginationEl.innerHTML = html;
}

// Go to specific page
function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadData();
    // Scroll to top of table
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Manual refresh function
function refreshData() {
    currentPage = 1; // Reset to first page on refresh to get newest data
    loadMarketPulse();
    loadMarketPulseInsight();
    loadData();
}

// Auto-refresh toggle function
function toggleAutoRefresh() {
    const toggle = document.getElementById('auto-refresh-toggle');
    if (!toggle) return;
    
    autoRefreshEnabled = toggle.checked;
    
    if (autoRefreshEnabled) {
        // Refresh every 30 seconds for more real-time updates
        autoRefreshInterval = setInterval(() => {
            currentPage = 1; // Always reset to page 1 on auto-refresh to show newest events
            loadData();
        }, 30000);
    } else {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
}

// Render table with tiered data
function renderTable(events, tier = 'public') {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    
    // Store current events and tier for re-rendering on resize
    currentEvents = events;
    currentTier = tier;
    
    tbody.innerHTML = '';

    if (!events || events.length === 0) {
        const colCount = tier === 'pro' ? 9 : (tier === 'developer' || tier === 'starter') ? 8 : 8;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 40px; color: var(--text-muted);">No events found</td></tr>`;
        return;
    }

    // Update table headers based on tier
    updateTableHeaders(tier);
    
    // Check if mobile for column reordering
    const mobile = isMobile();

    // Events are already filtered before being passed to renderTable
    events.forEach(event => {
        try {
            const row = document.createElement('tr');
            let txHash = event.ref_tx_hash || event.tx_hash || '-';
            if (txHash && typeof txHash === 'string' && txHash !== '-') {
                while (txHash.startsWith('0x0x')) {
                    txHash = txHash.substring(2);
                }
                if (txHash && !txHash.startsWith('0x') && /^[0-9a-fA-F]+$/.test(txHash)) {
                    txHash = '0x' + txHash;
                }
            }
            const shortTx = txHash.length > 16 ? txHash.slice(0, 8) + '...' + txHash.slice(-6) : txHash;

            let displayProtocolName = event.protocol_name || '-';
            if (displayProtocolName && displayProtocolName.includes(' + ')) {
                const protocols = displayProtocolName.split(' + ');
                const aaveNames = ['Aave V3 Pool', 'Aave V3', 'Aave', 'Aave Pool',
                                   'Aave Wrapped Token Gateway', 'Aave Wrapped Token Gateway V3',
                                   'Aave V3 WETH Gateway', 'Aave Pool Addresses Provider'];
                const nonAaveProtocols = protocols.filter(p => !aaveNames.includes(p.trim()));
                if (nonAaveProtocols.length > 0) {
                    displayProtocolName = nonAaveProtocols[0].trim();
                }
            }

            let walletCell = '<td class="mono truncate" style="color: var(--text-muted); font-size: 11px;"><a href="/payment" style="color: var(--frosted-mint);">Sign up</a> to view</td>';
            if (tier === 'developer' || tier === 'starter' || tier === 'pro') {
                const wallet = event.origin_user || '-';
                if (wallet && wallet !== '-') {
                    const favorites = JSON.parse(localStorage.getItem('defeyes_favorite_wallets') || '[]');
                    const isFavorite = favorites.includes(wallet.toLowerCase());
                    const favoriteStar = isFavorite ? '<span style="color: var(--muted-apricot); margin-right: 4px;">★</span>' : '';
                    const walletDisplay = formatWallet(wallet, tier === 'pro');
                    const walletUrl = `/wallet.html?address=${encodeURIComponent(wallet)}`;
                    walletCell = `<td class="mono truncate">${favoriteStar}<a href="${walletUrl}" style="color: var(--frosted-mint); text-decoration: none;" title="View wallet: ${wallet}" class="tx-link">${walletDisplay}</a></td>`;
                } else {
                    walletCell = `<td class="mono truncate">-</td>`;
                }
            }

            let apyCell = '';
            if (tier === 'pro') {
                apyCell = event.apy_percent
                    ? `<td class="mono" style="color: var(--frosted-mint); font-weight: 600;">${event.apy_percent.toFixed(2)}%</td>`
                    : '<td style="color: var(--text-muted); font-size: 11px;">-</td>';
            } else {
                apyCell = '<td style="color: var(--text-muted); font-size: 11px;"><a href="/upgrade" style="color: var(--frosted-mint);">Pro</a> only</td>';
            }

            const gasInfo = formatGasInfo(event);
            const valueDisplay = formatTokenValue(event);
            const statusDisplay = formatTxStatus(event);

            const txHashCell = `<td class="mono"><a href="/tx/${txHash}?from=explorer" class="tx-link" title="${txHash}">${shortTx}</a>${statusDisplay}</td>`;
            const protocolCell = `<td class="truncate" title="${displayProtocolName}">${displayProtocolName}</td>`;
            const actionCell = `<td>${getBadge(event.action_type)}</td>`;
            const valueCell = `<td class="mono" style="line-height: 1.4;">${valueDisplay}</td>`;
            const gasCell = `<td class="mono" style="font-size: 11px; line-height: 1.4;">${gasInfo}</td>`;
            const blockCell = `<td class="mono">${event.block_number || '-'}</td>`;
            const timeCell = `<td class="mono" style="font-size: 11px; color: var(--text-muted);">${formatTimestamp(event.event_timestamp)}</td>`;

            if (mobile) {
                row.innerHTML = protocolCell + actionCell + valueCell + walletCell + txHashCell + apyCell + gasCell + blockCell + timeCell;
            } else {
                row.innerHTML = txHashCell + protocolCell + actionCell + walletCell + valueCell + apyCell + gasCell + blockCell + timeCell;
            }
            tbody.appendChild(row);
        } catch (err) {
            console.error('Explorer: Error rendering row', event?.ref_tx_hash, err);
        }
    });
}

function updateTableHeaders(tier) {
    const thead = document.querySelector('table thead tr');
    if (!thead) return;
    
    const mobile = isMobile();
    
    if (mobile) {
        // Mobile order: Protocol → Action → Value → Wallet → TX Hash → APY → Gas → Block → Time
        thead.innerHTML = `
            <th>Protocol</th>
            <th>Action</th>
            <th>Value</th>
            <th>Wallet</th>
            <th>TX Hash</th>
            <th>APY</th>
            <th>Gas</th>
            <th>Block</th>
            <th>Time</th>
        `;
    } else {
        // Desktop order: TX Hash → Protocol → Action → Wallet → Value → APY → Gas → Block → Time
        if (tier === 'pro') {
            thead.innerHTML = `
                <th>TX Hash</th>
                <th>Protocol</th>
                <th>Action</th>
                <th>Wallet</th>
                <th>Value</th>
                <th>APY</th>
                <th>Gas</th>
                <th>Block</th>
                <th>Time</th>
            `;
        } else {
            // Developer (legacy Starter) and Public have same columns (APY shows "Pro only")
            thead.innerHTML = `
                <th>TX Hash</th>
                <th>Protocol</th>
                <th>Action</th>
                <th>Wallet</th>
                <th>Value</th>
                <th>APY</th>
                <th>Gas</th>
                <th>Block</th>
                <th>Time</th>
            `;
        }
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    // Format: "Jan 8, 2:12 PM EST" - ALWAYS show in EST for consistency
    // Show seconds for recent events (within last hour) to show differences
    const now = new Date();
    const diff = now - date;
    const oneHour = 60 * 60 * 1000;
    
    if (diff < oneHour) {
        // Recent events: show seconds in EST
        return date.toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }) + ' EST';
    } else {
        // Older events: show without seconds in EST
        return date.toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        }) + ' EST';
    }
}

function getBadge(action) {
    if (!action || action === 'UNKNOWN' || action === '') {
        return '<span class="badge badge-default">-</span>';
    }
    const map = {
        'DEPOSIT': 'deposit',         // Entry: simple deposit for yield
        'SUPPLY': 'supply',            // Legacy: same as DEPOSIT
        'DELEGATED_SUPPLY': 'supply',  // Supply via delegation / permissioned execution
        'BORROW': 'borrow',
        'DELEGATED_BORROW': 'borrow',
        'REPAY': 'repay',
        'DELEGATED_REPAY': 'repay',
        'WITHDRAW': 'withdraw',
        'DELEGATED_WITHDRAW': 'withdraw',
        'MERKLE_CLAIM': 'claim',
        'SWAP': 'swap',
        'FLASH_LOAN': 'swap',
        'LEVERAGE': 'leverage',        // Entry: leverage loop (borrow → swap → supply)
        'UNWIND': 'unwind',            // Exit: close/reduce position
        'DELEVERAGE': 'deleverage',    // Atomic yield-loop unwind (flashloan + Pendle exit + Aave repay)
        'COLLATERAL_SWAP': 'rebalance', // Aave aToken_A → aToken_B swap
        'BRIDGE': 'swap',              // Cross-chain bridge
        'RISK_ROTATION': 'rebalance',  // Multi-asset collateral pivot
        'REBALANCE': 'rebalance',      // Adjustment: debt swap, collateral shift
        'YIELD_STRATEGY': 'yield',     // Legacy: generic strategy
        'MINT': 'mint',
        'BURN': 'burn',
        'DERIVATIVES': 'derivatives',
        // Uniswap V3 LP Positions (NFT)
        'LP_MINT': 'lp',
        'LP_ADD': 'lp',
        'LP_REMOVE': 'lp',
        'LP_BURN': 'lp',
        'LIQUIDATION': 'default'
    };
    const cls = map[action] || 'default';
    const label =
        action === 'RISK_ROTATION' ? 'Risk Rotation'
        : action === 'DELEGATED_SUPPLY' ? 'Delegated Supply'
        : action === 'DELEGATED_BORROW' ? 'Delegated Borrow'
        : action === 'DELEGATED_REPAY' ? 'Delegated Repay'
        : action === 'DELEGATED_WITHDRAW' ? 'Delegated Withdraw'
        : action === 'MERKLE_CLAIM' ? 'Merkle Claim'
        : action === 'LP_MINT' ? 'LP Mint'
        : action === 'LP_ADD' ? 'LP Add'
        : action === 'LP_REMOVE' ? 'LP Remove'
        : action === 'LP_BURN' ? 'LP Burn'
        : action;
    return `<span class="badge badge-${cls}">${label}</span>`;
}

function formatWallet(addr, showFull = false) {
    if (!addr || addr === '-') return '-';
    if (showFull) return addr;
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatEth(value) {
    if (!value || value === 0 || isNaN(value)) return '-';
    const ethValue = parseFloat(value);
    if (ethValue < 0.0001) {
        return '<0.0001 ETH';
    }
    return ethValue.toFixed(4) + ' ETH';
}

function formatTokenValue(event) {
    const outLegs = Array.isArray(event?.swap_pair?.token_outs) ? event.swap_pair.token_outs : [];

    // Priority 1: Show token_in if available (for swaps, supplies, etc.)
    if (event.token_in_amount && event.token_in_symbol) {
        const amount = parseFloat(event.token_in_amount);
        if (!isNaN(amount) && amount > 0) {
            const symbol = event.token_in_symbol.toUpperCase();
            
            // For swaps and unwinds, show enhanced details with better formatting
            if (outLegs.length > 1 && event.action_type === 'RISK_ROTATION') {
                const lines = outLegs
                    .filter(x => x && x.symbol && x.amount)
                    .slice(0, 3)
                    .map(x => `<div><strong>${formatAmount(parseFloat(x.amount))}</strong> <span style="color: var(--text-muted);">${String(x.symbol).toUpperCase()}</span></div>`)
                    .join('');
                return `<div style="display: flex; flex-direction: column; gap: 2px;">
                    <div><strong>${formatAmount(amount)}</strong> <span style="color: var(--text-muted);">${symbol}</span></div>
                    <div style="color: var(--text-muted); font-size: 10px;">↓</div>
                    ${lines}
                </div>`;
            }

            if (event.token_out_amount && event.token_out_symbol && (event.action_type === 'SWAP' || event.action_type === 'UNWIND' || event.action_type === 'LEVERAGE' || event.action_type === 'REBALANCE' || event.action_type === 'COLLATERAL_SWAP' || event.action_type === 'DELEVERAGE')) {
                const outAmount = parseFloat(event.token_out_amount);
                if (!isNaN(outAmount) && outAmount > 0) {
                    const outSymbol = event.token_out_symbol.toUpperCase();
                    // Enhanced swap display with better visual separation
                    return `<div style="display: flex; flex-direction: column; gap: 2px;">
                        <div><strong>${formatAmount(amount)}</strong> <span style="color: var(--text-muted);">${symbol}</span></div>
                        <div style="color: var(--text-muted); font-size: 10px;">↓</div>
                        <div><strong>${formatAmount(outAmount)}</strong> <span style="color: var(--text-muted);">${outSymbol}</span></div>
                    </div>`;
                }
            }
            
            return `${formatAmount(amount)} ${symbol}`;
        }
    }
    
    // Priority 2: Show token_out if available
    if (event.token_out_amount && event.token_out_symbol) {
        const amount = parseFloat(event.token_out_amount);
        if (!isNaN(amount) && amount > 0) {
            const symbol = event.token_out_symbol.toUpperCase();
            return `${formatAmount(amount)} ${symbol}`;
        }
    }
    
    // Priority 3: Show asset_symbol if available (from enrichment)
    if (event.asset_symbol) {
        const symbol = event.asset_symbol.toUpperCase();
        // Try to get amount from value_eth if available
        if (event.value_eth && parseFloat(event.value_eth) > 0) {
            return `${formatAmount(parseFloat(event.value_eth))} ${symbol}`;
        }
        return symbol; // Just show symbol if no amount
    }
    
    // Priority 4: Show value_eth if available (even if small)
    if (event.value_eth !== null && event.value_eth !== undefined) {
        const ethValue = parseFloat(event.value_eth);
        if (!isNaN(ethValue) && ethValue > 0) {
            return formatEth(ethValue);
        }
    }
    
    // Priority 5: When value_eth is 0, no native ETH was sent — value moved in ERC-20 tokens
    // Show a clear hint so users know why "value" is empty (same as block explorers)
    if (event.value_eth === 0 || event.value_eth === null || event.value_eth === undefined) {
        if (event.action_type) {
            return `<span style="color: var(--text-muted); font-size: 11px;" title="No native ETH sent; value moved in tokens">${event.action_type} · 0 ETH</span>`;
        }
        return `<span style="color: var(--text-muted); font-size: 11px;" title="Value was in token transfers, not native ETH">0 ETH</span>`;
    }
    
    return '-';
}

function formatAmount(amount) {
    if (!amount || isNaN(amount)) return '0';
    const num = parseFloat(amount);
    
    // Format based on magnitude
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    } else if (num >= 1) {
        return num.toFixed(2);
    } else if (num >= 0.01) {
        return num.toFixed(4);
    } else if (num >= 0.0001) {
        return num.toFixed(6);
    } else {
        return '<0.0001';
    }
}

// Format gas information with price and cost
function formatGasInfo(event) {
    const parts = [];
    
    // Gas used
    if (event.gas_used) {
        const gasUsed = parseInt(event.gas_used);
        parts.push(`<div><strong>${gasUsed.toLocaleString()}</strong> <span style="color: var(--text-muted); font-size: 10px;">gas</span></div>`);
    }
    
    // Gas price in Gwei
    if (event.gas_price_gwei) {
        const gasPrice = parseFloat(event.gas_price_gwei);
        if (!isNaN(gasPrice) && gasPrice > 0) {
            parts.push(`<div style="color: var(--text-muted); font-size: 10px;">${gasPrice.toFixed(2)} Gwei</div>`);
        }
    }
    
    // Transaction cost in ETH
    if (event.tx_cost_eth) {
        const txCost = parseFloat(event.tx_cost_eth);
        if (!isNaN(txCost) && txCost > 0) {
            parts.push(`<div style="color: var(--frosted-mint); font-size: 10px; margin-top: 2px;">${formatEth(txCost)}</div>`);
        }
    }
    
    if (parts.length === 0) {
        return '-';
    }
    
    return parts.join('');
}

// Format transaction status
function formatTxStatus(event) {
    if (!event.tx_status) return '';
    
    const status = event.tx_status.toLowerCase();
    if (status === 'success' || status === '1') {
        return '';
    } else if (status === 'failed' || status === '0' || status === 'reverted') {
        return '<span style="display: inline-block; width: 6px; height: 6px; background: var(--error-red); border-radius: 50%; margin-left: 6px;" title="Failed"></span>';
    }
    
    return '';
}

// Sample data fallback
function renderSampleData() {
    const sampleEvents = [
        { ref_tx_hash: '0x1234567890abcdef1234567890abcdef12345678', protocol_name: 'Aave V3 Pool', action_type: 'SUPPLY', origin_user: '0xabcdef1234567890abcdef1234567890abcdef12', value_eth: 1.5, gas_used: 150000, block_number: 418000000 },
        { ref_tx_hash: '0xabcdef1234567890abcdef1234567890abcdef12', protocol_name: 'Aave V3 Pool', action_type: 'BORROW', origin_user: '0x1234567890abcdef1234567890abcdef12345678', value_eth: 0.8, gas_used: 180000, block_number: 417999999 },
        { ref_tx_hash: '0x9876543210fedcba9876543210fedcba98765432', protocol_name: 'CoW Protocol', action_type: 'SWAP', origin_user: '0xfedcba9876543210fedcba9876543210fedcba98', value_eth: 2.1, gas_used: 200000, block_number: 417999998 },
    ];
    renderTable(sampleEvents);
    const resultCount = document.getElementById('result-count');
    if (resultCount) {
        resultCount.textContent = 'Sample data (API unavailable)';
    }
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Check for wallet parameter in URL and pre-fill filter (legacy support)
    const urlParams = new URLSearchParams(window.location.search);
    const walletParam = urlParams.get('wallet');
    if (walletParam) {
        const walletEl = document.getElementById('filter-wallet');
        if (walletEl) {
            walletEl.value = walletParam;
            toggleFilters(true);
        }
    }
    
    // Read the API key synchronously from localStorage so loadData() picks the
    // authenticated endpoint on the very first call. The full /api/usage tier
    // check still runs in parallel for UI bits (signup banner, webhooks link),
    // but it no longer gates — or duplicates — the events fetch.
    apiKey = localStorage.getItem('defeyes_api_key');
    checkUserTier();

    // Start everything in parallel
    startTickerData();
    startMarketPulse();
    startMarketPulseInsight();
    loadData();

    // Load secondary data slightly after the critical content.
    // (loadProtocols() removed — the protocol dropdown is hard-coded in HTML
    //  and the /api/stats call it triggered runs four heavy aggregates.)
    setTimeout(() => { startExplorerVolume(); }, 300);
    
    // Attach event listeners for buttons (CSP compliance - no inline handlers)
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1; // Reset to first page on new search
            loadData();
            closeFilters();
        });
    }
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
    
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
        autoRefreshToggle.addEventListener('change', toggleAutoRefresh);
        // Auto-refresh is OFF by default - users can enable if needed
    }

    const filterFab = document.getElementById('filter-fab');
    if (filterFab) {
        filterFab.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleFilters();
        });
    }

    const filtersContainer = document.getElementById('filters-container');
    if (filtersContainer) {
        filtersContainer.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    const filterBackdrop = document.getElementById('filter-backdrop');
    if (filterBackdrop) {
        filterBackdrop.addEventListener('click', () => closeFilters());
    }

    document.addEventListener('click', (event) => {
        const target = event.target;
        const filterWrap = document.querySelector('.filter-popover-wrap');
        if (filterWrap && target instanceof Node && !filterWrap.contains(target)) {
            closeFilters();
        }
    });

    window.addEventListener('resize', () => {
        const filtersContainerEl = document.getElementById('filters-container');
        if (filtersContainerEl && filtersContainerEl.classList.contains('expanded')) {
            positionFiltersPopover();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeFilters();
        }
    });
});

// Re-render table on window resize to handle mobile/desktop column reordering
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (currentEvents.length > 0) {
            renderTable(currentEvents, currentTier);
        }
    }, 250); // Debounce resize events
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    if (marketPulseInterval) {
        clearInterval(marketPulseInterval);
    }
    if (marketPulseInsightInterval) {
        clearInterval(marketPulseInsightInterval);
    }
    if (tickerDataInterval) {
        clearInterval(tickerDataInterval);
    }
});
