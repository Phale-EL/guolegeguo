/*
 *  surprise.js — 通关惊喜动画
 *  622 数字 → CSS蛋糕蜡烛 → 长按吹灭 → 🎆烟花彩带 → 祝福 + 秘密空间
 */

'use strict';

var digitsEl  = null;
var cakeEl    = null;
var textEl    = null;
var replayEl  = null;
var blowBtn   = null;
var secretEl  = null;

/* ================================================================
   ⚠️ 在此处填写你的视频链接（本地路径或 URL）
   ================================================================ */
var SECRET_VIDEO_URL = 'audio/VID20260619231942.mp4';

// ========== 烟花彩带颜色 ==========
var FIREWORK_COLORS = ['#FF4081','#FFD740','#40C4FF','#B2FF59','#FF6E40','#E040FB','#00E5FF','#FFAB40'];
var CONFETTI_COLORS = ['#FF4081','#FFD740','#40C4FF','#B2FF59','#FF6E40','#E040FB','#FF80AB','#84FFFF','#FFE57F','#CCFF90'];

/* 依次弹出数字 */
function showDigits(digits, callback) {
  if (!digitsEl) return;
  digitsEl.innerHTML = '';
  digitsEl.classList.remove('hidden');

  var index = 0;
  function showNext() {
    if (index >= digits.length) {
      if (callback) setTimeout(callback, 900);
      return;
    }
    var span = document.createElement('span');
    span.className = 'digit';
    span.textContent = digits[index];
    digitsEl.appendChild(span);
    index++;
    setTimeout(showNext, 500);
  }
  showNext();
}

/* 显示蛋糕 + 蜡烛 + 长按按钮 */
function showCake() {
  if (digitsEl) {
    digitsEl.classList.add('hidden');
    digitsEl.innerHTML = '';
  }
  if (cakeEl)  cakeEl.classList.remove('hidden');
  if (blowBtn) {
    blowBtn.classList.remove('hidden');
    bindBlowButton();
  }
  if (typeof playBGM === 'function') playBGM();
}

// ========== 长按吹灭 ==========
var blowPressTimer = null;
var blowFired = false;

function bindBlowButton() {
  if (!blowBtn) return;
  blowFired = false;
  blowBtn.addEventListener('mousedown', onBlowStart);
  blowBtn.addEventListener('touchstart', onBlowStart, { passive: true });
  blowBtn.addEventListener('mouseup', onBlowCancel);
  blowBtn.addEventListener('mouseleave', onBlowCancel);
  blowBtn.addEventListener('touchend', onBlowCancel);
  blowBtn.addEventListener('touchcancel', onBlowCancel);
}

function unbindBlowButton() {
  if (!blowBtn) return;
  blowBtn.removeEventListener('mousedown', onBlowStart);
  blowBtn.removeEventListener('touchstart', onBlowStart);
  blowBtn.removeEventListener('mouseup', onBlowCancel);
  blowBtn.removeEventListener('mouseleave', onBlowCancel);
  blowBtn.removeEventListener('touchend', onBlowCancel);
  blowBtn.removeEventListener('touchcancel', onBlowCancel);
}

function onBlowStart(e) {
  if (blowFired) return;
  e.preventDefault();
  if (blowBtn) blowBtn.classList.add('pressing');
  blowPressTimer = setTimeout(function () {
    blowFired = true;
    if (blowBtn) blowBtn.classList.remove('pressing');
    unbindBlowButton();
    onBlowDetected();
  }, 1500);
}

function onBlowCancel() {
  if (blowPressTimer) { clearTimeout(blowPressTimer); blowPressTimer = null; }
  if (blowBtn) blowBtn.classList.remove('pressing');
}

/* 吹灭蜡烛 + 触发烟花彩带 */
function onBlowDetected() {
  /* 逐根熄灭蜡烛 */
  for (var i = 0; i < 4; i++) {
    (function (idx) {
      setTimeout(function () {
        var flame = document.getElementById('flame' + idx);
        if (flame) flame.classList.add('blown-out');
      }, idx * 200);
    })(i);
  }

  /* 🎆 烟花 + 🎊 彩带 */
  setTimeout(function () {
    spawnFireworks();
    spawnConfetti();
  }, 300);

  /* 显示祝福 */
  setTimeout(function () {
    if (blowBtn) blowBtn.classList.add('hidden');
    if (textEl)  textEl.classList.remove('hidden');
    if (replayEl) {
      replayEl.classList.remove('hidden');
      replayEl.addEventListener('click', onReplay);
    }
    showSecretLink();
  }, 1500);
}

