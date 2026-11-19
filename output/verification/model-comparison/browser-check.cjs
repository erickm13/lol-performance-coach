const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = process.cwd();
const artifactDir = path.join(root, 'output/verification/model-comparison');
const sourceDir = path.join(root, 'output/model-comparison');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'frontend/app/comparacion-modelos/snapshot.json'), 'utf8'));
const checks = [];
const issues = [];
const runtime = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, status: 'passed', ...(detail === undefined ? {} : { detail }) });
  } catch (error) {
    const item = { name, status: 'failed', detail: String(error && error.message || error) };
    checks.push(item);
    issues.push(item);
  }
}

function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function independentlyVerifySources() {
  const prompt = fs.readFileSync(path.join(sourceDir, 'prompt-comun.txt'), 'utf8');
  const inputs = {
    json: fs.readFileSync(path.join(sourceDir, '10-partidas.json'), 'utf8'),
    csv: fs.readFileSync(path.join(sourceDir, '10-partidas.csv'), 'utf8'),
  };
  const sourceMatches = [];
  assert.equal(snapshot.runs.length, 4, 'primary snapshot must contain four complete runs');
  assert.ok(snapshot.runs.every((run) => ['groq', 'ollama'].includes(run.provider) && run.status === 'complete'), 'primary runs must exclude incomplete providers');
  assert.equal(snapshot.attempts.length, 2, 'both Gemini attempts must be represented');
  for (const run of [...snapshot.runs, ...snapshot.attempts]) {
    const metricsFile = path.join(root, run.sources.metrics);
    const rawMetrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
    assert.deepEqual(run.metrics, rawMetrics, `${run.id}: raw metrics differ from snapshot`);
    const data = inputs[run.format];
    const dataHash = sha(data);
    const runnerInput = `${prompt.replace(/(?:\r?\n)*$/, '')}\n\n${data}`;
    assert.equal(run.dataSha256, dataHash, `${run.id}: input data hash mismatch`);
    assert.equal(run.inputSha256, sha(runnerInput), `${run.id}: prompt+data input hash mismatch`);
    assert.equal(rawMetrics.dataSha256, dataHash, `${run.id}: raw metrics data hash mismatch`);
    assert.equal(rawMetrics.inputSha256, sha(runnerInput), `${run.id}: raw metrics input hash mismatch`);
    if (run.sources.answer) {
      const rawAnswer = fs.readFileSync(path.join(root, run.sources.answer), 'utf8');
      assert.equal(run.answer, rawAnswer, `${run.id}: answer differs from original response bytes`);
    } else {
      assert.equal(run.answer, null, `${run.id}: unexpected response for failed attempt`);
    }
    sourceMatches.push(run.id);
  }

  const rows = JSON.parse(inputs.json);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const knownEarlyDeaths = rows.map((row) => row.muertes_antes_10).filter(Number.isFinite);
  const kdas = rows.map((row) => (row.kills + row.assists) / Math.max(row.deaths, 1));
  const kdaMean = mean(kdas);
  const kdaSd = Math.sqrt(mean(kdas.map((value) => (value - kdaMean) ** 2)));
  const computed = {
    csMin: mean(rows.map((row) => row.cs_min)),
    kpPct: mean(rows.map((row) => row.kp_pct)),
    kdaPerMatch: kdaMean,
    earlyDeathsMean: mean(knownEarlyDeaths),
    earlyDeathsKnown: knownEarlyDeaths.length,
    earlyDeathsOverOne: knownEarlyDeaths.filter((value) => value > 1).length,
    kdaPopulationCv: kdaSd / kdaMean,
  };
  assert.equal(computed.csMin, 5.41);
  assert.equal(computed.kpPct, 49.1);
  assert.equal(Number(computed.kdaPerMatch.toFixed(2)), snapshot.referenceMetrics.kdaPerMatch);
  assert.equal(computed.earlyDeathsMean, snapshot.referenceMetrics.earlyDeathsMean);
  assert.equal(computed.earlyDeathsKnown, snapshot.referenceMetrics.earlyDeathsKnown);
  assert.equal(computed.earlyDeathsOverOne, 4);
  assert.ok(computed.kdaPopulationCv > 0.6 && computed.kdaPopulationCv < 0.7);
  return { sourceMatches, computed };
}

