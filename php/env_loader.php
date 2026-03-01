<?php
/**
 * php/env_loader.php
 * ───────────
 * Reads the .env file and outputs pure JavaScript to expose
 * the public-facing API keys to window.ENV in the browser.
 */

declare(strict_types=1);

header('Content-Type: application/javascript');

// Look for the .env file one folder up (in the root directory)
$envPath = __DIR__ . '/../.env';
$env     = file_exists($envPath) ? parse_ini_file($envPath) : [];

// Safely grab the variables and prevent XSS
$owmKey   = htmlspecialchars($env['OWM_API_KEY'] ?? '', ENT_QUOTES);
$aqicnKey = htmlspecialchars($env['AQICN_TOKEN']  ?? '', ENT_QUOTES);
$username = htmlspecialchars($env['UCY_USERNAME']  ?? '', ENT_QUOTES);

echo "window.ENV = { OWM_KEY: '$owmKey', AQICN_KEY: '$aqicnKey', USERNAME: '$username' };\n";