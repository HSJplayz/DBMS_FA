// ═══════════════════════════════════════════════════════════════════════
// SpiceRoute — Features Extension
// Skeletons, Infinite Scroll, Recipe of Day, Card Preview, Ratings,
// Bookmarks, Spin the Wheel, Page Transitions
// ═══════════════════════════════════════════════════════════════════════

// ─── SKELETON HELPERS ────────────────────────────────────────────────────
function renderSkeletons(elementId, count = 6) {
    const grid = document.getElementById(elementId);
    if (!grid) return;
    grid.innerHTML = Array.from({ length: count }, () => `
    <div class="recipe-card skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <div class="skeleton-badge"></div>
          <div class="skeleton-badge"></div>
        </div>
        <div class="skeleton-line w80"></div>
        <div class="skeleton-line w60"></div>
      </div>
    </div>
  `).join('');
}

// ─── PAGE TRANSITIONS ────────────────────────────────────────────────────
document.addEventListener('click', function (e) {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('http')) return;
    if (href.endsWith('.html') && !href.includes(location.pathname.split('/').pop())) {
        e.preventDefault();
        document.body.classList.add('page-exit');
        setTimeout(() => { window.location.href = href; }, 250);
    }
});

// ─── INFINITE SCROLL STATE ──────────────────────────────────────────────
const infiniteState = {
    latest: { offset: 0, loading: false, hasMore: true, endpoint: '/latest-meals' },
    category: { offset: 0, loading: false, hasMore: true, endpoint: '', category: '' },
    ingredient: { offset: 0, loading: false, hasMore: true, endpoint: '', ingredient: '' },
    search: { offset: 0, loading: false, hasMore: true, endpoint: '', query: '' }
};

function createLoaderEl(id) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = 'infinite-loader';
    el.innerHTML = '<div class="infinite-spinner"></div>';
    return el;
}

// Override loadLatestMeals to use skeletons + infinite scroll
const _origLoadLatest = loadLatestMeals;
loadLatestMeals = async function () {
    const grid = document.getElementById('latestMealsGrid');
    renderSkeletons('latestMealsGrid', 6);

    infiniteState.latest.offset = 0;
    infiniteState.latest.hasMore = true;

    const data = await fetchData('/latest-meals?offset=0&limit=12');
    if (data && data.meals) {
        latestMealsCache = data.meals;
        infiniteState.latest.offset = data.offset || data.meals.length;
        infiniteState.latest.hasMore = data.has_more !== false;
        activeCuisineFilter = 'All';
        renderCuisineFilterBar();
        renderRecipeGrid('latestMealsGrid', data.meals);

        // Add loader sentinel
        if (infiniteState.latest.hasMore) {
            const loader = createLoaderEl('latestLoader');
            grid.parentNode.appendChild(loader);
        }
    }
};

// Override loadByCategory for skeletons + scroll
const _origLoadByCat = loadByCategory;
loadByCategory = async function (cat) {
    const grid = document.getElementById('categoryResults');
    renderSkeletons('categoryResults', 6);
    grid.scrollIntoView({ behavior: 'smooth' });

    infiniteState.category.category = cat;
    infiniteState.category.offset = 0;
    infiniteState.category.hasMore = true;

    const data = await fetchData(`/meals-by-category?category=${cat}&offset=0&limit=12`);
    if (data && data.meals) {
        infiniteState.category.offset = data.offset || data.meals.length;
        infiniteState.category.hasMore = data.has_more !== false;
        renderRecipeGrid('categoryResults', data.meals);

        if (infiniteState.category.hasMore) {
            const loader = createLoaderEl('categoryLoader');
            grid.parentNode.appendChild(loader);
        }
    }
};

