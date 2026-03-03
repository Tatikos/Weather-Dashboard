<?php
/**
 * php/proxy.php
 * Secure proxy to hide API keys from the frontend.
 */
declare(strict_types=1);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Load environment variables safely
function loadEnvProxy(): array {
    $base = __DIR__ . '/..';
    foreach (['.env.local', '.env'] as $file) {
        $path = "$base/$file";
        if (file_exists($path)) return parse_ini_file($path);
    }
    return [];
}
$env = loadEnvProxy();

$owmKey = $env['OWM_API_KEY'] ?? '';
$aqicnKey = $env['AQICN_TOKEN'] ?? '';

// Grab the requested service and parameters
$service = $_GET['service'] ?? '';
$lat = $_GET['lat'] ?? '';
$lon = $_GET['lon'] ?? '';
$city = urlencode($_GET['city'] ?? '');
$region = urlencode($_GET['region'] ?? '');

$targetUrl = '';

// Route the request securely
switch ($service) {
    case 'weather':
        $targetUrl = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&units=metric&appid={$owmKey}";
        break;
    case 'forecast':
        $targetUrl = "https://api.openweathermap.org/data/2.5/forecast?lat={$lat}&lon={$lon}&units=metric&appid={$owmKey}";
        break;
    case 'geo':
        $targetUrl = "https://api.openweathermap.org/geo/1.0/direct?q={$city},{$region}&limit=1&appid={$owmKey}";
        break;
    case 'reversegeo':
        $targetUrl = "https://api.openweathermap.org/geo/1.0/reverse?lat={$lat}&lon={$lon}&limit=1&appid={$owmKey}";
        break;
    case 'aqi':
        $targetUrl = "https://api.waqi.info/feed/geo:{$lat};{$lon}/?token={$aqicnKey}";
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid service requested']);
        exit;
}
$context = stream_context_create(['http' => ['ignore_errors' => true]]);
$response = @file_get_contents($targetUrl, false, $context);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch data from upstream API.']);
    exit;
}

echo $response;