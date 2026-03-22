const API_URL = "http://localhost:5000";

// ─── Dark Mode (persisted) ─────────────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('spiceroute-theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();

function toggleTheme() {
  const chk = document.getElementById('themeToggleChk');
  if (chk.checked) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('spiceroute-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('spiceroute-theme', 'light');
  }
}

function updateThemeBtn() {
  const chk = document.getElementById('themeToggleChk');
  if (!chk) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  chk.checked = isDark;
}

// ─── App State ─────────────────────────────────────────────────────────────
let currentRecipe = null;
let currentStep = 0;

// ─── Initialization ────────────────────────────────────────────────────────
function init() {
  console.log("Initializing App...");
  updateThemeBtn();
  renderCategories();
  loadStats();
  loadLatestMeals();
  loadIngredients();
  loadRandomMeals();

  // Listen for search
  const searchInput = document.getElementById("globalSearch");
  if (searchInput) {
    searchInput.addEventListener("keydown", e => {
      if (e.key === "Enter") handleSearch();
    });
  } else {
    console.warn("Search input not found");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// ─── API Helpers ───────────────────────────────────────────────────────────
async function fetchData(endpoint) {
  try {
    const res = await fetch(`${API_URL}${endpoint}`);
    if (!res.ok) throw new Error("Server error");
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

// ─── Features ──────────────────────────────────────────────────────────────

async function loadStats() {
  const data = await fetchData("/stats");
  if (!data) return;

  // Simple counter animation
  animateCounter("statMeals", data.totalMeals);
  animateCounter("statIngredients", data.totalIngredients);
  animateCounter("statImages", data.totalImages);
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const increment = Math.ceil(target / 100);
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      el.innerText = target.toLocaleString();
      clearInterval(timer);
    } else {
      el.innerText = current.toLocaleString();
    }
  }, 20);
}

async function loadLatestMeals() {
  const data = await fetchData("/latest-meals");
  if (data && data.meals) {
    latestMealsCache = data.meals;
    activeCuisineFilter = 'All';
    renderCuisineFilterBar();
    renderRecipeGrid("latestMealsGrid", data.meals);
  }
}

function renderCategories() {
  const cats = [
    { name: "Chicken", img: "chicken.jpg" },
    { name: "Mutton", img: "mutton.jpg" },
    { name: "Fish", img: "fish.jpg" }

  ];
  const row = document.getElementById("categoryRow");
  row.innerHTML = cats.map(c => `
        <div class="category-card" onclick="loadByCategory('${c.name}')">
            <div class="cat-image" style="background-image: url('${c.img}')"></div>
            <p>${c.name}</p>
        </div>
    `).join("");
}

// ─── Hero Scroll/Parallax Effect ──────────────────────────────────────────
document.addEventListener('mousemove', (e) => {
  const visual = document.querySelector('.floating-food-container');
  if (!visual) return;
  const x = (window.innerWidth / 2 - e.pageX) / 30;
  const y = (window.innerHeight / 2 - e.pageY) / 30;
  visual.style.transform = `translateX(${x}px) translateY(${y}px)`;
});


async function loadByCategory(cat) {
  const grid = document.getElementById("categoryResults");
  grid.innerHTML = `<div class="spinner"></div>`;
  const data = await fetchData(`/meals-by-category?category=${cat}`);
  if (data && data.meals) {
    grid.scrollIntoView({ behavior: 'smooth' });
    renderRecipeGrid("categoryResults", data.meals);
  }
}

async function loadIngredients() {
  const CACHE_KEY = 'spiceroute-ingredients-v2'; // Changed key to force clear old junk
  const list = document.getElementById("ingredientList");
  const input = document.getElementById("ingredientInput");

  // ── Step 1: populate instantly from cache ───────────────────────────────
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const items = JSON.parse(cached);
      list.innerHTML = items.map(i => `<option value="${i}">`).join("");
    } catch (e) { localStorage.removeItem(CACHE_KEY); }
  }

  // ── Step 2: fetch fresh in background ──────────────────────────────────
  const data = await fetchData("/ingredients");
  if (data && data.ingredients && data.ingredients.length > 0) {
    list.innerHTML = data.ingredients.map(i => `<option value="${i}">`).join("");
    localStorage.setItem(CACHE_KEY, JSON.stringify(data.ingredients));

    // ── Step 3: Clear old v1 cache if exists ──────────────────────────────
    localStorage.removeItem('spiceroute-ingredients');

    // ── Step 4: Nudge the browser to show the arrow/popover ────────────────
    if (input && document.activeElement !== input) {
      // Just setting it again to trigger a change/update
      input.setAttribute('list', 'ingredientList');
    }
  }
}

async function handleIngredientFilter() {
  const val = document.getElementById("ingredientInput").value.trim();
  if (!val) return;
  const grid = document.getElementById("ingredientResults");
  grid.innerHTML = `<div class="spinner"></div>`;
  const data = await fetchData(`/meals-by-ingredient?ingredient=${encodeURIComponent(val)}`);
  if (data && data.meals) {
    grid.scrollIntoView({ behavior: 'smooth' });
    renderRecipeGrid("ingredientResults", data.meals);
  }
}

async function loadRandomMeals() {
  const grid = document.getElementById("randomMealsGrid");
  grid.innerHTML = `<div class="spinner"></div>`;
  const data = await fetchData("/random-meals");
  if (data && data.meals) {
    renderRecipeGrid("randomMealsGrid", data.meals);
  }
}

async function handleSearch() {
  const q = document.getElementById("globalSearch").value.trim();
  if (!q) return;

  // Clear and show search results in "Latest" section area for now
  const grid = document.getElementById("latestMealsGrid");
  document.querySelector("#latest h2").innerText = `Search results for "${q}"`;
  grid.scrollIntoView({ behavior: 'smooth' });

  grid.innerHTML = `<div class="spinner"></div>`;
  const data = await fetchData(`/search?q=${encodeURIComponent(q)}`);
  if (data && data.meals) {
    renderRecipeGrid("latestMealsGrid", data.meals);
  }
}