async function main() {
  await check('Raw API metrics, answers, prompt/data hashes, and independent numerical reference', independentlyVerifySources);

  const browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    const errors = { page: [], console: [], failedRequests: [], badResponses: [], requests: [] };
    page.on('pageerror', (error) => errors.page.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.console.push(message.text()); });
    page.on('requestfailed', (request) => errors.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('request', (request) => errors.requests.push({ url: request.url(), method: request.method() }));
    page.on('response', (response) => { if (response.status() >= 400) errors.badResponses.push({ url: response.url(), status: response.status() }); });

    const response = await page.goto('http://localhost:3000/comparacion-modelos', { waitUntil: 'networkidle' });
    const status = response?.status() ?? null;
    const measurements = await page.evaluate(() => {
      const rect = (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, right: box.right, width: box.width, height: box.height };
      };
      const groups = [...document.querySelectorAll('.comparison-switch')];
      const controls = [...document.querySelectorAll('.comparison-switch button')].map((element) => ({ text: element.textContent.trim(), ...rect(element) }));
      const charts = [...document.querySelectorAll('.chart-card')].map((element) => ({ title: element.querySelector('strong')?.textContent.trim(), ...rect(element), rows: element.querySelectorAll('.chart-row').length }));
      return {
        url: window.location.href,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        title: document.querySelector('h1')?.innerText,
        charts,
        controls,
        formatGroupCount: groups.length,
        runRows: document.querySelectorAll('.runs-table tbody tr').length,
        runRowText: [...document.querySelectorAll('.runs-table tbody tr')].map((element) => element.innerText),
        auditRowText: [...document.querySelectorAll('.audit-table tbody tr')].map((element) => element.innerText),
        auditColumns: document.querySelectorAll('.audit-table thead th').length,
        localTablesScrollable: [...document.querySelectorAll('.table-scroll')].map((element) => ({ client: element.clientWidth, scroll: element.scrollWidth })),
        chartImageLabels: [...document.querySelectorAll('.chart-rows[role="img"]')].map((element) => element.getAttribute('aria-label')),
      };
    });
    runtime.push({ viewport, status, measurements, errors });
    const key = `${viewport.width}px page and network behavior`;
    await check(`${key}: route, no horizontal page overflow, charts and controls visible`, () => {
      assert.equal(status, 200, 'route did not return HTTP 200');
      assert.equal(measurements.url, 'http://localhost:3000/comparacion-modelos', 'route redirected away from the public page');
      assert.ok(measurements.title?.includes('Una misma tarea'), 'page heading is missing');
      assert.equal(measurements.documentWidth, viewport.width, `document width ${measurements.documentWidth} exceeds viewport ${viewport.width}`);
      assert.equal(measurements.bodyWidth, viewport.width, `body width ${measurements.bodyWidth} exceeds viewport ${viewport.width}`);
      assert.equal(measurements.runRows, 4, 'runs table does not show exactly four primary complete runs');
      for (const run of snapshot.runs) {
        const row = measurements.runRowText.find((value) => value.includes(run.requestedModel) && value.includes(run.format.toUpperCase()));
        assert.ok(row, `${run.id}: run table row missing`);
        assert.ok(row.includes(run.inputTokens.toLocaleString('es-ES')) && row.includes(run.outputTokens.toLocaleString('es-ES')), `${run.id}: token counts are not rendered from source`);
        assert.ok(row.includes((run.requestElapsedWallMs / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 })), `${run.id}: request seconds are not rendered from source`);
      }
      assert.equal(measurements.charts.length, 2, 'expected two primary charts');
      assert.ok(measurements.charts.every((chart) => chart.rows === 4 && chart.width > 0 && chart.height > 0), 'chart rows missing or chart clipped');
      assert.ok(measurements.controls.every((control) => control.x >= 0 && control.right <= viewport.width + 1 && control.width > 0), 'a format/material button is clipped');
      assert.ok(measurements.chartImageLabels.every((label) => label && label.includes('groq') && label.includes('ollama') && !label.includes('gemini')), 'chart accessible labels include wrong run scope');
      assert.ok(measurements.chartImageLabels[0].includes('4,004 s') && measurements.chartImageLabels[0].includes('3,998 s') && measurements.chartImageLabels[0].includes('60,195 s') && measurements.chartImageLabels[0].includes('46,325 s'), 'request-time chart values differ from source metrics');
      assert.ok(measurements.chartImageLabels[1].includes('1612 tokens') && measurements.chartImageLabels[1].includes('815 tokens') && measurements.chartImageLabels[1].includes('1798 tokens') && measurements.chartImageLabels[1].includes('848 tokens'), 'input-token chart values differ from source metrics');
      if (viewport.width <= 600) assert.ok(measurements.localTablesScrollable.some((item) => item.scroll > item.client), 'mobile tables must remain accessible through internal horizontal scrolling');
      assert.ok(errors.requests.every((request) => new URL(request.url).origin === 'http://localhost:3000'), 'browser made a request outside the local frontend origin');
      assert.equal(errors.page.length, 0, `page errors: ${errors.page.join('; ')}`);
      assert.equal(errors.badResponses.filter((item) => item.status >= 500).length, 0, 'frontend returned a 5xx response');
      assert.equal(errors.failedRequests.length, 0, `failed requests: ${JSON.stringify(errors.failedRequests)}`);
    }, { status, measurements, errors });
    await page.screenshot({ path: path.join(artifactDir, `page-${viewport.width}.png`), fullPage: true });

    if (viewport.width === 1440) {
      await check('Accessible source controls, answers, provenance, Gemini attempts, and keyboard activation', async () => {
        const formatGroup = page.getByRole('group', { name: 'Formato de entrada' });
        const materialGroup = page.getByRole('group', { name: 'Material de entrada' });
        const csvButton = formatGroup.getByRole('button', { name: 'CSV' });
        await csvButton.focus();
        await page.keyboard.press('Enter');
        assert.equal(await csvButton.getAttribute('aria-pressed'), 'true');
        await materialGroup.getByRole('button', { name: 'Datos CSV' }).click();
        const dataSource = page.locator('.input-source');
        assert.ok((await dataSource.innerText()).includes('10-partidas.csv'), 'CSV control did not display CSV source');
        assert.ok((await dataSource.locator('pre').innerText()).includes('M01,Garen,TOP'), 'CSV input contents are not shown');
        const csvAnswers = await page.locator('.answer-text').allTextContents();
        for (const run of snapshot.runs.filter((item) => item.format === 'csv')) assert.ok(csvAnswers.includes(run.answer), `${run.id} answer not shown exactly`);

        await formatGroup.getByRole('button', { name: 'JSON' }).click();
        await materialGroup.getByRole('button', { name: 'Datos JSON' }).click();
        assert.ok((await dataSource.innerText()).includes('10-partidas.json'), 'JSON control did not display JSON source');
        assert.ok((await dataSource.locator('pre').innerText()).includes('"id": "M01"'), 'JSON input contents are not shown');
        const jsonAnswers = await page.locator('.answer-text').allTextContents();
        for (const run of snapshot.runs.filter((item) => item.format === 'json')) assert.ok(jsonAnswers.includes(run.answer), `${run.id} answer not shown exactly`);

        const sourceSummary = page.locator('.source-details summary').first();
        await sourceSummary.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.source-details').first().getAttribute('open'), '');
        const sourceText = await page.locator('.source-details').first().innerText();
        assert.ok(sourceText.includes('SHA-256 del prompt') && sourceText.includes('SHA-256 de datos'), 'source hashes are not accessible');

        const auditText = await page.locator('.audit-table').innerText();
        for (const displayedValue of ['5,41', '49,1%', '3,13', '1,50 · n=8', '5,31', '48,10%', '3,09', '4,92', '49,90%', '2,84', '1,67 · n=9']) {
          assert.ok(auditText.includes(displayedValue), `manual arithmetic table missing or misrounding ${displayedValue}`);
        }
        assert.ok(!/score|puntuaci[oó]n global/i.test(auditText), 'arithmetic check is presented as an overall quality score');

        const attemptText = await page.locator('.attempts-box').innerText();
        assert.ok(attemptText.includes('HTTP 503') && attemptText.includes('incompleto / truncado'), 'failed and incomplete Gemini attempts not surfaced');
        assert.ok(!(await page.locator('.runs-table').innerText()).includes('Gemini'), 'Gemini attempt incorrectly appears in complete runs table');
        assert.ok((await page.locator('.timing-note').innerText()).includes('no un efecto causal'), 'request vs model load / causal caveat is missing');

        const attemptSummary = page.locator('.attempt-details summary');
        await attemptSummary.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.attempt-details').getAttribute('open'), '');
        const provenanceSummary = page.locator('.provenance-details summary');
        await provenanceSummary.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.provenance-details').getAttribute('open'), '');
        assert.equal(await page.locator('.provenance-list > div').count(), 4, 'provenance does not expose four primary runs');
        return 'CSV/JSON switches, exact answers, keyboard details, hashes, Gemini attempt states, and timing caveat verified';
      });
    }
    await page.close();
  }
  await browser.close();

  fs.writeFileSync(path.join(artifactDir, 'browser-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), checks, runtime }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.filter((item) => item.status === 'passed').length, failed: issues.length, issues, artifacts: ['browser-results.json', 'page-1440.png', 'page-390.png', 'page-320.png'] }, null, 2));
  if (issues.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
