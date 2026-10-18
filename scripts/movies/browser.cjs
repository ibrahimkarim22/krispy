'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { existsSync } = require('node:fs');
const ROOT = path.resolve(__dirname, '../..');
const MOVIES = path.join(ROOT, 'data/movies');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const text = value => typeof value === 'string' && value.trim().length > 0;

function publicSource(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')
    || /^(?:(?:\d{1,3}\.){3}\d{1,3}$|\[)/.test(url.hostname)
    || /(?:^|\.)(?:local|localhost|internal|lan|home|test|invalid)$/.test(url.hostname)
    || [...url.searchParams.keys()].some(key => /^(?:token|access_token|auth|authorization|jwt|signature|sig|hdnea|hdnts|policy|key-pair-id|x-amz-.+|expires|exp)$/i.test(key)))
    throw new TypeError('Movie verification requires a public credential-free HTTPS file');
  return url.href;
}

function safeMessage(value) {
  return String(value || '').replace(/https?:\/\/[^\s<>"']+/g, value => {
    try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href; }
    catch { return '[invalid URL]'; }
  }).slice(0, 1500);
}

function sameUrl(left, right) {
  try { return new URL(left).href === new URL(right).href; } catch { return false; }
}

function mediaRelated(url, type, mime = '') {
  return type === 'media' || /^(?:video|audio)\//i.test(mime) || /\.(?:mp4|webm|m4v|mov)(?:[?#]|$)/i.test(url);
}

function assessMoviePlayback(row) {
  const result = (status, reason, outcome = status === 'failed' ? 'failed' : 'inconclusive') => ({ status, outcome, reason });
  if ((row?.restrictions || []).some(item => item.mediaRelated && [401, 403, 451].includes(item.statusCode))
    && (!row.decodedFrames || row.fatalErrors?.length)) return result('failed', 'PROVIDER_ACCESS_RESTRICTION', 'blocked-or-restricted');
  if (!row || row.actualPlayer !== true) return result('inconclusive', 'ACTUAL_PLAYER_NOT_ESTABLISHED');
  if (row.userInitiated !== true) return result('inconclusive', 'GENUINE_PLAY_ACTION_NOT_ESTABLISHED');
  if (row.exactSourceRequestObserved !== true) return result('inconclusive', 'EXACT_SOURCE_GET_NOT_OBSERVED');
  if (row.environmentLimitations?.length) return result('inconclusive', 'BROWSER_ENVIRONMENT_LIMITATION');
  if (!Array.isArray(row.fatalErrors) || row.fatalErrors.length) return result('failed', 'FATAL_PLAYBACK_ERROR');
  if (row.startupTimedOut === true) return result('failed', 'PLAYBACK_STARTUP_TIMEOUT');
  if (!Number.isFinite(row.observationSeconds) || row.observationSeconds < 20) return result('inconclusive', 'OBSERVATION_TOO_SHORT');
  if (!Number.isFinite(row.currentTimeAdvanceSeconds) || row.currentTimeAdvanceSeconds < 10) return result('failed', 'PLAYBACK_CLOCK_DID_NOT_ADVANCE');
  if (!Number.isFinite(row.decodedFrames) || row.decodedFrames <= 0) return result('failed', 'DECODED_FRAMES_NOT_CONFIRMED');
  if (row.significantStalls !== 0) return result('failed', 'SIGNIFICANT_PLAYBACK_STALL');
  if (row.pauseResumeVerified !== true) return result('failed', 'PAUSE_RESUME_NOT_CONFIRMED');
  return { status: 'passed', outcome: 'played', reason: null };
}

function selectJobs(input) {
  const entries = Array.isArray(input) ? input : input?.entries;
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 12)
    throw new TypeError('Select one through twelve movies per browser batch');
  const ids = new Set(), urls = new Set();
  return entries.map(entry => {
    if (!entry || !/^[a-z\d]+(?:-[a-z\d]+)*$/.test(entry.slug || '') || !text(entry.title)
      || entry.source?.kind !== 'file' || entry.source.isLive !== false
      || entry.source.referrer || entry.source.userAgent || entry.source.user_agent || entry.source.headers)
      throw new TypeError('Each candidate requires a stable slug, title and ordinary file source');
    const url = publicSource(entry.source.url);
    if (ids.has(entry.slug) || urls.has(url)) throw new TypeError('Duplicate movie IDs or files are not separate candidates');
    ids.add(entry.slug); urls.add(url);
    return { slug: entry.slug, title: entry.title, source: { ...entry.source },
      route: `/movie/film-archive-${entry.slug}?watch=1` };
  });
}