// ─── Difficulty Badge Helper ───────────────────────────────────────────────
function getDifficultyBadge(stepCount) {
  if (stepCount <= 5) return { label: '🟢 Easy', cls: 'badge-easy' };
  if (stepCount <= 12) return { label: '🟡 Medium', cls: 'badge-medium' };
  return { label: '🔴 Hard', cls: 'badge-hard' };
}

// ─── Cuisine Detection ──────────────────────────────────────────────────────
const CUISINE_MAP = [
  { tag: 'Indian', keys: ['curry', 'masala', 'biryani', 'korma', 'tikka', 'dal', 'paneer', 'roti', 'samosa', 'chutney', 'tandoori', 'vindaloo', 'haleem', 'dosa', 'idli', 'uttapam', 'naan', 'makhani', 'saag'] },
  { tag: 'Italian', keys: ['pasta', 'pizza', 'risotto', 'lasagna', 'carbonara', 'alfredo', 'pesto', 'bruschetta', 'focaccia', 'tiramisu', 'gnocchi', 'fettuccine', 'spaghetti', 'marinara', 'penne'] },
  { tag: 'Asian', keys: ['ramen', 'sushi', 'stir fry', 'stir-fry', 'noodle', 'fried rice', 'dim sum', 'teriyaki', 'miso', 'satay', 'pad thai', 'pho', 'dumpling', 'spring roll', 'kimchi', 'tofu', 'soy', 'szechuan', 'kung pao'] },
  { tag: 'Mexican', keys: ['taco', 'burrito', 'quesadilla', 'enchilada', 'salsa', 'guacamole', 'fajita', 'tamale', 'churro', 'nachos', 'chipotle', 'tortilla', 'frijoles'] },
];

function getCuisineTag(name) {
  const lower = (name || '').toLowerCase();
  for (const c of CUISINE_MAP) {
    if (c.keys.some(k => lower.includes(k))) return c.tag;
  }
  return 'Other';
}

// ─── Cuisine Filter State ───────────────────────────────────────────────────
let activeCuisineFilter = 'All';
let latestMealsCache = [];

function renderCuisineFilterBar() {
  const bar = document.getElementById('cuisineFilterBar');
  if (!bar) return;
  const filters = ['All', 'Indian', 'Italian', 'Asian', 'Mexican', 'Other'];
  bar.innerHTML = filters.map(f =>
    `<button class="cuisine-filter-btn${f === activeCuisineFilter ? ' active' : ''}" onclick="setCuisineFilter('${f}')">${f}</button>`
  ).join('');
}

async function setCuisineFilter(tag) {
  activeCuisineFilter = tag;
  renderCuisineFilterBar();
  const grid = document.getElementById("latestMealsGrid");

  if (tag === 'All') {
    renderRecipeGrid("latestMealsGrid", latestMealsCache);
    return;
  }

  grid.innerHTML = `<div class="spinner"></div>`;

  // Mapping display tags to broader DB search terms
  const dbSearchTerms = {
    'Indian': 'curry',
    'Asian': 'rice',
    'Italian': 'pasta',
    'Mexican': 'taco',
    'Other': 'sauce'
  };

  const searchTerm = dbSearchTerms[tag] || tag;
  const data = await fetchData(`/search?q=${encodeURIComponent(searchTerm)}`);

  if (data && data.meals) {
    renderRecipeGrid("latestMealsGrid", data.meals);
  } else {
    grid.innerHTML = `<p class="text-center w-full">No ${tag} recipes found.</p>`;
  }
}

// ─── Recipe Theme Engine ────────────────────────────────────────────────────
// Maps keyword patterns in recipe names → { emoji, gradient }
const RECIPE_THEMES = [
  { keys: ["chicken", "poultry", "hen", "roast chicken"], emoji: "🍗", grad: "135deg, #c0392b, #e67e22" },
  { keys: ["pork", "bacon", "ham", "sausage", "ribs"], emoji: "🥓", grad: "135deg, #d35400, #e67e22" },
  { keys: ["lamb", "mutton", "goat"], emoji: "🐑", grad: "135deg, #784212, #b7770d" },
  { keys: ["fish", "salmon", "tuna", "cod", "shrimp", "prawn", "seafood", "crab", "lobster"], emoji: "🐟", grad: "135deg, #1a5276, #2e86c1" },
  { keys: ["pasta", "spaghetti", "lasagna", "fettuccine", "penne", "noodle", "ramen", "udon"], emoji: "🍝", grad: "135deg, #b7770d, #d4ac0d" },
  { keys: ["pizza"], emoji: "🍕", grad: "135deg, #cb4335, #d35400" },
  { keys: ["soup", "stew", "broth", "bisque", "chowder"], emoji: "🍲", grad: "135deg, #1e8449, #27ae60" },
  { keys: ["salad", "slaw", "greens"], emoji: "🥗", grad: "135deg, #1e8449, #58d68d" },
  { keys: ["cake", "cupcake", "muffin", "brownie", "dessert", "sweet", "tart", "pudding", "cheesecake"], emoji: "🎂", grad: "135deg, #8e44ad, #c39bd3" },
  { keys: ["cookie", "biscuit"], emoji: "🍪", grad: "135deg, #b7770d, #f0b27a" },
  { keys: ["ice cream", "gelato", "sorbet", "frozen"], emoji: "🍦", grad: "135deg, #a9cce3, #d2b4de" },
  { keys: ["chocolate", "cocoa", "fudge"], emoji: "🍫", grad: "135deg, #4a235a, #7d3c98" },
  { keys: ["bread", "toast", "bagel", "roll", "loaf", "focaccia", "baguette"], emoji: "🍞", grad: "135deg, #b7770d, #f0b27a" },
  { keys: ["sandwich", "wrap", "taco", "burrito", "quesadilla"], emoji: "🌮", grad: "135deg, #d35400, #f39c12" },
  { keys: ["egg", "omelette", "frittata", "quiche", "scramble"], emoji: "🥚", grad: "135deg, #d4ac0d, #f9e79f" },
  { keys: ["rice", "risotto", "pilaf", "biryani", "fried rice"], emoji: "🍚", grad: "135deg, #1a5276, #76d7c4" },
  { keys: ["curry", "masala", "korma", "tikka"], emoji: "🍛", grad: "135deg, #d35400, #f39c12" },
  { keys: ["vegetable", "veggie", "vegan", "tofu", "lentil", "bean", "chickpea"], emoji: "🥦", grad: "135deg, #196f3d, #52be80" },
  { keys: ["smoothie", "juice", "shake", "drink", "cocktail", "mocktail"], emoji: "🥤", grad: "135deg, #1abc9c, #58d68d" },
  { keys: ["pie", "crumble", "cobbler"], emoji: "🥧", grad: "135deg, #922b21, #f0b27a" },
  { keys: ["mushroom"], emoji: "🍄", grad: "135deg, #626567, #aab7b8" },
  { keys: ["potato", "fries", "chips", "mash"], emoji: "🥔", grad: "135deg, #9a7d0a, #d4ac0d" },
  { keys: ["corn", "maize"], emoji: "🌽", grad: "135deg, #d4ac0d, #f9e79f" },
  { keys: ["carrot"], emoji: "🥕", grad: "135deg, #d35400, #f39c12" },
  { keys: ["apple", "pear"], emoji: "🍎", grad: "135deg, #922b21, #f1948a" },
  { keys: ["lemon", "lime", "citrus", "orange"], emoji: "🍋", grad: "135deg, #d4ac0d, #f9e79f" },
  { keys: ["strawberry", "berry", "blueberry", "raspberry"], emoji: "🍓", grad: "135deg, #922b21, #f1948a" },
  { keys: ["banana"], emoji: "🍌", grad: "135deg, #d4ac0d, #f9e79f" },
  { keys: ["avocado", "guacamole"], emoji: "🥑", grad: "135deg, #196f3d, #a9dfbf" },
  { keys: ["cheese"], emoji: "🧀", grad: "135deg, #b7770d, #f0b27a" },
];

