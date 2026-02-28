<?php
/**
 * php/env.php
 * ───────────
 * Reads the .env file and writes a <script> tag that exposes
 * the public-facing API keys to window.ENV in the browser.
 *
 * Include this at the top of index.html on the CS server:
 *   <?php include 'php/env.php'; ?>
 *
 * Only OWM_KEY, AQICN_KEY, and USERNAME are exposed to the client.
 * DB credentials remain server-side only.
 *
 * NOTE: This file is only needed when running on the CS Apache server
 *       with PHP enabled. For local testing, set window.ENV directly
 *       in src/script.js (clearly marked with a comment).
 */