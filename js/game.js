/*
 *  game.js — 核心游戏逻辑
 *  果了个果 · 多层堆叠 · 三关渐进 · 消除粒子特效
 */

'use strict';

// ========== 游戏配置 ==========
var CONFIG = {
  cardTypes: [
    { id: 'apple',   emoji: '🍎' },
    { id: 'orange',  emoji: '🍊' },
    { id: 'lemon',   emoji: '🍋' },
    { id: 'grape',   emoji: '🍇' },
    { id: 'berry',   emoji: '🍓' },
    { id: 'peach',   emoji: '🍑' }
  ],
  slotMax: 7,
  clickDebounce: 180,
  matchDelay: 380,

  /* 卡片尺寸（与CSS .card 严格一致） */
  cardWidth: 58,
  cardHeight: 58,

  /* 三关配置 */
  levels: [
    { targetGroups: 4,  totalCards: 12, digit: '6', layers: 2, desc: '第一关' },
    { targetGroups: 8,  totalCards: 24, digit: '2', layers: 3, desc: '第二关' },
    { targetGroups: 10, totalCards: 30, digit: '2', layers: 3, desc: '第三关' }
  ],

  /* 🌟 消除粒子颜色（按卡片类型） */
  particleColors: {
    apple:  '#FF5252',
    orange: '#FF9800',
    lemon:  '#FFEB3B',
    grape:  '#9C27B0',
    berry:  '#E91E63',
    peach:  '#FF8A80'
  }
};

/* 移动端适配 */
(function () {
  if (window.innerWidth <= 600) {
    CONFIG.cardWidth = 48;
    CONFIG.cardHeight = 48;
  }
  if (window.innerWidth <= 380) {
    CONFIG.cardWidth = 41;
    CONFIG.cardHeight = 41;
  }
})();

// ========== 全局状态 ==========
var cardPool = [];
var slotCards = [];
var currentLevel = 0;
var eliminatedGroups = 0;
var collectedDigits = [];
var lastClickTime = 0;
var isProcessing = false;
var chainCount = 0; /* 连锁消除次数 */

// ========== DOM 缓存 ==========
var boardEl    = null;
var slotBarEl  = null;
var remainEl   = null;
var levelBadge = null;
var collectSlots = [];

// ========== 卡片生成 ==========

function createCard(typeInfo, index) {
  return {
    id: index,
    type: typeInfo.id,
    emoji: typeInfo.emoji,
    removed: false,
    blocked: true,
    x: 0, y: 0,
    layer: 0
  };
}

function generateLevelCards(levelIndex) {
  var cfg = CONFIG.levels[levelIndex];
  var cards = [];
  var idCounter = 0;
  var groupsPerType = Math.floor(cfg.targetGroups / CONFIG.cardTypes.length);
  var extra = cfg.targetGroups % CONFIG.cardTypes.length;

  CONFIG.cardTypes.forEach(function (typeInfo, idx) {
    var groups = groupsPerType + (idx < extra ? 1 : 0);
    for (var g = 0; g < groups; g++) {
      for (var c = 0; c < 3; c++) {
        cards.push(createCard(typeInfo, idCounter));
        idCounter++;
      }
    }
  });
  return cards;
}

// ========== 堆叠布局引擎 ==========

function scatterLayer(cards, boardW, boardH) {
  var margin = 10;
  var maxW = boardW - CONFIG.cardWidth - margin;
  var maxH = boardH - CONFIG.cardHeight - margin;
  var rects = [];

  cards.forEach(function (card) {
    var placed = false;
    var attempts = 0;
    while (!placed && attempts < 100) {
      var cx = margin + Math.random() * maxW;
      var cy = margin + Math.random() * maxH;
      var rect = {
        left: cx, top: cy,
        right: cx + CONFIG.cardWidth,
        bottom: cy + CONFIG.cardHeight
      };
      var tooClose = rects.some(function (r) { return rectsOverlap(r, rect, 0.6); });
      if (!tooClose) {
        card.x = cx; card.y = cy;
        rects.push(rect);
        placed = true;
      }
      attempts++;
    }
    if (!placed) {
      card.x = margin + Math.random() * maxW;
      card.y = margin + Math.random() * maxH;
      rects.push({
        left: card.x, top: card.y,
        right: card.x + CONFIG.cardWidth,
        bottom: card.y + CONFIG.cardHeight
      });
    }
  });
  return rects;
}