const DEFAULT_THEMES = [
  { emoji: "🍽️", grad: "135deg, #2c3e50, #4a5568" },
  { emoji: "👨‍🍳", grad: "135deg, #1a3a5c, #2e86c1" },
  { emoji: "🥘", grad: "135deg, #5b2333, #922b21" },
  { emoji: "🫕", grad: "135deg, #1e5631, #27ae60" },
];

function getRecipeTheme(name) {
  const lower = (name || "").toLowerCase();
  for (const theme of RECIPE_THEMES) {
    if (theme.keys.some(k => lower.includes(k))) {
      return theme;
    }
  }
  // Deterministic fallback based on name characters
  const idx = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % DEFAULT_THEMES.length;
  return DEFAULT_THEMES[idx];
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function renderRecipeGrid(elementId, meals) {
  const grid = document.getElementById(elementId);
  if (!meals.length) {
    grid.innerHTML = `<p class="text-center w-full">No recipes found.</p>`;
    return;
  }

  grid.innerHTML = meals.map(m => {
    const theme = getRecipeTheme(m.name);
    const stepCount = m.step_count || (m.steps ? m.steps.length : 8);
    const diff = getDifficultyBadge(stepCount);
    const cuisine = getCuisineTag(m.name);

    // Real image if available, else gradient fallback
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
            </div>
        `;
  }).join("");
}


// ─── Technique Cards (CSS-animated, no external GIF dependency) ───────────────
const TECHNIQUES = [
  {
    keys: ['mix', 'stir', 'whisk', 'beat', 'blend', 'combine', 'toss'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="24" cy="24" r="10"/><path d="M24 14 Q30 20 24 24 Q18 28 24 34"/>
      <path d="M14 24 Q20 18 24 24 Q28 30 34 24"/>
    </svg>`,
    label: 'Mix / Stir', color: '#6C63FF', bg: '#EEF'
  },
  {
    keys: ['chop', 'cut', 'dice', 'slice', 'mince', 'julienne', 'shred'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M10 38 L38 10"/><path d="M8 30 L8 40 L18 40"/>
      <line x1="20" y1="14" x2="20" y2="40"/><line x1="28" y1="14" x2="28" y2="40"/>
      <line x1="14" y1="22" x2="40" y2="22"/><line x1="14" y1="30" x2="40" y2="30"/>
    </svg>`,
    label: 'Chop / Slice', color: '#E74C3C', bg: '#FEE'
  },
  {
    keys: ['fry', 'sauté', 'saute', 'sear', 'pan fry', 'deep fry', 'stir fry'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <ellipse cx="22" cy="30" rx="14" ry="7"/><path d="M8 30 L8 33 Q22 42 36 33 L36 30"/>
      <path d="M36 28 L42 22"/><path d="M16 10 Q17 6 16 2"/><path d="M24 8 Q25 4 24 0"/><path d="M20 12 Q21 8 20 4"/>
    </svg>`,
    label: 'Fry / Sauté', color: '#E67E22', bg: '#FEF3E2'
  },
  {
    keys: ['boil', 'simmer', 'blanch', 'poach'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M10 38 Q24 42 38 38 L38 28 Q24 32 10 28 Z"/>
      <path d="M16 10 Q17 6 16 2"/><path d="M24 8 Q25 4 24 2"/><path d="M32 10 Q33 6 32 2"/>
      <ellipse cx="24" cy="28" rx="14" ry="4"/>
    </svg>`,
    label: 'Boil / Simmer', color: '#1ABC9C', bg: '#E8FAF8'
  },
  {
    keys: ['bake', 'oven', 'roast', 'grill', 'broil'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <rect x="6" y="16" width="36" height="24" rx="4"/>
      <path d="M6 28 L42 28"/>
      <path d="M16 10 Q17 6 16 4"/><path d="M24 8 Q25 4 24 2"/><path d="M32 10 Q33 6 32 4"/>
      <circle cx="36" cy="22" r="3"/>
    </svg>`,
    label: 'Bake / Roast', color: '#D35400', bg: '#FDF1E8'
  },
  {
    keys: ['knead', 'fold', 'roll'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <ellipse cx="24" cy="34" rx="16" ry="6"/>
      <path d="M12 26 Q14 14 24 12 Q34 14 36 26"/>
      <path d="M18 12 Q24 4 30 12"/>
    </svg>`,
    label: 'Knead / Roll', color: '#8E44AD', bg: '#F5EFF8'
  },
  {
    keys: ['marinate', 'season', 'coat', 'rub', 'sprinkle'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <rect x="18" y="4" width="12" height="20" rx="4"/>
      <path d="M22 24 L22 32"/><path d="M26 24 L26 32"/>
      <ellipse cx="24" cy="36" rx="10" ry="4"/>
      <circle cx="34" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="38" cy="22" r="1.5" fill="currentColor"/>
      <circle cx="36" cy="28" r="1.5" fill="currentColor"/>
    </svg>`,
    label: 'Season', color: '#27AE60', bg: '#EAF7EE'
  },
  {
    keys: ['pour', 'drain', 'strain', 'sieve', 'add', 'transfer'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M12 8 L22 8 L36 36"/><path d="M36 8 L26 8 L12 36"/>
      <path d="M10 36 L38 36 L36 44 L12 44 Z"/>
    </svg>`,
    label: 'Pour / Drain', color: '#2980B9', bg: '#EAF3FB'
  },
  {
    keys: ['heat', 'warm', 'preheat'],
    icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="24" cy="28" r="10"/>
      <line x1="24" y1="4" x2="24" y2="12"/>
      <line x1="40" y1="12" x2="34" y2="18"/>
      <line x1="44" y1="28" x2="36" y2="28"/>
      <line x1="40" y1="44" x2="34" y2="38"/>
      <line x1="8" y1="12" x2="14" y2="18"/>
      <line x1="4" y1="28" x2="12" y2="28"/>
    </svg>`,
    label: 'Heat', color: '#C0392B', bg: '#FDEDEC'
  },
];

function getTechniqueGif(stepText) {
  const lower = (stepText || '').toLowerCase();
  for (const t of TECHNIQUES) {
    if (t.keys.some(k => lower.includes(k))) return t;
  }
  return null;
}

function renderTechniqueCard(tech) {
  return `<div class="technique-card" style="--tc:#${tech.color.slice(1)};border-color:${tech.color}22;background:${tech.bg}">
    <div class="tc-icon" style="color:${tech.color}">${tech.icon}</div>
    <span class="tc-label" style="color:${tech.color}">${tech.label}</span>
  </div>`;
}



// ─── Voice Output ─────────────────────────────────────────────────────────────
let isSpeaking = false;

function speakStep(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.9;
  utt.pitch = 1;
  utt.lang = 'en-US';
  utt.onstart = () => { isSpeaking = true; updateVoiceBtn(); };
  utt.onend = () => { isSpeaking = false; updateVoiceBtn(); };
  utt.onerror = () => { isSpeaking = false; updateVoiceBtn(); };
  window.speechSynthesis.speak(utt);
}

function toggleVoice() {
  if (isSpeaking) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    updateVoiceBtn();
  } else {
    if (currentRecipe && currentRecipe.steps[currentStep]) {
      speakStep(`Step ${currentStep + 1}. ${currentRecipe.steps[currentStep]}`);
    }
  }
}

function updateVoiceBtn() {
  const btn = document.getElementById('voiceBtn');
  if (!btn) return;
  btn.innerHTML = isSpeaking ? 'Stop' : 'Read Step';
  btn.style.background = isSpeaking ? 'linear-gradient(135deg,#c0392b,#e74c3c)' : '';
}

// ─── AI Chat State ────────────────────────────────────────────────────────────
let aiChatHistory = [];
let aiLoaded = false;

async function loadAINutrition() {
  if (aiLoaded) return;
  aiLoaded = true;
  const box = document.getElementById('aiResponseBox');
  box.innerHTML = `<div class="ai-thinking"><span></span><span></span><span></span></div><p style="color:#aaa;margin-top:8px;font-size:0.85rem">Analyzing recipe...</p>`;

  const ingredients = (currentRecipe.ingredients || []).map(i => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim());

  try {
    const res = await fetch(`${API_URL}/api/ai/nutrition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_name: currentRecipe.name, ingredients })
    });
    const data = await res.json();
    if (data.success) {
      box.innerHTML = `
        <div class="ai-provider-badge">⚡ Powered by ${data.provider}</div>
        <div class="ai-text">${formatAIText(data.response)}</div>
      `;
      aiChatHistory = [
        { role: 'assistant', content: data.response }
      ];
    } else {
      box.innerHTML = `<p class="ai-error">⚠️ ${data.error || 'AI unavailable right now'}</p>`;
    }
  } catch (e) {
    box.innerHTML = `<p class="ai-error">⚠️ Could not connect to AI service.</p>`;
  }
}

async function sendAIChat() {
  const input = document.getElementById('aiChatInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';

  const chatLog = document.getElementById('aiChatLog');
  chatLog.innerHTML += `<div class="chat-bubble user">${esc(question)}</div>`;
  chatLog.innerHTML += `<div class="chat-bubble ai thinking"><span></span><span></span><span></span></div>`;
  chatLog.scrollTop = chatLog.scrollHeight;

  const ingredients = (currentRecipe.ingredients || []).map(i => `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim());

  try {
    const res = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_name: currentRecipe.name,
        ingredients,
        question,
        history: aiChatHistory
      })
    });
    const data = await res.json();
    // Remove thinking bubble
    const thinking = chatLog.querySelector('.thinking');
    if (thinking) thinking.remove();

    if (data.success) {
      aiChatHistory.push({ role: 'user', content: question });
      aiChatHistory.push({ role: 'assistant', content: data.response });
      chatLog.innerHTML += `<div class="chat-bubble ai">${formatAIText(data.response)}</div>`;
    } else {
      chatLog.innerHTML += `<div class="chat-bubble ai error">⚠️ ${data.error}</div>`;
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  } catch (e) {
    chatLog.innerHTML += `<div class="chat-bubble ai error">⚠️ Connection error.</div>`;
  }
}

function formatAIText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,3}\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// ─── Ingredient Icon Lookup ───────────────────────────────────────────────────
const ING_ICONS = [
  { keys: ['chicken', 'poultry', 'hen'], icon: '🍗' },
  { keys: ['mutton', 'lamb', 'goat'], icon: '🥩' },
  { keys: ['fish', 'prawn', 'shrimp', 'crab', 'lobster', 'tuna', 'cod', 'salmon'], icon: '🐟' },
  { keys: ['egg'], icon: '🥚' },
  { keys: ['milk', 'cream', 'yogurt', 'curd', 'butter', 'ghee'], icon: '🥛' },
  { keys: ['cheese'], icon: '🧀' },
  { keys: ['rice', 'biryani', 'pilaf'], icon: '🍚' },
  { keys: ['flour', 'maida', 'atta', 'bread', 'roti'], icon: '🍞' },
  { keys: ['tomato'], icon: '🍅' },
  { keys: ['onion', 'shallot'], icon: '🧅' },
  { keys: ['garlic', 'ginger'], icon: '🌿' },
  { keys: ['carrot'], icon: '🥕' },
  { keys: ['potato'], icon: '🥔' },
  { keys: ['spinach', 'palak', 'greens', 'lettuce'], icon: '🥬' },
  { keys: ['pepper', 'chilli', 'chili', 'capsicum'], icon: '🌶️' },
  { keys: ['lemon', 'lime', 'orange', 'citrus'], icon: '🍋' },
  { keys: ['oil', 'olive'], icon: '🫙' },
  { keys: ['salt'], icon: '🧂' },
  { keys: ['sugar', 'honey', 'syrup'], icon: '🍯' },
  { keys: ['cumin', 'turmeric', 'coriander', 'masala', 'spice', 'cardamom', 'clove', 'cinnamon', 'bay'], icon: '🌿' },
  { keys: ['water', 'stock', 'broth'], icon: '💧' },
  { keys: ['nuts', 'almond', 'cashew', 'walnut', 'peanut'], icon: '🥜' },
];

function getIngredientIcon(name) {
  const lower = (name || '').toLowerCase();
  for (const e of ING_ICONS) {
    if (e.keys.some(k => lower.includes(k))) return e.icon;
  }
  return '🧄';
}

// ─── Recipe Modal ─────────────────────────────────────────────────────────────
async function openRecipeDetail(id) {
  const data = await fetchData(`/recipe/${id}`);
  if (!data) return;

  currentRecipe = data;
  currentStep = 0;
  aiChatHistory = [];
  aiLoaded = false;
  window.speechSynthesis && window.speechSynthesis.cancel();
  isSpeaking = false;

  const modal = document.getElementById('recipeModal');
  const body = document.getElementById('modalBody');

  const theme = getRecipeTheme(data.name);
  const heroHTML = data.image_url
    ? `<div class="modal-hero">
         <img class="modal-hero-img" src="${esc(data.image_url)}" alt="${esc(data.name)}">
         <div class="modal-hero-overlay"></div>
         <div class="modal-hero-title">
           <h1>${esc(data.name)}</h1>
           <p>✨ Authentic • Freshly Curated • ${data.steps.length} Steps</p>
         </div>
       </div>`
    : `<div class="modal-hero">
         <div class="modal-hero-gradient" style="background:linear-gradient(${theme.grad})">
           <span style="filter:drop-shadow(0 8px 24px rgba(0,0,0,0.3))">${theme.emoji}</span>
         </div>
         <div class="modal-hero-overlay"></div>
         <div class="modal-hero-title">
           <h1>${esc(data.name)}</h1>
           <p>✨ Authentic • Freshly Curated • ${data.steps.length} Steps</p>
         </div>
       </div>`;

  const chipsHTML = data.ingredients.map(i => {
    const qty = [i.quantity, i.unit].filter(Boolean).join(' ');
    return `<div class="ingredient-chip">
      <span class="ing-icon"></span>
      <div class="ing-info">
        <div class="ing-name">${esc(i.name)}</div>
        ${qty ? `<div class="ing-qty">${esc(qty)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const totalSteps = data.steps.length;
  const dotsHTML = Array.from({ length: Math.min(totalSteps, 12) }, (_, i) =>
    `<div class="step-dot" id="dot-${i}"></div>`
  ).join('');

  // First step technique card
  const firstTech = getTechniqueGif(data.steps[0]);
  const gifHTML = `<div id="techniqueCardBox">${firstTech ? renderTechniqueCard(firstTech) : ''}</div>`;

  body.innerHTML = `
    ${heroHTML}
    <div class="modal-body-inner">

      <!-- Cooking Mode -->
      <div class="section-label"><h3>Cooking Instructions</h3></div>
      <div class="cooking-mode-card" id="cookingModule">
        <div class="step-header">
          <span class="step-badge">Step-by-step</span>
          <div class="progress-container"><div class="progress-bar" id="progressBar"></div></div>
          <span class="step-counter" id="stepCounter">1 / ${totalSteps}</span>
        </div>

        <div class="step-body-row">
          <div class="step-card" id="stepCard">
            <div class="step-number-circle" id="stepNumCircle">1</div>
            <div class="step-text" id="stepText">${esc(data.steps[0])}</div>
          </div>
          ${gifHTML}
        </div>

        <div class="step-nav">
          <button class="btn btn-nav-prev" id="prevBtn" onclick="changeStep(-1)" disabled>Previous</button>
          <div style="display:flex;align-items:center;gap:0.6rem">
            <div class="step-dots" id="stepDots">${dotsHTML}</div>
            <button class="btn btn-voice" id="voiceBtn" onclick="toggleVoice()">Read Step</button>
          </div>
          <button class="btn btn-nav-next" id="nextBtn" onclick="changeStep(1)">Next Step</button>
        </div>
      </div>

      <!-- Ingredients -->
      <div class="section-label"><h3>Ingredients</h3></div>
      <div class="ingredients-grid">${chipsHTML}</div>

      <!-- AI Nutritional Assistant -->
      <div class="section-label ai-section-label">
        <h3>AI Nutritional Assistant</h3>
        <button class="btn btn-ai-load" onclick="loadAINutrition()">Analyze Recipe</button>
      </div>
      <div class="ai-panel">
        <div id="aiResponseBox" class="ai-response-box">
          <p class="ai-placeholder">Click "Analyze Recipe" to get macros, calories, spice level and cooking tips powered by AI.</p>
        </div>
        <div id="aiChatLog" class="ai-chat-log"></div>
        <div class="ai-input-row">
          <input type="text" id="aiChatInput" placeholder="Ask anything about this recipe..." onkeydown="if(event.key==='Enter') sendAIChat()">
          <button class="btn btn-ai-send" onclick="sendAIChat()">Send</button>
        </div>
      </div>

    </div>
  `;

  modal.style.display = 'block';
  updateCookingUI();

  // Inject admin Edit button
  if (isAdmin()) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-edit-recipe';
    editBtn.innerHTML = '&#9998; Edit Recipe';
    editBtn.onclick = () => openEditRecipeModal(id);
    // Insert at top of modal-body-inner
    const inner = body.querySelector('.modal-body-inner');
    if (inner) inner.prepend(editBtn);
  }
}

function changeStep(dir) {
  const newStep = currentStep + dir;
  if (newStep >= 0 && newStep < currentRecipe.steps.length) {
    currentStep = newStep;
    window.speechSynthesis && window.speechSynthesis.cancel();
    isSpeaking = false;
    updateCookingUI();
  }
}

function updateCookingUI() {
  const text = document.getElementById('stepText');
  const numCircle = document.getElementById('stepNumCircle');
  const counter = document.getElementById('stepCounter');
  const bar = document.getElementById('progressBar');
  const prev = document.getElementById('prevBtn');
  const next = document.getElementById('nextBtn');

  const total = currentRecipe.steps.length;

  const card = document.getElementById('stepCard');
  if (card) {
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'stepSlide 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
  }

  const stepTxt = currentRecipe.steps[currentStep];
  text.innerText = stepTxt;
  numCircle.innerText = currentStep + 1;
  counter.innerText = `${currentStep + 1} / ${total}`;

  const percent = ((currentStep + 1) / total) * 100;
  bar.style.width = `${percent}%`;

  // Update technique card
  const cardBox = document.getElementById('techniqueCardBox');
  if (cardBox) {
    const tech = getTechniqueGif(stepTxt);
    cardBox.innerHTML = tech ? renderTechniqueCard(tech) : '';
  }


  // Voice button reset
  updateVoiceBtn();

  const dots = document.querySelectorAll('.step-dot');
  dots.forEach((d, i) => {
    d.classList.remove('active', 'done');
    if (i === currentStep) d.classList.add('active');
    else if (i < currentStep) d.classList.add('done');
  });

  prev.disabled = currentStep === 0;
  const isLast = currentStep === total - 1;
  next.innerText = isLast ? '🎉 Finish Cooking' : 'Next Step';
  next.onclick = isLast ? () => { closeModal(); launchConfetti(); } : () => changeStep(1);
  next.style.background = isLast ? 'linear-gradient(135deg, #27ae60, #1e8449)' : '';
}

function closeModal() {
  window.speechSynthesis && window.speechSynthesis.cancel();
  isSpeaking = false;
  document.getElementById("recipeModal").style.display = "none";
}

// ─── Confetti Celebration ──────────────────────────────────────────────────
function launchConfetti() {
  // Create canvas
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const COLORS = ['#4caf50', '#27ae60', '#f39c12', '#e74c3c', '#9b59b6', '#3498db', '#f1c40f', '#e67e22', '#1abc9c', '#ff6b6b'];
  const particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 100,
    r: 5 + Math.random() * 7,
    d: 2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    tilt: Math.random() * 10 - 10,
    tiltV: 0.1 + Math.random() * 0.3,
    shape: Math.random() > 0.5 ? 'rect' : 'circle'
  }));

  let frame = 0;
  const maxFrames = 220;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = frame < maxFrames * 0.75 ? 1 : 1 - ((frame - maxFrames * 0.75) / (maxFrames * 0.25));
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.tilt * Math.PI) / 180);
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();

      p.y += p.d;
      p.tilt += p.tiltV;
      p.x += Math.sin(frame * 0.05 + p.tiltV) * 1.2;
    });

    frame++;
    if (frame < maxFrames) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }
  draw();

  // Toast
  let toast = document.querySelector('.finish-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'finish-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = '🎉 You did it! Enjoy your meal!';
  toast.classList.remove('hide');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
  }, 4000);
}