// Override handleIngredientFilter
const _origIngFilter = handleIngredientFilter;
handleIngredientFilter = async function () {
    const val = document.getElementById('ingredientInput').value.trim();
    if (!val) return;
    const grid = document.getElementById('ingredientResults');
    renderSkeletons('ingredientResults', 6);
    grid.scrollIntoView({ behavior: 'smooth' });

    infiniteState.ingredient.ingredient = val;
    infiniteState.ingredient.offset = 0;
    infiniteState.ingredient.hasMore = true;

    const data = await fetchData(`/meals-by-ingredient?ingredient=${encodeURIComponent(val)}&offset=0&limit=12`);
    if (data && data.meals) {
        infiniteState.ingredient.offset = data.offset || data.meals.length;
        infiniteState.ingredient.hasMore = data.has_more !== false;
        renderRecipeGrid('ingredientResults', data.meals);
    }
};

// Override handleSearch
const _origSearch = handleSearch;
handleSearch = async function () {
    const q = document.getElementById('globalSearch').value.trim();
    if (!q) return;

    const grid = document.getElementById('latestMealsGrid');
    const heading = document.querySelector('#latest h2');
    if (heading) heading.innerText = `Search results for "${q}"`;
    grid.scrollIntoView({ behavior: 'smooth' });

    renderSkeletons('latestMealsGrid', 6);

    infiniteState.search.query = q;
    infiniteState.search.offset = 0;
    infiniteState.search.hasMore = true;

    const data = await fetchData(`/search?q=${encodeURIComponent(q)}&offset=0&limit=12`);
    if (data && data.meals) {
        infiniteState.search.offset = data.offset || data.meals.length;
        infiniteState.search.hasMore = data.has_more !== false;
        renderRecipeGrid('latestMealsGrid', data.meals);
    }
};

// Override loadRandomMeals for skeletons
const _origRandom = loadRandomMeals;
loadRandomMeals = async function () {
    renderSkeletons('randomMealsGrid', 4);
    const data = await fetchData('/random-meals');
    if (data && data.meals) {
        renderRecipeGrid('randomMealsGrid', data.meals);
    }
};

// Infinite scroll observer
const infiniteObserver = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;

        if (id === 'latestLoader' && infiniteState.latest.hasMore && !infiniteState.latest.loading) {
            infiniteState.latest.loading = true;
            const data = await fetchData(`/latest-meals?offset=${infiniteState.latest.offset}&limit=12`);
            if (data && data.meals && data.meals.length > 0) {
                infiniteState.latest.offset = data.offset || (infiniteState.latest.offset + data.meals.length);
                infiniteState.latest.hasMore = data.has_more !== false;
                const grid = document.getElementById('latestMealsGrid');
                grid.innerHTML += renderRecipeCards(data.meals);
            } else {
                infiniteState.latest.hasMore = false;
                entry.target.innerHTML = '<p class="load-end-msg">You\'ve seen it all! 🎉</p>';
            }
            infiniteState.latest.loading = false;
            if (!infiniteState.latest.hasMore) {
                infiniteObserver.unobserve(entry.target);
                entry.target.innerHTML = '<p class="load-end-msg">You\'ve seen it all! 🎉</p>';
            }
        }

        if (id === 'categoryLoader' && infiniteState.category.hasMore && !infiniteState.category.loading) {
            infiniteState.category.loading = true;
            const data = await fetchData(`/meals-by-category?category=${infiniteState.category.category}&offset=${infiniteState.category.offset}&limit=12`);
            if (data && data.meals && data.meals.length > 0) {
                infiniteState.category.offset = data.offset || (infiniteState.category.offset + data.meals.length);
                infiniteState.category.hasMore = data.has_more !== false;
                const grid = document.getElementById('categoryResults');
                grid.innerHTML += renderRecipeCards(data.meals);
            } else {
                infiniteState.category.hasMore = false;
            }
            infiniteState.category.loading = false;
            if (!infiniteState.category.hasMore) {
                infiniteObserver.unobserve(entry.target);
                entry.target.innerHTML = '<p class="load-end-msg">No more recipes 🍽️</p>';
            }
        }
    }
}, { rootMargin: '200px' });