function outputLocations(value) {
  if (!text(value)) throw new TypeError('--output is required');
  const resolved = path.resolve(ROOT, value), relative = path.relative(MOVIES, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new TypeError('Movie browser artifacts must remain under data/movies');
  const report = resolved.toLowerCase().endsWith('.json') ? resolved : path.join(resolved, 'results.json');
  return { report, directory: path.dirname(report), checkpoint: report.replace(/\.json$/i, '.checkpoint.json') };
}

function completedForSelection(report, jobs) {
  return (report?.entries || []).filter(row => ['passed', 'failed', 'inconclusive'].includes(row.status)
    && text(row.completedAt) && jobs.some(job => job.slug === row.slug && job.source.url === row.sourceUrl));
}

async function sample(video) {
  return video.evaluate(element => {
    const quality = element.getVideoPlaybackQuality?.(), frames = element.webkitDecodedFrameCount;
    return { currentTime: element.currentTime, paused: element.paused, ended: element.ended,
      readyState: element.readyState, frames: Number.isFinite(frames) ? frames
        : quality ? quality.totalVideoFrames - quality.droppedVideoFrames : null,
      frameMethod: Number.isFinite(frames) ? 'webkitDecodedFrameCount' : quality ? 'VideoPlaybackQuality presented frames' : 'unavailable',
      durationSeconds: Number.isFinite(element.duration) ? element.duration : null,
      currentSrc: element.currentSrc, videoWidth: element.videoWidth, videoHeight: element.videoHeight,
      muted: element.muted, volume: element.volume,
      decodedAudioBytes: Number.isFinite(element.webkitAudioDecodedByteCount) ? element.webkitAudioDecodedByteCount : null,
      error: element.error ? { code: element.error.code, message: element.error.message } : null };
  });
}

async function pauseResume(player, video, result) {
  await player.hover({ timeout: 5000 });
  await player.locator('.video-controls').getByRole('button', { name: 'Pause', exact: true }).click({ timeout: 5000 });
  const paused = await sample(video);
  await sleep(2000);
  const settled = await sample(video);
  result.pauseResume = { pauseBefore: paused, pauseAfter: settled,
    pauseConfirmed: settled.paused && Math.abs(settled.currentTime - paused.currentTime) < 0.25 };
  await player.locator('.video-controls').getByRole('button', { name: 'Play', exact: true }).click({ timeout: 5000 });
  await sleep(2000);
  let resumed = await sample(video), deadline = Date.now() + 6000;
  while (Date.now() < deadline && (resumed.paused || resumed.frames <= settled.frames
    || resumed.currentTime - settled.currentTime < 0.5)) { await sleep(500); resumed = await sample(video); }
  result.pauseResume.resumeAfter = resumed;
  result.pauseResume.resumeConfirmed = !resumed.paused && resumed.frames > settled.frames
    && resumed.currentTime - settled.currentTime >= 0.5;
  result.pauseResumeVerified = result.pauseResume.pauseConfirmed && result.pauseResume.resumeConfirmed;
  if (resumed.error) result.fatalErrors.push({ type: 'resume-media-error', ...resumed.error });
}

async function representativeControls(page, player, video, result) {
  result.seek = { status: 'not-attempted' };
  try {
    const seek = player.getByRole('slider', { name: 'Seek', exact: true });
    if (await seek.isEnabled()) {
      const before = await sample(video);
      await seek.focus();
      await seek.press('Home');
      for (let index = 0; index < 3; index += 1) await seek.press('PageUp');
      let after, deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        await sleep(500); after = await sample(video);
        if (after.error || (!after.paused && after.readyState >= 3 && after.frames > before.frames
          && after.currentTime > before.currentTime + 5)) break;
      }
      result.seek = { status: after && !after.error && after.currentTime > before.currentTime + 5
        && after.frames > before.frames ? 'passed' : 'inconclusive',
      method: 'Existing Seek slider: Home then three PageUp keyboard actions', before, after };
      if (after?.error) result.fatalErrors.push({ type: 'seek-media-error', ...after.error });
    } else result.seek = { status: 'unavailable', reason: 'Existing seek control is disabled' };
  } catch (error) { result.seek = { status: 'inconclusive', reason: safeMessage(error.message) }; }
  result.fullscreen = { status: 'not-attempted' };
  try {
    const supported = await page.evaluate(() => Boolean(document.fullscreenEnabled));
    if (!supported) { result.fullscreen = { status: 'unavailable', reason: 'Browser reports fullscreen unavailable' }; return; }
    await player.hover({ timeout: 5000 });
    await player.locator('.video-controls').getByRole('button', { name: 'Enter fullscreen', exact: true }).click({ timeout: 5000 });
    await sleep(500);
    const entered = await page.evaluate(() => Boolean(document.fullscreenElement));
    if (entered) {
      await player.locator('.video-controls').getByRole('button', { name: 'Exit fullscreen', exact: true }).click({ timeout: 5000 });
      await sleep(500);
    }
    const exited = !await page.evaluate(() => Boolean(document.fullscreenElement));
    result.fullscreen = { status: entered && exited ? 'passed' : 'inconclusive', entered, exited,
      method: 'Existing Enter fullscreen and Exit fullscreen controls' };
  } catch (error) { result.fullscreen = { status: 'inconclusive', reason: safeMessage(error.message) }; }
}

