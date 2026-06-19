/*
 *  audio.js — 音效引擎
 *  播放 audio/ 文件夹内的真实音频文件
 */

'use strict';

/* 预加载所有音频 */
function preloadAudio(src) {
  var audio = new Audio();
  audio.preload = 'auto';
  audio.src = src;
  /* 静默加载错误 */
  audio.addEventListener('error', function () {
    /* 音频文件缺失不影响游戏 */
  });
  return audio;
}

var sfxClick    = preloadAudio('audio/click.wav');
var sfxCorrect  = preloadAudio('audio/correct.wav');
var sfxWinning  = preloadAudio('audio/winning.wav');
var bgmBirthday = preloadAudio('audio/birthday.mp3');

/* 安全播放：克隆节点避免快速点击时的播放冲突 */
function safePlay(audio) {
  if (!audio || !audio.src) return;
  try {
    /* 对于短音效，克隆一份播放以支持快速连续触发 */
    var clone = audio.cloneNode();
    clone.volume = audio.volume;
    clone.play().catch(function () {});
  } catch (e) {}
}

/* BGM 专用（不克隆，支持 stop） */
function safePlayBGM(audio) {
  if (!audio || !audio.src) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(function () {});
  } catch (e) {}
}

// ========== 音效：点击卡片 ==========
function playClick() {
  sfxClick.volume = 0.6;
  safePlay(sfxClick);
}

// ========== 音效：三消匹配 ==========
function playMatch() {
  sfxCorrect.volume = 0.7;
  safePlay(sfxCorrect);
}

// ========== 音效：关卡通关 ==========
function playLevelClear() {
  sfxWinning.volume = 0.8;
  safePlay(sfxWinning);
}

// ========== 音效：终极庆祝（同关卡通关，BGM单独播） ==========
function playFinalWin() {
  sfxWinning.volume = 0.8;
  safePlay(sfxWinning);
}

// ========== 🎵 生日快乐 BGM ==========
function playBGM() {
  bgmBirthday.volume = 0.5;
  bgmBirthday.currentTime = 0;
  try {
    bgmBirthday.play().catch(function () {});
  } catch (e) {}
}

function stopBGM() {
  try {
    bgmBirthday.pause();
    bgmBirthday.currentTime = 0;
  } catch (e) {}
}

/* 暴露到全局 */
window.playClick      = playClick;
window.playMatch      = playMatch;
window.playLevelClear = playLevelClear;
window.playFinalWin   = playFinalWin;
window.playBGM        = playBGM;
window.stopBGM        = stopBGM;