// Observe loaders when they appear
const loaderObserverMO = new MutationObserver(() => {
    ['latestLoader', 'categoryLoader'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.observed) {
            el.dataset.observed = '1';
            infiniteObserver.observe(el);
        }
    });
});
loaderObserverMO.observe(document.body, { childList: true, subtree: true });

// Helper: render cards without replacing innerHTML (for appending)
function renderRecipeCards(meals) {
    return meals.map(m => {
        const theme = getRecipeTheme(m.name);
        const stepCount = m.step_count || 8;
        const diff = getDifficultyBadge(stepCount);
        const cuisine = getCuisineTag(m.name);
        const cardHeader = m.image_url
            ? `<div class="card-img-real" style="background-image: url('${m.image_url}')">
           <div class="card-img-overlay"></div>
         </div>`
            : `<div class="card-img-gradient" style="background: linear-gradient(${theme.grad})">
           <span class="card-emoji">${theme.emoji}</span>
         </div>`;
        return `
      <div class="recipe-card" onclick="openRecipeDetail(${m.id})">
        ${cardHeader}
        <div class="card-content">
          <div class="card-badges">
            <span class="badge ${diff.cls}">${diff.label}</span>
            <span class="badge badge-cuisine">${cuisine}</span>
          </div>
          <h3>${esc(m.name)}</h3>
          <div class="card-meta">
            <span>30-45 mins</span>
            <span>Medium Spice</span>
          </div>
        </div>
        <div class="card-preview-popup">
          <div class="preview-cuisine">${cuisine} Cuisine</div>
          <div class="preview-info">
            <span>🍳 ${stepCount} steps</span>
            <span>🥘 ${diff.label.replace(/🟢|🟡|🔴/, '').trim()}</span>
          </div>
        </div>
      </div>`;
    }).join('');
}


// ─── RECIPE OF THE DAY ──────────────────────────────────────────────────
async function loadRecipeOfTheDay() {
    const container = document.getElementById('rotdContainer');
    if (!container) return;
    try {
        const data = await fetchData('/recipe-of-the-day');
        if (!data || data.error) { container.style.display = 'none'; return; }

        const starsHtml = renderStarsDisplay(data.avg_stars || 0);
        container.innerHTML = `
      <div class="rotd-banner" onclick="openRecipeDetail(${data.id})">
        <img class="rotd-banner-img" src="${data.image_url}" alt="${esc(data.name)}"
             onerror="this.parentElement.style.display='none'">
        <div class="rotd-banner-overlay"></div>
        <div class="rotd-badge">🏆 Recipe of the Day</div>
        <div class="rotd-content">
          <h3>${esc(data.name)}</h3>
          <div class="rotd-meta">
            <span class="rotd-stars">${starsHtml}</span>
            <span>🥘 ${data.ingredient_count || '?'} ingredients</span>
            <span>💬 ${data.review_count || 0} reviews</span>
          </div>
        </div>
      </div>`;
        container.style.display = 'block';
    } catch (e) {
        container.style.display = 'none';
    }
}

function renderStarsDisplay(avg) {
    let html = '<span class="star-display">';
    for (let i = 1; i <= 5; i++) {
        html += `<span class="star ${i <= Math.round(avg) ? 'filled' : ''}">★</span>`;
    }
    html += '</span>';
    if (avg > 0) html += ` <span style="font-size:0.85rem;opacity:0.8">${avg}</span>`;
    return html;
}


