#!/usr/bin/env node
import { argv, exit } from "node:process";
import { setTimeout as delay } from "node:timers/promises";

function parseArgs() {
  const args = argv.slice(2);
  const result = {
    url: undefined,
    retries: 3,
    interval: 2000
  };

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    switch (token) {
      case "--url":
      case "-u": {
        result.url = args[++i];
        break;
      }
      case "--retries":
      case "-r": {
        result.retries = Number(args[++i] ?? NaN);
        break;
      }
      case "--interval":
      case "-i": {
        result.interval = Number(args[++i] ?? NaN);
        break;
      }
      default: {
        if (!token.startsWith("-")) {
          result.url = token;
        } else {
          console.warn(`Unknown argument: ${token}`);
        }
        break;
      }
    }
  }

  if (!result.url) {
    result.url = process.env.GITHUB_PAGES_URL ?? process.env.PAGES_URL;
  }

  if (!result.url) {
    console.error("No URL provided. Pass --url <https://...> or set GITHUB_PAGES_URL.");
    exit(2);
  }

  if (!Number.isFinite(result.retries) || result.retries < 0) {
    console.warn("Invalid retries value, defaulting to 3.");
    result.retries = 3;
  }

  if (!Number.isFinite(result.interval) || result.interval < 0) {
    console.warn("Invalid interval value, defaulting to 2000ms.");
    result.interval = 2000;
  }

  return result;
}

async function checkOnce(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    return response.status;
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const { url, retries, interval } = parseArgs();
  let attempts = 0;
  while (attempts <= retries) {
    const status = await checkOnce(url);
    if (status && status < 400) {
      console.log(`✅ GitHub Pages responded with status ${status} for ${url}`);
      exit(0);
    }

    attempts += 1;
    if (attempts > retries) {
      console.error(`❌ Unable to reach ${url} after ${attempts} attempt${attempts === 1 ? "" : "s"}.`);
      exit(1);
    }

    console.log(`Attempt ${attempts} failed; retrying in ${interval}ms...`);
    await delay(interval);
  }
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
