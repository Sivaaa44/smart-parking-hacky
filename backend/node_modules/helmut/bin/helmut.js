#!/usr/bin/env node

const
  puppeteer = require('puppeteer')
  ,fs = require('fs')
  ,path = require('path')
  ,sanitize = require("sanitize-filename")
  ,chalk = require('chalk')
;

let cfgName = process.argv.length >= 3 ? process.argv[2] : 'photo-session';
let cfgJSON = fs.readFileSync(`${cfgName}.json`, 'utf8');
let cfg = JSON.parse(cfgJSON);
if (!('baseURL' in cfg))
  cfg.baseURL = '';

shoot(cfg);

async function shoot(cfg) {
  let shootsDir = sanitize(cfgName + '@' + new Date().toISOString(), {replacement: '-'});
  fs.mkdirSync(shootsDir);
  console.log(`Shoots directory: ${chalk.bold(shootsDir)}`);

  const browser = await puppeteer.launch();
  console.log(`Browser version: ${chalk.bold(await browser.version())}`);
  console.log(`User Agent: ${chalk.bold(await browser.userAgent())}`);
  
  const page = await browser.newPage();
  page.on('load', console.log.bind(console, 'page loaded'));
  let screenshotParams = {fullPage: true};

  let startTime = process.hrtime();
  for (let relURL of cfg.pages) {
    let url = cfg.baseURL + relURL;
    console.log('loading ' + chalk.bold(url) + '...');
    await page.goto(url);

    let pageTitle = await page.title();
      
    for (let vp of cfg.viewports) {
      await page.setViewport({ width: vp[0], height: vp[1] });

      let filename = `${sanitize(pageTitle, {replacement: '-'})}@${vp[0]}.jpg`;
      screenshotParams.path = path.join(shootsDir, filename);
      console.log(`${filename}`);
  
      await page.screenshot(screenshotParams);
    }
  }

  printElapsedTime(process.hrtime(startTime));

  await browser.close();
}

function printElapsedTime(diff) {
  console.log(`Shooting time: ${chalk.bold(diff[0] + diff[1] / 1e9)}s`);
}