// ─── RATINGS & REVIEWS (in Recipe Modal) ────────────────────────────────
async function loadRecipeReviews(recipeId) {
    const container = document.getElementById('reviewsSection');
    if (!container) return;
    try {
        const data = await fetchData(`/api/ratings/${recipeId}`);
        if (!data) return;

        const avgHtml = renderStarsDisplay(data.avg_stars);
        let reviewsHtml = '';
        if (data.reviews && data.reviews.length > 0) {
            reviewsHtml = data.reviews.map(r => {
                const initials = (r.name || 'A').charAt(0).toUpperCase();
                const dateStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const stars = renderStarsDisplay(r.stars);
                const deleteBtn = isAdmin() ? `<button class="review-delete-btn" onclick="deleteReview(${r.id}, ${recipeId})">Delete</button>` : '';
                return `
          <div class="review-item" id="review-${r.id}">
            <div class="review-avatar">${initials}</div>
            <div class="review-body">
              <div class="review-header">
                <span class="review-name">${esc(r.name)}</span>
                <span class="review-date">${dateStr} ${deleteBtn}</span>
              </div>
              <div>${stars}</div>
              ${r.text ? `<p class="review-text">${esc(r.text)}</p>` : ''}
            </div>
          </div>`;
            }).join('');
        } else {
            reviewsHtml = '<p style="color:var(--text-muted);font-size:0.9rem;padding:12px 0">No reviews yet. Be the first! 🌟</p>';
        }

        container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>${avgHtml} <span style="color:var(--text-muted);font-size:0.85rem">(${data.count} review${data.count !== 1 ? 's' : ''})</span></div>
      </div>
      <div class="reviews-list">${reviewsHtml}</div>
      <div class="review-form">
        <h4>Leave a Review</h4>
        <input type="text" id="reviewerName" placeholder="Your name (optional)">
        <div class="star-rating" id="starPicker">
          ${[1, 2, 3, 4, 5].map(i => `<span class="star" data-val="${i}" onclick="pickStar(${i})">★</span>`).join('')}
        </div>
        <textarea id="reviewText" placeholder="Share your thoughts about this recipe..."></textarea>
        <button class="btn btn-primary" onclick="submitReview(${recipeId})">Submit Review</button>
      </div>`;
    } catch (e) {
        console.error('Reviews load error:', e);
    }
}

let pickedStars = 0;
function pickStar(val) {
    pickedStars = val;
    document.querySelectorAll('#starPicker .star').forEach((el, idx) => {
        el.classList.toggle('filled', idx < val);
    });
}

async function submitReview(recipeId) {
    if (pickedStars === 0) { showToast('Please select a star rating'); return; }
    const name = (document.getElementById('reviewerName')?.value || '').trim() || 'Anonymous';
    const text = (document.getElementById('reviewText')?.value || '').trim();

    const token = getStoredSession().token;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API_URL}/api/ratings/${recipeId}`, {
            method: 'POST', headers,
            body: JSON.stringify({ stars: pickedStars, text, name })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Review submitted! ⭐');
            pickedStars = 0;
            loadRecipeReviews(recipeId);
        } else {
            showToast(data.error || 'Failed to submit');
        }
    } catch (e) {
        showToast('Connection error');
    }
}

async function deleteReview(reviewId, recipeId) {
  if (!confirm('Are you sure you want to delete this review?')) return;
  const token = getStoredSession().token;
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/api/ratings/${reviewId}/delete`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const el = document.getElementById(`review-${reviewId}`);
      if (el) el.remove();
      showToast('Review deleted');
    } else {
      showToast('failed to delete');
    }
  } catch (e) {
    showToast('Error deleting review');
  }
}


// ─── BOOKMARK FUNCTIONALITY ─────────────────────────────────────────────
async function toggleBookmark(recipeId, btn) {
  const token = getStoredSession().token;
  if (!token) { showToast('Login to save recipes'); openAuthModal(); return; }
  try {
    const res = await fetch(`${API_URL}/api/bookmarks/${recipeId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (btn) {
      btn.classList.toggle('saved', data.bookmarked);
      btn.innerHTML = data.bookmarked ? '🔖' : '🏷️';
    }
    showToast(data.message);
  } catch (e) {
    showToast('Error saving recipe');
  }
}