function rectsOverlap(a, b, ratio) {
  var ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  var oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  if (ox <= 0 || oy <= 0) return false;
  if (!ratio) return true;
  var areaA = (a.right - a.left) * (a.bottom - a.top);
  var areaB = (b.right - b.left) * (b.bottom - b.top);
  return (ox * oy / Math.min(areaA, areaB)) >= ratio;
}

function buildLayout(cards, levelIndex) {
  var cfg = CONFIG.levels[levelIndex];
  var boardW = boardEl.clientWidth;
  var boardH = boardEl.clientHeight;

  var cardsPerLayer = [];
  var remaining = cards.slice();

  for (var l = 0; l < cfg.layers; l++) {
    var count = l === 0
      ? Math.ceil(remaining.length * 0.5)
      : Math.ceil(remaining.length / (cfg.layers - l));
    cardsPerLayer.push(remaining.splice(0, count));
  }
  if (remaining.length > 0) cardsPerLayer[0] = cardsPerLayer[0].concat(remaining);

  var allRects = [];
  cardsPerLayer.forEach(function (layerCards, layerIdx) {
    layerCards.forEach(function (card) { card.layer = layerIdx; });
    var layerRects = scatterLayer(layerCards, boardW, boardH);
    layerRects.forEach(function (rect) { allRects.push({ rect: rect, layer: layerIdx }); });
  });

  cards.forEach(function (card) {
    var cardRect = {
      left: card.x, top: card.y,
      right: card.x + CONFIG.cardWidth,
      bottom: card.y + CONFIG.cardHeight
    };
    var blocked = false;
    allRects.forEach(function (item) {
      if (item.layer > card.layer && rectsOverlap(item.rect, cardRect, 0.15)) {
        blocked = true;
      }
    });
    card.blocked = blocked;
  });
}

// ========== 渲染 ==========

function renderBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = '';
  var sorted = cardPool.slice().sort(function (a, b) {
    if (a.layer !== b.layer) return a.layer - b.layer;
    return a.y - b.y;
  });
  sorted.forEach(function (card) {
    if (card.removed) return;
    var div = document.createElement('div');
    div.className = 'card';
    div.textContent = card.emoji;
    div.style.left = card.x + 'px';
    div.style.top = card.y + 'px';
    div.style.zIndex = card.layer * 100 + Math.floor(card.y);
    div.dataset.cardId = card.id;
    if (card.blocked) div.classList.add('blocked');
    boardEl.appendChild(div);
  });
}

function renderSlot(highlightTypes) {
  if (!slotBarEl) return;
  slotBarEl.innerHTML = '';

  /* 槽位预警：≥5格时danger样式 */
  if (slotCards.length >= 5) {
    slotBarEl.classList.add('danger');
  } else {
    slotBarEl.classList.remove('danger');
  }

  slotCards.forEach(function (card) {
    var div = document.createElement('div');
    div.className = 'slot-card';
    if (highlightTypes && highlightTypes.indexOf(card.type) !== -1) {
      div.classList.add('matched');
    }
    div.textContent = card.emoji;
    slotBarEl.appendChild(div);
  });

  var empty = CONFIG.slotMax - slotCards.length;
  for (var i = 0; i < empty; i++) {
    var ph = document.createElement('div');
    ph.className = 'slot-placeholder';
    slotBarEl.appendChild(ph);
  }
}

function updateRemainCount() {
  var remain = cardPool.filter(function (c) { return !c.removed; }).length;
  if (remainEl) remainEl.textContent = remain;
  return remain;
}

function refreshUI() {
  renderBoard();
  renderSlot();
  updateRemainCount();
  updateLevelBadge();
}

function updateLevelBadge() {
  if (levelBadge) {
    levelBadge.textContent = '第 ' + (currentLevel + 1) + ' / 3 关';
  }
}

function updateCollectSlots() {
  collectSlots.forEach(function (slot, i) {
    if (i < collectedDigits.length) {
      slot.textContent = collectedDigits[i];
      slot.classList.add('filled');
    } else {
      slot.textContent = '';
      slot.classList.remove('filled');
    }
  });
}

// ========== 遮挡刷新 ==========