function esc(str) {
  if (!str) return "";
  const p = document.createElement("p");
  p.textContent = str;
  return p.innerHTML;
}


// ─── Section Scroll Highlighting ───────────────────────────────────────────
window.addEventListener('scroll', () => {
  const sections = document.querySelectorAll('.section');
  const scrollPos = window.scrollY + 150;

  sections.forEach(section => {
    if (scrollPos >= section.offsetTop && scrollPos < (section.offsetTop + section.offsetHeight)) {
      section.classList.add('active-scroll');
    } else {
      section.classList.remove('active-scroll');
    }
  });
});

// ─── Auth State ───────────────────────────────────────────────────────────────
let currentUser = null; // { id, name, email, is_admin }

function getStoredSession() {
  try {
    const token = localStorage.getItem('sr_token');
    const user = JSON.parse(localStorage.getItem('sr_user') || 'null');
    return { token, user };
  } catch { return { token: null, user: null }; }
}

function saveSession(token, user) {
  localStorage.setItem('sr_token', token);
  localStorage.setItem('sr_user', JSON.stringify(user));
  currentUser = user;
}

function clearSession() {
  localStorage.removeItem('sr_token');
  localStorage.removeItem('sr_user');
  currentUser = null;
}

// Restore session on page load
(function restoreSession() {
  const { token, user } = getStoredSession();
  if (token && user) {
    currentUser = user;
    updateNavAuth();
  }
})();

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function openAuthModal(tab) {
  if (currentUser) {
    toggleUserDropdown();
    return;
  }
  const modal = document.getElementById('authModal');
  modal.classList.add('active');
  modal.style.display = 'flex';
  switchAuthTab(tab || 'login');
  modal.onclick = (e) => { if (e.target === modal) closeAuthModal(); };
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  clearAuthErrors();
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
  } else {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
  }
  clearAuthErrors();
}