async function checkBookmarkStatus(recipeId) {
    const token = getStoredSession().token;
    if (!token) return false;
    try {
        const res = await fetch(`${API_URL}/api/bookmarks/check/${recipeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        return data.bookmarked;
    } catch { return false; }
}


// ─── SPIN THE WHEEL ─────────────────────────────────────────────────────
let wheelMeals = [];
let wheelSpinning = false;

async function openWheel() {
    // Fetch random meals for wheel
    const data = await fetchData('/random-meals');
    if (!data || !data.meals || data.meals.length < 2) {
        showToast('Not enough recipes to spin!');
        return;
    }
    wheelMeals = data.meals.slice(0, 8);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'wheel-modal-overlay';
    overlay.id = 'wheelOverlay';
    overlay.innerHTML = `
    <div class="wheel-modal">
      <button class="wheel-close-btn" onclick="closeWheel()">&times;</button>
      <h2>🎰 Spin the Wheel</h2>
      <div class="wheel-container">
        <div class="wheel-pointer"></div>
        <canvas id="wheelCanvas" class="wheel-canvas" width="320" height="320"></canvas>
      </div>
      <button class="wheel-spin-btn" id="wheelSpinBtn" onclick="spinWheel()">🎡 SPIN!</button>
      <div class="wheel-result" id="wheelResult"></div>
    </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    drawWheel(0);
}

function closeWheel() {
    const overlay = document.getElementById('wheelOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    }
}

const WHEEL_COLORS = [
    '#3d8b37', '#2e86c1', '#e67e22', '#8e44ad',
    '#e74c3c', '#1abc9c', '#d35400', '#2c3e50'
];

function drawWheel(rotation) {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 160, cy = 160, r = 150;
    const n = wheelMeals.length;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, 320, 320);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.translate(-cx, -cy);

    for (let i = 0; i < n; i++) {
        const angle = i * arc;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + arc);
        ctx.closePath();
        ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Text
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + arc / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'right';
        const name = wheelMeals[i].name.length > 16
            ? wheelMeals[i].name.substring(0, 15) + '…' : wheelMeals[i].name;
        ctx.fillText(name, r - 14, 4);
        ctx.restore();
    }
    ctx.restore();
}

function spinWheel() {
    if (wheelSpinning) return;
    wheelSpinning = true;
    const btn = document.getElementById('wheelSpinBtn');
    btn.disabled = true;

    const n = wheelMeals.length;
    const totalRotation = Math.PI * 2 * (5 + Math.random() * 5); // 5-10 full turns
    const duration = 4000;
    const start = performance.now();

    function animate(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentRotation = totalRotation * eased;

        drawWheel(currentRotation);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Determine winner
            const arc = (2 * Math.PI) / n;
            const finalAngle = currentRotation % (2 * Math.PI);
            // The pointer is at the top (12 o'clock / 3π/2 or -π/2)
            const pointerAngle = (2 * Math.PI - finalAngle + Math.PI * 1.5) % (2 * Math.PI);
            const winnerIdx = Math.floor(pointerAngle / arc) % n;
            const winner = wheelMeals[winnerIdx];

            const result = document.getElementById('wheelResult');
            result.textContent = `🎉 ${winner.name}`;
            result.classList.add('visible');

            wheelSpinning = false;
            btn.disabled = false;
            btn.textContent = '🍽️ View Recipe';
            btn.onclick = () => { closeWheel(); openRecipeDetail(winner.id); };

            // Confetti!
            if (typeof launchConfetti === 'function') launchConfetti();
        }
    }
    requestAnimationFrame(animate);
}


