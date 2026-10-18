'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { assessMoviePlayback, selectJobs, outputLocations, completedForSelection } = require('./browser.cjs');

const evidence = (overrides = {}) => ({
  actualPlayer: true, userInitiated: true, exactSourceRequestObserved: true,
  observationSeconds: 20, currentTimeAdvanceSeconds: 19.9, decodedFrames: 420,
  fatalErrors: [], significantStalls: 0, environmentLimitations: [],
  restrictions: [], pauseResumeVerified: true, ...overrides,
});
const candidate = (slug = 'fixture-film') => ({
  slug, title: 'Fixture Film', source: { kind: 'file', isLive: false,
    url: `https://archive.org/download/${slug}/${slug}.mp4` },
});

test('a complete normal-player observation with tested pause and resume passes', () => {
  assert.deepEqual(assessMoviePlayback(evidence()), { status: 'passed', outcome: 'played', reason: null });
});

test('network success without decoded sustained playback cannot pass', () => {
  for (const row of [
    evidence({ actualPlayer: false }), evidence({ userInitiated: false }),
    evidence({ exactSourceRequestObserved: false }), evidence({ observationSeconds: 19.9 }),
    evidence({ currentTimeAdvanceSeconds: 0 }), evidence({ decodedFrames: 0 }),
    evidence({ significantStalls: 1 }), evidence({ pauseResumeVerified: false }),
    evidence({ fatalErrors: [{ code: 3 }] }), evidence({ environmentLimitations: ['APP_RUNTIME_ERROR'] }),
  ]) assert.notEqual(assessMoviePlayback(row).status, 'passed');
});

test('a provider refusal is recorded separately from an ordinary decode failure', () => {
  assert.equal(assessMoviePlayback(evidence({ decodedFrames: 0,
    restrictions: [{ statusCode: 403, mediaRelated: true }] })).outcome, 'blocked-or-restricted');
  assert.equal(assessMoviePlayback(evidence({ fatalErrors: [{ code: 3 }] })).outcome, 'failed');
  assert.equal(assessMoviePlayback(evidence({ restrictions: [{ statusCode: 403, mediaRelated: false }] })).status, 'passed');
});

test('batch selection supports exact MP4 and WebM sources and normal movie routes', () => {
  const mp4 = candidate(), webm = candidate('fixture-webm');
  webm.title = 'Fixture WebM';
  webm.source.url = 'https://upload.wikimedia.org/fixture.webm';
  const jobs = selectJobs({ entries: [mp4, webm] });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].route, '/movie/film-archive-fixture-film?watch=1');
  assert.equal(jobs[1].source.url, 'https://upload.wikimedia.org/fixture.webm');
});

test('batch selection refuses duplicates, unsafe sources, arbitrary headers and more than twelve entries', () => {
  assert.throws(() => selectJobs([candidate(), candidate()]));
  assert.throws(() => selectJobs(Array.from({ length: 13 }, (_, index) => candidate(`film-${index}`))));
  assert.throws(() => selectJobs([]));
  for (const url of ['http://archive.org/film.mp4', 'https://u:p@archive.org/film.mp4',
    'https://127.0.0.1/film.mp4', 'https://private.internal/film.mp4', 'https://archive.org/film.mp4?token=secret']) {
    const row = candidate(); row.source.url = url;
    assert.throws(() => selectJobs([row]), url);
  }
  const headerSource = candidate(); headerSource.source.referrer = 'https://archive.org/';
  assert.throws(() => selectJobs([headerSource]));
});

test('output paths remain within the project movie results directory', () => {
  const root = path.resolve(__dirname, '../..');
  assert.equal(outputLocations('data/movies/runs/fixture-batch').report,
    path.join(root, 'data/movies/runs/fixture-batch/results.json'));
  assert.equal(outputLocations('data/movies/runs/fixture-batch/browser.json').report,
    path.join(root, 'data/movies/runs/fixture-batch/browser.json'));
  for (const value of ['../outside', '.tmp/fixture', 'data/live-tv/fixture', 'data/movies/../../escape'])
    assert.throws(() => outputLocations(value), value);
});

test('resuming consumes only completed results for the exact selected slug and URL', () => {
  const jobs = selectJobs([candidate()]);
  const report = { entries: [
    { slug: 'fixture-film', sourceUrl: jobs[0].source.url, status: 'passed', completedAt: '2026-10-14T22:00:00Z' },
    { slug: 'other-film', sourceUrl: jobs[0].source.url, status: 'passed', completedAt: '2026-10-14T22:00:00Z' },
  ] };
  assert.equal(completedForSelection(report, jobs).length, 1);
  report.entries[0].sourceUrl = 'https://archive.org/changed.mp4';
  assert.equal(completedForSelection(report, jobs).length, 0);
  report.entries[0].sourceUrl = jobs[0].source.url;
  report.entries[0].status = 'running';
  assert.equal(completedForSelection(report, jobs).length, 0);
});