function refreshBlockedState() {
  var activeByLayer = {};
  cardPool.forEach(function (card) {
    if (card.removed) return;
    if (!activeByLayer[card.layer]) activeByLayer[card.layer] = [];
    activeByLayer[card.layer].push({
      left: card.x, top: card.y,
      right: card.x + CONFIG.cardWidth,
      bottom: card.y + CONFIG.cardHeight
    });
  });
  cardPool.forEach(function (card) {
    if (card.removed) return;
    var cardRect = {
      left: card.x, top: card.y,
      right: card.x + CONFIG.cardWidth,
      bottom: card.y + CONFIG.cardHeight
    };
    var blocked = false;
    for (var l = card.layer + 1; l <= 3; l++) {
      if (!activeByLayer[l]) continue;
      for (var i = 0; i < activeByLayer[l].length; i++) {
        if (rectsOverlap(activeByLayer[l][i], cardRect, 0.15)) {
          blocked = true; break;
        }
      }
      if (blocked) break;
    }
    card.blocked = blocked;
  });
}

// ========== 🌟 消除粒子 ==========

function spawnMatchParticles(x, y, cardType) {
  var color = CONFIG.particleColors[cardType] || '#FFD740';
  var count = 10;
  for (var i = 0; i < count; i++) {
    var particle = document.createElement('div');
    particle.className = 'match-particle';
    var angle = Math.random() * 360;
    var dist = 30 + Math.random() * 50;
    var dx = Math.cos(angle * Math.PI / 180) * dist;
    var dy = Math.sin(angle * Math.PI / 180) * dist;
    var size = 3 + Math.random() * 5;
    var delay = Math.random() * 0.15;
    particle.style.cssText =
      '--pdx:' + dx + 'px;' +
      '--pdy:' + dy + 'px;' +
      '--psize:' + size + 'px;' +
      '--pcolor:' + color + ';' +
      '--pdelay:' + delay + 's;' +
      'left:' + x + 'px;' +
      'top:' + y + 'px;';
    document.body.appendChild(particle);
    setTimeout(function () { particle.remove(); }, 600 + delay * 1000);
  }
}