// ─── PATCH openRecipeDetail to include reviews + bookmark ────────────────
const _origOpenRecipe = openRecipeDetail;
openRecipeDetail = async function (id) {
    await _origOpenRecipe(id);

    // Add reviews section
    const inner = document.querySelector('#modalBody .modal-body-inner');
    if (inner) {
        // Insert reviews section before AI section
        const aiLabel = inner.querySelector('.ai-section-label');
        const reviewSection = document.createElement('div');
        reviewSection.innerHTML = `
      <div class="section-label"><h3>Reviews & Ratings</h3></div>
      <div id="reviewsSection"></div>`;
        if (aiLabel) {
            inner.insertBefore(reviewSection, aiLabel);
        } else {
            inner.appendChild(reviewSection);
        }
        loadRecipeReviews(id);

        // Add bookmark button to hero
        const hero = document.querySelector('#modalBody .modal-hero');
        if (hero) {
            const isBookmarked = await checkBookmarkStatus(id);
            const bmBtn = document.createElement('button');
            bmBtn.className = `bookmark-btn ${isBookmarked ? 'saved' : ''}`;
            bmBtn.innerHTML = isBookmarked ? '🔖' : '🏷️';
            bmBtn.onclick = (e) => { e.stopPropagation(); toggleBookmark(id, bmBtn); };
            hero.style.position = 'relative';
            hero.appendChild(bmBtn);
        }
    }
};

// ─── OVERRIDE renderRecipeGrid to include card preview popups ────────────
const _origRenderGrid = renderRecipeGrid;
renderRecipeGrid = function (elementId, meals) {
    const grid = document.getElementById(elementId);
    if (!meals.length) {
        grid.innerHTML = `<p class="text-center w-full">No recipes found.</p>`;
        return;
    }
    grid.innerHTML = renderRecipeCards(meals);
};


// ─── INJECT DASHBOARD LINK + ROTD ON INIT ───────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Add dashboard link in nav (only when logged in)
  const navLinks = document.querySelector('.nav-links');
  if (navLinks && !document.querySelector('.nav-dashboard')) {
    const dashLink = document.createElement('a');
    dashLink.href = 'dashboard.html';
    dashLink.className = 'nav-dashboard';
    dashLink.textContent = 'Dashboard';
    dashLink.style.display = 'none';
    dashLink.id = 'navDashLink';
    navLinks.appendChild(dashLink);
  }
  updateDashLink();

  // Load recipe of the day if container exists
  if (document.getElementById('rotdContainer')) {
    loadRecipeOfTheDay();
  }

  // Add Spin the Wheel button to Random section header if it exists
  const randomGrid = document.getElementById('randomMealsGrid');
  if (randomGrid) {
    const header = randomGrid.closest('.section')?.querySelector('.flex-between');
    if (header && !header.querySelector('.btn-spin-wheel')) {
      const spinBtn = document.createElement('button');
      spinBtn.className = 'btn-spin-wheel';
      spinBtn.innerHTML = '🎡 Spin the Wheel';
      spinBtn.onclick = openWheel;
      header.appendChild(spinBtn);
    }
  }

  // Handle Deep Linking (?recipeId=...)
  const params = new URLSearchParams(window.location.search);
  const rId = params.get('recipeId');
  if (rId && typeof openRecipeDetail === 'function') {
    // Wait for the page content to stabilize
    setTimeout(() => {
      openRecipeDetail(parseInt(rId));
    }, 500);
  }
});

function updateDashLink() {
    const link = document.getElementById('navDashLink');
    if (link) {
        link.style.display = currentUser ? '' : 'none';
    }
}

// Patch updateNavAuth to also toggle dashboard link
const _origUpdateNavAuth = updateNavAuth;
updateNavAuth = function () {
    _origUpdateNavAuth();
    updateDashLink();
};

// Track recently viewed recipes (localStorage)
function trackRecentlyViewed(recipe) {
    if (!recipe || !recipe.id) return;
    const KEY = 'spiceroute-recently-viewed';
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { }
    recent = recent.filter(r => r.id !== recipe.id);
    recent.unshift({ id: recipe.id, name: recipe.name, image_url: recipe.image_url || '', viewedAt: Date.now() });
    if (recent.length > 20) recent = recent.slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify(recent));
}

// Patch openRecipeDetail to track views
const _patchedOpenRecipe = openRecipeDetail;
openRecipeDetail = async function (id) {
    await _patchedOpenRecipe(id);
    if (currentRecipe) {
        trackRecentlyViewed(currentRecipe);
    }
};