async function observe(browser, job, options, representative = false) {
  const result = { slug: job.slug, title: job.title, route: job.route, source: job.source,
    sourceUrl: job.source.url, checkedAt: new Date().toISOString(),
    browser: `Chrome ${browser.version()} / Playwright, normal Krispy movie player`,
    region: 'Local Windows runner; geography not independently verified',
    actualPlayer: false, userInitiated: false, exactSourceRequestObserved: false, pauseResumeVerified: false,
    observationSeconds: 0, currentTimeAdvanceSeconds: 0, decodedFrames: 0, significantStalls: 0,
    samples: [], fatalErrors: [], stallDetails: [], environmentLimitations: [],
    browserErrors: [], networkFailures: [], corsFailures: [], restrictions: [],
    audioAudibility: 'not-confirmed' };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const page = await context.newPage();
  let video;
  try {
    page.on('popup', popup => popup.close().catch(() => {}));
    page.on('request', request => {
      if (request.method() === 'GET' && sameUrl(request.url(), job.source.url)) result.exactSourceRequestObserved = true;
    });
    page.on('pageerror', error => result.environmentLimitations.push(`APPLICATION_RUNTIME_ERROR: ${safeMessage(error.message)}`));
    page.on('console', message => {
      if (!['error', 'warning'].includes(message.type())) return;
      const messageText = safeMessage(message.text());
      if (result.browserErrors.length < 30) result.browserErrors.push({ type: message.type(), message: messageText });
      if (/\bCORS\b|cross-origin request blocked|access-control-allow-origin/i.test(messageText) && result.corsFailures.length < 20)
        result.corsFailures.push({ message: messageText, mediaRelated: /\.(?:mp4|webm|m4v|mov)(?:[?#\s'"]|$)/i.test(messageText) });
    });
    page.on('requestfailed', request => {
      const failure = safeMessage(request.failure()?.errorText), type = request.resourceType();
      if (result.networkFailures.length < 40) result.networkFailures.push({ url: safeMessage(request.url()),
        resourceType: type, failure, mediaRelated: mediaRelated(request.url(), type),
        ignoredForPlayback: /ERR_ABORTED$/.test(failure) || ['image', 'font'].includes(type) });
    });
    page.on('response', response => {
      if (response.status() >= 400 && result.restrictions.length < 40) result.restrictions.push({
        statusCode: response.status(), url: safeMessage(response.url()), resourceType: response.request().resourceType(),
        mediaRelated: mediaRelated(response.url(), response.request().resourceType(), response.headers()['content-type'] || '') });
    });
    await page.goto(options.baseUrl + job.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const player = page.getByRole('region', { name: `${job.title} player`, exact: true });
    await player.waitFor({ timeout: 15000 });
    result.actualPlayer = await player.count() === 1;
    video = player.locator('video');
    await video.waitFor({ timeout: 5000 });
    const startupStarted = Date.now(), deadline = startupStarted + 45000;
    await player.locator('.video-controls').getByRole('button', { name: 'Play', exact: true }).click({ timeout: 10000 });
    result.userInitiated = true;
    result.playAction = 'Krispy existing VideoControls Play click';
    let previous, first;
    while (Date.now() < deadline && !first) {
      const current = await sample(video);
      if (current.error) { result.fatalErrors.push({ type: 'media-error', ...current.error }); break; }
      if (!current.paused && current.readyState >= 3 && current.frames > 0 && previous
        && current.frames > previous.frames && current.currentTime > previous.currentTime + 0.05) first = current;
      previous = current;
      if (!first) await sleep(500);
    }
    if (!first) { result.startupTimedOut = !result.fatalErrors.length; return result; }
    result.startupMs = Date.now() - startupStarted;
    result.actualDurationSeconds = first.durationSeconds;
    result.frameCounter = first.frameMethod;
    const started = Date.now();
    previous = first;
    let stall;
    while (Date.now() - started < 20000) {
      await sleep(Math.min(1000, 20000 - (Date.now() - started)));
      const current = await sample(video), elapsed = (Date.now() - started) / 1000;
      result.samples.push({ atSeconds: Number(elapsed.toFixed(3)), ...current });
      const advance = current.currentTime - previous.currentTime, frames = current.frames - previous.frames;
      if (advance > 0 && advance < 4) result.currentTimeAdvanceSeconds += advance;
      if (frames > 0) result.decodedFrames += frames;
      if (current.error || current.ended) {
        result.fatalErrors.push(current.error ? { type: 'media-error', ...current.error } : { type: 'film-ended-before-observation-completed' });
        break;
      }
      if (advance <= 0.05 || frames <= 0 || current.paused || current.readyState < 3) {
        stall ||= { startSeconds: Math.max(0, elapsed - 1), lastSeconds: elapsed }; stall.lastSeconds = elapsed;
      } else if (stall) {
        if (stall.lastSeconds - stall.startSeconds >= 5) result.stallDetails.push(stall);
        stall = undefined;
      }
      previous = current;
    }
    if (stall && stall.lastSeconds - stall.startSeconds >= 5) result.stallDetails.push(stall);
    result.significantStalls = result.stallDetails.length;
    result.observationSeconds = (Date.now() - started) / 1000;
    if (result.observationSeconds >= 20 && !result.fatalErrors.length && !result.significantStalls) {
      await pauseResume(player, video, result);
      if (representative && result.pauseResumeVerified) await representativeControls(page, player, video, result);
    }
  } catch (error) {
    result.environmentLimitations.push(safeMessage(error.message));
  } finally {
    Object.assign(result, assessMoviePlayback(result));
    result.currentTimeAdvanceSeconds = Number(result.currentTimeAdvanceSeconds.toFixed(3));
    result.observationSeconds = Number(result.observationSeconds.toFixed(3));
    result.completedAt = new Date().toISOString();
    const screenshotPath = path.join(options.directory, `${job.slug}.png`);
    await page.screenshot({ path: screenshotPath, timeout: 10000 }).then(() => {
      result.screenshot = path.relative(ROOT, screenshotPath).split(path.sep).join('/');
    }).catch(() => { result.screenshotUnavailable = true; });
    try {
      const handle = await video?.elementHandle();
      const close = page.getByRole('button', { name: 'Close playback', exact: true });
      if (handle && await close.count()) {
        await close.click({ timeout: 5000 });
        await sleep(250);
        result.cleanupVerified = await handle.evaluate(element => element.paused && !element.hasAttribute('src'));
      }
    } catch (error) { result.cleanupLimitation = safeMessage(error.message); }
    await context.close();
    await fs.writeFile(path.join(options.directory, `${job.slug}.json`), JSON.stringify(result, null, 2) + '\n');
  }
  return result;
}

async function main(args = process.argv.slice(2)) {
  const options = { baseUrl: 'http://127.0.0.1:3001' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--input') options.input = args[++index];
    else if (args[index] === '--output') options.output = args[++index];
    else if (args[index] === '--base-url') options.baseUrl = args[++index];
    else throw new TypeError(`Unknown argument: ${args[index]}`);
  }
  const base = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password
    || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new TypeError('Only a credential-free loopback Krispy server may be tested');
  options.baseUrl = base.origin;
  if (!text(options.input)) throw new TypeError('--input is required');
  const selected = selectJobs(JSON.parse((await fs.readFile(path.resolve(ROOT, options.input), 'utf8')).replace(/^\uFEFF/, '')));
  const locations = outputLocations(options.output);
  Object.assign(options, locations);
  await fs.mkdir(options.directory, { recursive: true });
  const selection = selected.map(job => ({ slug: job.slug, sourceUrl: job.source.url }));
  let existing;
  try { existing = JSON.parse(await fs.readFile(options.report, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing && JSON.stringify(existing.selection) !== JSON.stringify(selection))
    throw new TypeError('Existing output belongs to another selection; choose a new batch directory');
  const report = { schemaVersion: 1, startedAt: existing?.startedAt || new Date().toISOString(),
    status: 'running', baseUrl: options.baseUrl, selection,
    observationSeconds: 20, startupTimeoutMs: 45000, concurrency: 2, retries: 0,
    routeMode: 'Normal Krispy /movie/film-archive-<slug>?watch=1; existing StreamPlayer and VideoControls',
    browserExecutable: existsSync(CHROME) ? CHROME : 'Playwright Chromium',
    entries: completedForSelection(existing, selected) };
  const done = new Set(report.entries.map(row => row.slug)), queue = selected.filter(job => !done.has(job.slug));
  let cursor = 0, browser, writes = Promise.resolve();
  const persist = () => {
    report.entries.sort((left, right) => selected.findIndex(job => job.slug === left.slug) - selected.findIndex(job => job.slug === right.slug));
    report.summary = { selected: selected.length, attempted: report.entries.length,
      remaining: selected.length - report.entries.length,
      played: report.entries.filter(row => row.status === 'passed').length,
      failed: report.entries.filter(row => row.outcome === 'failed').length,
      blockedOrRestricted: report.entries.filter(row => row.outcome === 'blocked-or-restricted').length,
      inconclusive: report.entries.filter(row => row.outcome === 'inconclusive').length };
    const contents = JSON.stringify(report, null, 2) + '\n';
    const checkpoint = JSON.stringify({ schemaVersion: 1, status: report.status, selection,
      completed: report.entries.map(row => ({ slug: row.slug, sourceUrl: row.sourceUrl, status: row.status })),
      updatedAt: new Date().toISOString() }, null, 2) + '\n';
    writes = writes.then(async () => { await fs.writeFile(options.report, contents); await fs.writeFile(options.checkpoint, checkpoint); });
    return writes;
  };
  await persist();
  try {
    if (queue.length) {
      const { chromium } = require('@playwright/test');
      browser = await chromium.launch({ executablePath: existsSync(CHROME) ? CHROME : undefined, headless: true, timeout: 45000 });
      await Promise.all(Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (cursor < queue.length) {
          const job = queue[cursor++], representative = selected.findIndex(row => row.slug === job.slug) < 2;
          const row = await observe(browser, job, options, representative);
          report.entries.push(row);
          await persist();
          console.log(JSON.stringify({ slug: row.slug, outcome: row.outcome, reason: row.reason,
            frames: row.decodedFrames, seconds: row.currentTimeAdvanceSeconds,
            pauseResume: row.pauseResumeVerified, cleanup: row.cleanupVerified }));
        }
      }));
    }
    report.status = 'complete';
  } finally {
    await browser?.close();
    report.completedAt = new Date().toISOString();
    await persist();
    console.log(JSON.stringify({ results: path.relative(ROOT, options.report).split(path.sep).join('/'), summary: report.summary }));
  }
  return report;
}

if (require.main === module) main().catch(error => { console.error(safeMessage(error.message)); process.exitCode = 1; });
module.exports = { assessMoviePlayback, selectJobs, outputLocations, completedForSelection, main, observe };