/* 秘密空间链接 */
function showSecretLink() {
  if (!secretEl) return;
  secretEl.href = SECRET_VIDEO_URL;
  secretEl.classList.remove('hidden');
}

// ========== 🎆 烟花 ==========

/* 单颗烟花粒子 */
function createFireworkParticle(x, y, angle, color, speed, size, delay) {
  var el = document.createElement('div');
  el.className = 'firework-particle';
  var rad = angle * Math.PI / 180;
  var dx = Math.cos(rad) * speed;
  var dy = Math.sin(rad) * speed;
  el.style.cssText =
    '--dx:' + dx + 'px;' +
    '--dy:' + dy + 'px;' +
    '--size:' + size + 'px;' +
    '--color:' + color + ';' +
    '--delay:' + delay + 's;' +
    'left:' + x + 'px;' +
    'top:' + y + 'px;';
  document.body.appendChild(el);
  /* 动画结束后移除 */
  setTimeout(function () { el.remove(); }, 1500 + delay * 1000);
}

/* 生成一发烟花 */
function spawnFirework(x, y, startDelay) {
  var color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  var count = 30 + Math.floor(Math.random() * 20);
  for (var i = 0; i < count; i++) {
    var angle = (360 / count) * i + Math.random() * 10;
    var speed = 60 + Math.random() * 100;
    var size = 3 + Math.random() * 5;
    var delay = startDelay + Math.random() * 0.15;
    createFireworkParticle(x, y, angle, color, speed, size, delay);
  }
}

/* 多轮烟花 */
function spawnFireworks() {
  var w = window.innerWidth;
  var h = window.innerHeight;

  /* 3轮烟花，间隔 0.6s */
  for (var round = 0; round < 3; round++) {
    (function (r) {
      setTimeout(function () {
        /* 每轮 3~5 发 */
        var bursts = 3 + Math.floor(Math.random() * 3);
        for (var b = 0; b < bursts; b++) {
          var fx = w * 0.15 + Math.random() * w * 0.7;
          var fy = h * 0.1 + Math.random() * h * 0.45;
          spawnFirework(fx, fy, 0);
        }
      }, r * 600);
    })(round);
  }
}

// ========== 🎊 彩带 ==========

function createConfetti() {
  var el = document.createElement('div');
  el.className = 'confetti';

  var color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  var left = Math.random() * 100;
  var size = 6 + Math.random() * 6;
  var duration = 2.5 + Math.random() * 3;
  var delay = Math.random() * 0.8;
  var sway = (Math.random() - 0.5) * 150;

  el.style.cssText =
    '--color:' + color + ';' +
    '--sway:' + sway + 'px;' +
    '--size:' + size + 'px;' +
    '--duration:' + duration + 's;' +
    '--delay:' + delay + 's;' +
    'left:' + left + '%;';

  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, (duration + delay) * 1000 + 500);
}

function spawnConfetti() {
  /* 3 波彩带，每波 50 片 */
  for (var wave = 0; wave < 3; wave++) {
    setTimeout(function () {
      for (var i = 0; i < 50; i++) {
        createConfetti();
      }
    }, wave * 400);
  }
}

// ========== 再玩一次 ==========
function onReplay() {
  if (typeof stopBGM === 'function') stopBGM();
  var overlay = document.getElementById('winOverlay');
  if (overlay) overlay.classList.add('hidden');
  if (digitsEl) digitsEl.classList.add('hidden');
  if (cakeEl) {
    cakeEl.classList.add('hidden');
    for (var i = 0; i < 4; i++) {
      var flame = document.getElementById('flame' + i);
      if (flame) flame.classList.remove('blown-out');
    }
  }
  if (blowBtn) { blowBtn.classList.add('hidden'); unbindBlowButton(); }
  if (blowPressTimer) { clearTimeout(blowPressTimer); blowPressTimer = null; }
  if (textEl)   textEl.classList.add('hidden');
  if (replayEl) { replayEl.classList.add('hidden'); replayEl.removeEventListener('click', onReplay); }
  if (secretEl) secretEl.classList.add('hidden');
  if (typeof resetGame === 'function') resetGame();
}

/* 入口 */
function triggerSurprise(digits) {
  digitsEl = document.getElementById('surpriseDigits');
  cakeEl   = document.getElementById('surpriseCake');
  textEl   = document.getElementById('surpriseText');
  replayEl = document.getElementById('replayBtn');
  blowBtn  = document.getElementById('blowBtn');
  secretEl = document.getElementById('secretLink');

  if (typeof playFinalWin === 'function') playFinalWin();

  showDigits(digits || ['6', '2', '2'], function () {
    showCake();
  });
}

window.triggerSurprise = triggerSurprise;