/* 获取槽位栏中心坐标用于粒子生成 */
function getSlotCenter() {
  if (!slotBarEl) return { x: window.innerWidth / 2, y: window.innerHeight - 80 };
  var rect = slotBarEl.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

// ========== 核心交互 ==========

function onBoardClick(e) {
  if (isProcessing) return;
  var target = e.target;
  if (!target.classList.contains('card')) return;
  if (target.classList.contains('blocked')) return;
  if (target.classList.contains('removed')) return;

  var now = Date.now();
  if (now - lastClickTime < CONFIG.clickDebounce) return;
  lastClickTime = now;

  var cardId = parseInt(target.dataset.cardId, 10);
  var card = null;
  for (var i = 0; i < cardPool.length; i++) {
    if (cardPool[i].id === cardId && !cardPool[i].removed) {
      card = cardPool[i]; break;
    }
  }
  if (!card || card.blocked) return;

  if (typeof playClick === 'function') playClick();
  if (typeof navigator.vibrate === 'function') navigator.vibrate(15);

  card.removed = true;
  refreshBlockedState();
  slotCards.push(card);
  refreshUI();
  processMatches();
}

// ========== 三连消除 ==========

function findMatchType() {
  var typeCount = {};
  slotCards.forEach(function (card) {
    typeCount[card.type] = (typeCount[card.type] || 0) + 1;
  });
  for (var type in typeCount) {
    if (typeCount[type] >= 3) return type;
  }
  return null;
}

function removeMatchedType(matchType) {
  var removed = 0;
  var newSlot = [];
  for (var i = 0; i < slotCards.length; i++) {
    if (slotCards[i].type === matchType && removed < 3) {
      removed++;
    } else {
      newSlot.push(slotCards[i]);
    }
  }
  slotCards = newSlot;
}

function processMatches() {
  var matchType = findMatchType();

  if (!matchType) {
    if (slotCards.length >= CONFIG.slotMax) {
      handleSlotFull();
    }
    return;
  }

  isProcessing = true;
  chainCount++;
  renderSlot([matchType]);

  setTimeout(function () {
    /* 🌟 消除粒子：在槽位中心爆发 */
    var pos = getSlotCenter();
    spawnMatchParticles(pos.x, pos.y, matchType);

    removeMatchedType(matchType);
    eliminatedGroups++;

    if (typeof playMatch === 'function') playMatch();

    renderSlot();
    updateRemainCount();

    if (checkLevelComplete()) {
      isProcessing = false;
      return;
    }

    var nextMatch = findMatchType();
    if (nextMatch) {
      isProcessing = false;
      processMatches();
    } else if (slotCards.length >= CONFIG.slotMax) {
      handleSlotFull();
    } else {
      isProcessing = false;
      chainCount = 0;
    }
  }, CONFIG.matchDelay);
}

// ========== 关卡完成 ==========

function checkLevelComplete() {
  var remain = cardPool.filter(function (c) { return !c.removed; }).length;
  if (remain === 0 && slotCards.length === 0) {
    onLevelClear();
    return true;
  }
  return false;
}

function onLevelClear() {
  var cfg = CONFIG.levels[currentLevel];
  collectedDigits.push(cfg.digit);
  updateCollectSlots();

  if (typeof playLevelClear === 'function') playLevelClear();

  if (currentLevel >= 2) {
    triggerFinalWin();
  } else {
    showLevelTransition(cfg.digit, function () {
      currentLevel++;
      loadLevel(currentLevel);
    });
  }
}

function showLevelTransition(digit, callback) {
  var overlay = document.getElementById('levelOverlay');
  var digitEl = document.getElementById('levelDigit');
  var hintEl  = document.getElementById('levelHint');
  if (!overlay || !digitEl) { if (callback) callback(); return; }
  digitEl.textContent = digit;
  hintEl.textContent = '恭喜通过！准备下一关...';
  overlay.classList.remove('hidden');
  setTimeout(function () {
    overlay.classList.add('hidden');
    if (callback) setTimeout(callback, 200);
  }, 1800);
}

function triggerFinalWin() {
  setTimeout(function () {
    var overlay = document.getElementById('winOverlay');
    if (overlay) overlay.classList.remove('hidden');
    if (typeof triggerSurprise === 'function') triggerSurprise(collectedDigits);
  }, 600);
}

// ========== 失败处理 ==========

function handleSlotFull() {
  isProcessing = true;
  chainCount = 0;
  if (slotBarEl) {
    slotBarEl.classList.add('shake');
    setTimeout(function () { slotBarEl.classList.remove('shake'); }, 450);
  }
  setTimeout(function () {
    resetCurrentLevel();
    isProcessing = false;
  }, 550);
}

function resetCurrentLevel() {
  var cards = generateLevelCards(currentLevel);
  slotCards = [];
  eliminatedGroups = 0;
  cardPool = cards;
  buildLayout(cardPool, currentLevel);
  refreshUI();
}

// ========== 关卡加载 ==========

function loadLevel(levelIndex) {
  currentLevel = levelIndex;
  var cards = generateLevelCards(levelIndex);
  slotCards = [];
  eliminatedGroups = 0;
  chainCount = 0;
  cardPool = cards;
  requestAnimationFrame(function () {
    buildLayout(cardPool, levelIndex);
    refreshUI();
  });
}

function resetGame() {
  collectedDigits = [];
  updateCollectSlots();
  currentLevel = 0;
  chainCount = 0;
  loadLevel(0);
}

// ========== 启动 ==========

function initGame() {
  boardEl    = document.getElementById('board');
  slotBarEl  = document.getElementById('slotBar');
  remainEl   = document.getElementById('remainCount');
  levelBadge = document.getElementById('levelBadge');

  for (var i = 0; i < 3; i++) {
    var slot = document.getElementById('collectSlot' + i);
    if (slot) collectSlots.push(slot);
  }

  if (boardEl) boardEl.addEventListener('click', onBoardClick);

  window.addEventListener('resize', function () {
    if (window.innerWidth <= 380) {
      CONFIG.cardWidth = 41; CONFIG.cardHeight = 41;
    } else if (window.innerWidth <= 600) {
      CONFIG.cardWidth = 48; CONFIG.cardHeight = 48;
    } else {
      CONFIG.cardWidth = 58; CONFIG.cardHeight = 58;
    }
    if (cardPool.length > 0) {
      buildLayout(cardPool, currentLevel);
      refreshUI();
    }
  });

  resetGame();
}

document.addEventListener('DOMContentLoaded', initGame);