function clearAuthErrors() {
  ['loginError', 'signupError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  });
}

function showAuthError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── Login Handler ────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  clearAuthErrors();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const btn = document.getElementById('loginSubmitBtn');

  btn.disabled = true;
  btn.textContent = 'Logging in...';

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError('loginError', data.error || 'Login failed');
    } else {
      saveSession(data.token, data.user);
      closeAuthModal();
      updateNavAuth();
      showToast(`Welcome back, ${data.user.name}! 👋`);
    }
  } catch {
    showAuthError('loginError', 'Network error — is the server running?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

// ─── Signup Handler ───────────────────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  clearAuthErrors();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  const btn = document.getElementById('signupSubmitBtn');

  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError('signupError', data.error || 'Signup failed');
    } else {
      saveSession(data.token, data.user);
      closeAuthModal();
      updateNavAuth();
      showToast(`Account created! Welcome, ${data.user.name}! 🎉`);
    }
  } catch {
    showAuthError('signupError', 'Network error — is the server running?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function handleLogout() {
  clearSession();
  updateNavAuth();
  hideUserDropdown();
  showToast('Logged out successfully. See you soon! 👋');
}

// ─── Update Navbar Auth Button ────────────────────────────────────────────────
function updateNavAuth() {
  const guestDiv = document.getElementById('navAuthGuest');
  const avatarBtn = document.getElementById('userAvatarBtn');
  const avatarCircle = document.getElementById('userAvatarCircle');
  if (!guestDiv || !avatarBtn) return;

  if (currentUser) {
    guestDiv.classList.add('hidden');
    avatarBtn.classList.remove('hidden');
    const initials = (currentUser.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    avatarCircle.textContent = currentUser.is_admin ? '👑' : initials;
    avatarCircle.classList.toggle('admin-avatar', !!currentUser.is_admin);
    // Show/hide FAB
    const fab = document.getElementById('adminFab');
    if (fab) fab.classList.toggle('hidden', !currentUser.is_admin);
  } else {
    guestDiv.classList.remove('hidden');
    avatarBtn.classList.add('hidden');
    const fab = document.getElementById('adminFab');
    if (fab) fab.classList.add('hidden');
  }
}

// ─── User Dropdown ────────────────────────────────────────────────────────────
let dropdownVisible = false;

function toggleUserDropdown() {
  if (dropdownVisible) { hideUserDropdown(); return; }

  const dd = document.getElementById('userDropdown');
  if (!dd || !currentUser) return;

  document.getElementById('dropdownName').textContent = currentUser.name || '—';
  document.getElementById('dropdownEmail').textContent = currentUser.email || '—';

  const badge = document.getElementById('dropdownBadge');
  if (currentUser.is_admin) {
    badge.textContent = '👑 Admin';
    badge.className = 'dropdown-badge admin-badge';
  } else {
    badge.textContent = 'Member';
    badge.className = 'dropdown-badge';
  }

  dd.classList.remove('hidden');
  dropdownVisible = true;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', outsideDropdownHandler);
  }, 50);
}

