<?php
/**
 * php/env_loader.php
 * Exposes the API keys to the browser since the university 
 * firewall blocks server-side API requests.
 */
declare(strict_types=1);
header('Content-Type: application/javascript');

$envPath = __DIR__ . '/../.env';
$env     = file_exists($envPath) ? parse_ini_file($envPath) : [];

$owmKey   = htmlspecialchars($env['OWM_API_KEY'] ?? '', ENT_QUOTES);
$aqicnKey = htmlspecialchars($env['AQICN_TOKEN']  ?? '', ENT_QUOTES);
$username = htmlspecialchars($env['UCY_USERNAME']  ?? '', ENT_QUOTES);

echo "window.ENV = { OWM_KEY: '$owmKey', AQICN_KEY: '$aqicnKey', USERNAME: '$username' };\n";