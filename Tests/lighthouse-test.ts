import {writeFileSync} from 'fs';
import puppeteer from 'puppeteer';
import {startFlow, desktopConfig} from 'lighthouse';
import * as throttle from '@sitespeed.io/throttle';
import axios from 'axios';
import dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';
import { log } from 'console';

dotenv.config();

const testApps = [ // Web Apps to test
  {
    name: 'InteractiveServer',
    url: process.env.INTERACTIVE_SERVER_URL!,
  },
  {
    name: 'InteractiveWasm',
    url: process.env.INTERACTIVE_WASM_URL!,
  },
  {
    name: 'InteractiveAuto',
    url: process.env.INTERACTIVE_AUTO_URL!
  }
];

const throttlingConfigurations = [
  // {
  //   name: '3G', // Simulates 3G network conditions
  //   settings: {
  //     "up": 768,
  //     "down": 1600,
  //     "rtt": 150 
  //   }
  // },
  {
    name: '4G', // Simulates 4G network conditions
    settings: {
      "up": 9000,
      "down": 9000,
      "rtt": 85,
    }
  },
  {
    name: 'Wifi', // Simulates wifi network conditions
    settings: {
      "up": 20000,
      "down": 40000,
      "rtt": 30,
    }
  },
  {
    name: 'Wired', // Simulates wired/unthrottled network conditions
    settings: {
      "up": 45000,
      "down": 250000,
      "rtt": 0,
    }
  }
];

for(let a = 0; a < 3; a++) {
  const appToTest = testApps[a];

  for(let b = 0; b < 3; b++) {
    const throttling = throttlingConfigurations[b];

    for(let c = 5; c < 10; c++) {
      const testResult = await runTest(appToTest, throttling);
      
      writeFileSync(`TestResults/${appToTest.name}/${throttling.name}/result${c+1}.json`, JSON.stringify(testResult, null, 2));
    }
  }
}