function hideUserDropdown() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.classList.add('hidden');
  dropdownVisible = false;
  document.removeEventListener('click', outsideDropdownHandler);
}

function outsideDropdownHandler(e) {
  const dd = document.getElementById('userDropdown');
  const btn = document.getElementById('authBtn');
  if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
    hideUserDropdown();
  }
}

// ─── Toast Notification ───────────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('authToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'authToast';
    toast.style.cssText = `
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%) translateY(80px);
      background:linear-gradient(135deg,#3d8b37,#4caf50); color:#fff;
      padding:14px 28px; border-radius:50px; font-weight:600; font-size:0.95rem;
      box-shadow:0 8px 30px rgba(0,0,0,0.2); z-index:9999;
      transition:transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.4s;
      opacity:0; white-space:nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    toast.style.opacity = '0';
  }, 3500);
}

// ─── Admin helper (used later for Add/Edit/Delete) ────────────────────────────
function isAdmin() {
  return !!(currentUser && currentUser.is_admin);
}

function requireAdmin(action) {
  if (!currentUser) {
    openAuthModal();
    showToast('Please login first!');
    return false;
  }
  if (!currentUser.is_admin) {
    showToast('⛔ Admin access required for this action.');
    return false;
  }
  return true;
}

// ─── Ingredient & Step Row Helpers ─────────────────────────────────────────────
function addIngredientRow(containerId, vals = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const idx = container.children.length;
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `
    <input type="text" class="ing-name" placeholder="Ingredient name" value="${esc(vals.name || '')}" required>
    <input type="text" class="ing-qty" placeholder="Qty" value="${esc(vals.quantity || '')}">
    <input type="text" class="ing-unit" placeholder="Unit" value="${esc(vals.unit || '')}">
    <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Remove">&#x2715;</button>
  `;
  container.appendChild(row);
}

function addStepRow(containerId, text = '') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const num = container.children.length + 1;
  const row = document.createElement('div');
  row.className = 'step-row';
  row.innerHTML = `
    <span class="step-row-num">${num}</span>
    <textarea class="step-text-input" placeholder="Describe step ${num}..." rows="2" required>${esc(text)}</textarea>
    <button type="button" class="btn-remove-row" onclick="removeStepRow(this)" title="Remove">&#x2715;</button>
  `;
  container.appendChild(row);
  renumberSteps(containerId);
}

function removeStepRow(btn) {
  btn.parentElement.remove();
}

function renumberSteps(containerId) {
  const rows = document.querySelectorAll(`#${containerId} .step-row`);
  rows.forEach((r, i) => {
    const num = r.querySelector('.step-row-num');
    if (num) num.textContent = i + 1;
    const ta = r.querySelector('.step-text-input');
    if (ta) ta.placeholder = `Describe step ${i + 1}...`;
  });
}

