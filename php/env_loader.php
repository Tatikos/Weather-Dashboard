<?php
/**
 * php/env_loader.php
 * Only exposes the base UCY_USERNAME now. API keys are strictly 
 * handled server-side by proxy.php.
 */
declare(strict_types=1);
header('Content-Type: application/javascript');

$envPath = __DIR__ . '/../.env';
$env     = file_exists($envPath) ? parse_ini_file($envPath) : [];

$username = htmlspecialchars($env['UCY_USERNAME']  ?? '', ENT_QUOTES);
echo "window.ENV = { USERNAME: '$username' };\n";