async function runTest(appInfo:{name:string, url:string}, throttling:{name:string, settings:{}}): Promise<object> {
  // Start sitespeed.io packet-level throttling
  await throttle.start(throttling.settings);

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--window-size=2048,1152`,
    ],
    defaultViewport: null,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const page = (await browser.pages())[0];

  var logs: string[] = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  try {
    const flow = await startFlow(page, {
      config: {
        ...desktopConfig,
        settings: {
          ...desktopConfig.settings,
          throttlingMethod: 'provided',
          throttling: {
            rttMs: 0,
            throughputKbps: 0,
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
            cpuSlowdownMultiplier: 1,
          },
          onlyAudits: [
            'first-contentful-paint',
            'largest-contentful-paint',
            'total-blocking-time',
            'speed-index',
            'cumulative-layout-shift',
            'interaction-to-next-paint',
          ],
        },
      },
      // `flags` will override the Lighthouse emulation settings to prevent Lighthouse from changing the screen dimensions.
      flags: {
        formFactor: 'desktop',
        screenEmulation: {
          disabled: true
        }
      },
    });

    async function clickElement(selector: string) {
      await page.waitForSelector(selector, { visible: true });
      await page.click(selector);
    }

    async function enterTextfield(selector: string, input: string) {
      const searchBox = await page.waitForSelector(selector, { visible: true });
      await searchBox?.type(input);
      await searchBox?.press('Enter');
    }
    // ---------------------------------------------------------------------------------------

    // Phase 1 - Initial load
    await flow.navigate(appInfo.url, { name: 'Initial load', disableStorageReset: false });
    // ---------------------------------------------------------------------------------------

    // Phase 2 - User interaction: INP and Event To DOM update
    await flow.startTimespan({ name: 'User interaction', disableStorageReset: true });

    await page.waitForSelector('[data-blazor-ready="true"]');

    // Interactions - Sorting
    await clickElement('::-p-xpath(//th[.//span[contains(normalize-space(.), "Height")]]//button[@aria-label="Sort"])');
    await page.waitForSelector('::-p-xpath(//tr[5][td[@data-label="X" and normalize-space()="2"] and td[@data-label="Y" and normalize-space()="2"]])');

    await clickElement('::-p-xpath(//th[.//span[contains(normalize-space(.), "Height")]]//button[contains(@class, "mud-direction-asc") and @aria-label="Sort"])');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="51"]])');
    
    await clickElement('::-p-xpath(//th[.//span[contains(normalize-space(.), "Locked In")]]//button[@aria-label="Sort"])');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="7"]])');

    await clickElement('::-p-xpath(//th[.//span[contains(normalize-space(.), "Locked In")]]//button[contains(@class, "mud-direction-asc") and @aria-label="Sort"])');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="1"]])');
    
    await clickElement('::-p-xpath(//th[.//span[contains(normalize-space(.), "Locked In")]]//button[contains(@class, "mud-direction-desc") and @aria-label="Sort"])');
    await page.waitForSelector('::-p-xpath(//tr[4][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="7"]])');

    const sortInteractions = await page.evaluate(() => {
      const entries = performance.getEntriesByName('interaction').map(e => ({
        duration: e.duration
      }));
      performance.clearMeasures('interaction'); // Clear after collecting
      return entries;
    });

    // Interactions - Expanding/Collapsing
    await clickElement('::-p-xpath(//tr[5][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="9"]]//button)');

    await clickElement('::-p-xpath(//tr[7][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="11"]]//button)');
    await page.waitForSelector('::-p-xpath(//tr[9][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="13"]])');

    await clickElement('::-p-xpath(//tr[5][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="9"]]//button)');

    await clickElement('::-p-xpath(//tr[6][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="11"]]//button)');
    await page.waitForSelector('::-p-xpath(//tr[7][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="13"]])');

    const expandInteractions = await page.evaluate(() => {
      const entries = performance.getEntriesByName('interaction').map(e => ({
        duration: e.duration
      }));
      performance.clearMeasures('interaction'); // Clear after collecting
      return entries;
    });


    // Interactions - Filtering by Search
    await enterTextfield('#article-field', 'DemoArticle#206'); // DemoArticle#206 or INSC-240
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="21"]])');

    await clickElement('button[aria-label="Clear"]'); 
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="1"]])');

    await enterTextfield('#order-field', '0808331');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="2"] and td[@data-label="Y" and normalize-space()="6"]])');

    await clickElement('button[aria-label="Clear"]');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="1"]])');

    await enterTextfield('#xpos-field', '8');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="8"] and td[@data-label="Y" and normalize-space()="2"]])');

    await enterTextfield('#ypos-field', '18');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="8"] and td[@data-label="Y" and normalize-space()="18"]])');

    await clickElement('::-p-xpath(//div[input[@id="xpos-field"]]//button[@aria-label="Clear"])');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="2"] and td[@data-label="Y" and normalize-space()="18"]])');

    await clickElement('::-p-xpath(//div[input[@id="ypos-field"]]//button[@aria-label="Clear"])');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="1"]])');
   
    await enterTextfield('#reel-field', '44263631A');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="2"] and td[@data-label="Y" and normalize-space()="6"]])');

    const filteringInteractions = await page.evaluate(() => {
      const entries = performance.getEntriesByName('interaction').map(e => ({
        duration: e.duration
      }));
      performance.clearMeasures('interaction'); // Clear after collecting
      return entries;
    });


    // Interactions - Fetch data from DB
    await moveRoll('44263631A', 2, 4); // Move roll to simulate data change

    await clickElement('#update-button');
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="2"] and td[@data-label="Y" and normalize-space()="4"]])');

    await moveRoll('44263631A', 2, 6); // Move back the roll for next test

    await clickElement('#clear-button'); 
    await page.waitForSelector('::-p-xpath(//tr[1][td[@data-label="X" and normalize-space()="1"] and td[@data-label="Y" and normalize-space()="1"]])');

    const dbFetchInteractions = await page.evaluate(() => {
      const entries = performance.getEntriesByName('interaction').map(e => ({
        duration: e.duration
      }));
      performance.clearMeasures('interaction'); // Clear after collecting
      return entries;
    });

    await flow.endTimespan();
    // ---------------------------------------------------------------------------------------

    // Phase 3 - Second page load: Emulate test of soft navigation - browser cannot measure core web vitals for soft navigations yet (in experimental phase).
    await flow.navigate(appInfo.url + 'high-bay-storage-2', { name: 'Second page load: Emulate test of soft navigation', disableStorageReset: true });
    // ---------------------------------------------------------------------------------------
    

    // GENERATE RESULTS
    // Get the comprehensive flow report.
    //writeFileSync('report.html', await flow.generateReport());
    const flowResult = JSON.parse(JSON.stringify(await flow.createFlowResult(), null, 2));

    const extractedMetrics = {
      testedRenderMode: appInfo.name,
      avgCPUBenchmarkIndex: (
        flowResult.steps[0].lhr.environment.benchmarkIndex + 
        flowResult.steps[1].lhr.environment.benchmarkIndex + 
        flowResult.steps[2].lhr.environment.benchmarkIndex) / 3,
      throttling: {
        name: throttling.name,
        settings: throttling.settings,
      },
      initial_load_metrics: {
        'first-contentful-paint': flowResult.steps[0].lhr.audits['first-contentful-paint'],
        'largest-contentful-paint': flowResult.steps[0].lhr.audits['largest-contentful-paint'],
        'speed-index': flowResult.steps[0].lhr.audits['speed-index'],
        'total-blocking-time': flowResult.steps[0].lhr.audits['total-blocking-time'],
        'cumulative-layout-shift': flowResult.steps[0].lhr.audits['cumulative-layout-shift'],
      },
      user_interaction_metrics: {
        'total-blocking-time': flowResult.steps[1].lhr.audits['total-blocking-time'],
        'interaction-to-next-paint': flowResult.steps[1].lhr.audits['interaction-to-next-paint'],
        'cumulative-layout-shift': flowResult.steps[1].lhr.audits['cumulative-layout-shift'],
      },
      second_load_metrics: {
        'first-contentful-paint': flowResult.steps[2].lhr.audits['first-contentful-paint'],
        'largest-contentful-paint': flowResult.steps[2].lhr.audits['largest-contentful-paint'],
        'total-blocking-time': flowResult.steps[2].lhr.audits['total-blocking-time'],
        'cumulative-layout-shift': flowResult.steps[2].lhr.audits['cumulative-layout-shift'],
      },
      eventToDomUpdate_interactions: {
        sorting: sortInteractions,
        expandCollaps: expandInteractions,
        filtering: filteringInteractions,
        dbFetch: dbFetchInteractions,
      },
      consoleLogs: logs,
    };

    return extractedMetrics;
  } 
  catch(error:any) {
    return {
      testedRenderMode: appInfo.name,
      throttling: {
        name: throttling.name,
        settings: throttling.settings,
      },
      consoleLogs: logs,
      errorMsg: error
    };
  } 
  finally {
    await throttle.stop(); // Stop sitespeed.io packet-level throttling
    await browser.close();
  }
}

async function moveRoll(rollId:string, x:number, y:number) {
  try {
    const response = await axios.put(`${testApps[1].url}api/storage/moveRoll?rollId=${rollId}&x=${x}&y=${y}`);
    console.log(response.data);
  } 
  catch (error) {
    console.error('Error:', error);
  }
}