function getIngredientRowData(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .ingredient-row`)).map(r => ({
    name: r.querySelector('.ing-name')?.value.trim() || '',
    quantity: r.querySelector('.ing-qty')?.value.trim() || '',
    unit: r.querySelector('.ing-unit')?.value.trim() || ''
  })).filter(i => i.name);
}

function getStepRowData(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} .step-text-input`)).map(ta => ta.value.trim()).filter(Boolean);
}

// ─── Add Recipe Modal ─────────────────────────────────────────────────────────
function openAddRecipeModal() {
  if (!requireAdmin()) return;
  // Reset form
  document.getElementById('addRecipeForm').reset();
  document.getElementById('arIngredientRows').innerHTML = '';
  document.getElementById('arStepRows').innerHTML = '';
  document.getElementById('addRecipeError').classList.add('hidden');
  // Add 1 default row each
  addIngredientRow('arIngredientRows');
  addStepRow('arStepRows');
  const modal = document.getElementById('addRecipeModal');
  modal.style.display = 'flex';
  modal.onclick = e => { if (e.target === modal) closeAddRecipeModal(); };
}

function closeAddRecipeModal() {
  document.getElementById('addRecipeModal').style.display = 'none';
}

async function handleAddRecipe(e) {
  e.preventDefault();
  if (!requireAdmin()) return;
  const btn = document.getElementById('addRecipeSubmitBtn');
  const errEl = document.getElementById('addRecipeError');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Adding...';

  const name = document.getElementById('arName').value.trim();
  const image_url = document.getElementById('arImageUrl').value.trim();
  const ingredients = getIngredientRowData('arIngredientRows');
  const instructions = getStepRowData('arStepRows');

  const { token } = getStoredSession();
  try {
    const res = await fetch(`${API_URL}/recipe/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, image_url, ingredients, instructions })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Failed'; errEl.classList.remove('hidden'); }
    else { closeAddRecipeModal(); showToast('Recipe added! 🎉'); loadLatestMeals(); }
  } catch { errEl.textContent = 'Network error'; errEl.classList.remove('hidden'); }
  finally { btn.disabled = false; btn.textContent = 'Add Recipe'; }
}

// ─── Edit Recipe Modal ────────────────────────────────────────────────────────
let editingRecipeId = null;

function openEditRecipeModal(id) {
  if (!requireAdmin()) return;
  editingRecipeId = id;
  // Pre-fill from currentRecipe
  const r = currentRecipe;
  document.getElementById('erName').value = r.name || '';
  document.getElementById('erImageUrl').value = r.image_url || '';
  document.getElementById('editRecipeError').classList.add('hidden');

  // Ingredients
  const ingContainer = document.getElementById('erIngredientRows');
  ingContainer.innerHTML = '';
  (r.ingredients || []).forEach(i => addIngredientRow('erIngredientRows', i));
  if (!ingContainer.children.length) addIngredientRow('erIngredientRows');

  // Steps
  const stepContainer = document.getElementById('erStepRows');
  stepContainer.innerHTML = '';
  (r.steps || []).forEach(s => addStepRow('erStepRows', s));
  if (!stepContainer.children.length) addStepRow('erStepRows');

  const modal = document.getElementById('editRecipeModal');
  modal.style.display = 'flex';
  modal.onclick = e => { if (e.target === modal) closeEditRecipeModal(); };
}

function closeEditRecipeModal() {
  document.getElementById('editRecipeModal').style.display = 'none';
  editingRecipeId = null;
}

async function handleEditRecipe(e) {
  e.preventDefault();
  if (!requireAdmin() || !editingRecipeId) return;
  const btn = document.getElementById('editRecipeSubmitBtn');
  const errEl = document.getElementById('editRecipeError');
  errEl.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Saving...';

  const name = document.getElementById('erName').value.trim();
  const image_url = document.getElementById('erImageUrl').value.trim();
  const ingredients = getIngredientRowData('erIngredientRows');
  const instructions = getStepRowData('erStepRows');

  const { token } = getStoredSession();
  try {
    const res = await fetch(`${API_URL}/recipe/${editingRecipeId}/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, image_url, ingredients, instructions })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Failed'; errEl.classList.remove('hidden'); }
    else { closeEditRecipeModal(); closeModal(); showToast('Recipe updated! ✅'); loadLatestMeals(); }
  } catch { errEl.textContent = 'Network error'; errEl.classList.remove('hidden'); }
  finally { btn.disabled = false; btn.textContent = 'Save Changes'; }
}

// ─── Delete Recipe ────────────────────────────────────────────────────────────
function handleDeleteRecipe() {
  if (!requireAdmin() || !editingRecipeId) return;
  const modal = document.getElementById('deleteConfirmModal');
  modal.style.display = 'flex';
  document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
  modal.onclick = e => { if (e.target === modal) closeDeleteConfirm(); };
}

function closeDeleteConfirm() {
  document.getElementById('deleteConfirmModal').style.display = 'none';
}

async function confirmDelete() {
  if (!requireAdmin() || !editingRecipeId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true; btn.textContent = 'Deleting...';
  const { token } = getStoredSession();
  try {
    const res = await fetch(`${API_URL}/recipe/${editingRecipeId}/delete`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      closeDeleteConfirm();
      closeEditRecipeModal();
      closeModal();
      showToast('Recipe deleted! 🗑️');
      loadLatestMeals();
    } else {
      showToast('Error: ' + (data.error || 'Delete failed'));
    }
  } catch { showToast('Network error during delete'); }
  finally { btn.disabled = false; btn.textContent = 'Yes, Delete'; }
}
