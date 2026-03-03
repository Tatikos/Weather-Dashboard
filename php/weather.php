<?php
/**
 * php/weather.php
 * ───────────────
 * Middleware between the browser and MySQL (epl425 database).
 *
 * Env file loading priority (first found wins):
 *   1. ../.env.local   ← local dev overrides (gitignored)
 *   2. ../.env         ← shared defaults / production values
 *
 * LOCAL DEV BEHAVIOUR
 * When DB_HOST is blank or the connection fails, the script
 * degrades gracefully instead of returning 500:
 *   POST → responds 201 (silently skipped, not stored)
 *   GET  → responds 200 with an empty JSON array []
 * This lets you test all weather features locally without VPN.
 *
 * Services:
 *   POST  (Content-Type: application/json)  → INSERT into requests
 *   GET   (?username=xxx)                   → SELECT last 5 rows for user
 */

declare(strict_types=1);

/* ── CORS ───────────────────────────────────────────────────── */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/* ── LOAD ENV (local override first) ────────────────────────── */
function loadEnv(): array
{
    $base = __DIR__ . '/..';
    foreach (['.env.local', '.env'] as $file) {
        $path = "$base/$file";
        if (file_exists($path)) {
            $parsed = parse_ini_file($path);
            if ($parsed !== false) {
                return $parsed;
            }
        }
    }
    return [];
}

$env = loadEnv();

$DB_HOST = $env['DB_HOST'] ?? '';
$DB_USER = $env['DB_USER'] ?? '';
$DB_PASS = $env['DB_PASS'] ?? '';
$DB_NAME = $env['DB_NAME'] ?? '';

/* ── DATABASE CONNECTION (nullable — returns null if unavailable) */
function tryConnect(string $host, string $user, string $pass, string $name): ?mysqli
{
    // No host configured → local dev, skip silently
    if ($host === '') {
        return null;
    }
    $conn = @mysqli_connect($host, $user, $pass);
    if (!$conn) {
        return null;
    }
    if (!@mysqli_select_db($conn, $name)) {
        mysqli_close($conn);
        return null;
    }
    return $conn;
}

/* ── ROUTE ───────────────────────────────────────────────────── */
$method = $_SERVER['REQUEST_METHOD'];

/* ════════════════════════════════════════════════════════════
   POST — insert new request row
   ════════════════════════════════════════════════════════════ */
if ($method === 'POST') {

    $body = file_get_contents('php://input');

    if (empty(trim((string)$body))) {
        http_response_code(400);
        echo 'Bad Request: empty body';
        exit;
    }

    $data = json_decode((string)$body, true);
    if ($data === null) {
        http_response_code(400);
        echo 'Bad Request: invalid JSON';
        exit;
    }

    $username = trim($data['username'] ?? '');
    $region   = trim($data['region']   ?? '');
    $city     = trim($data['city']     ?? '');
    $country  = trim($data['country']  ?? 'Cyprus');

    if ($username === '' || $region === '' || $city === '') {
        http_response_code(400);
        echo 'Bad Request: username, region and city are required';
        exit;
    }

    $conn = tryConnect($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

    // DB unavailable locally — skip silently, still return 201
    if ($conn === null) {
        http_response_code(201);
        echo 'Created (local: DB skipped)';
        exit;
    }

    $timestamp = time();
    $address   = "$region, $city, $country";

    $stmt = mysqli_prepare(
        $conn,
        'INSERT INTO requests (username, timestamp, address, region, city, country)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    if (!$stmt) {
        http_response_code(500);
        echo 'Server Error: prepare failed';
        mysqli_close($conn);
        exit;
    }

    mysqli_stmt_bind_param($stmt, 'sissss',
        $username, $timestamp, $address, $region, $city, $country
    );

    if (mysqli_stmt_execute($stmt)) {
        http_response_code(201);
        echo 'Created';
    } else {
        http_response_code(500);
        echo 'Server Error: insert failed';
    }

    mysqli_stmt_close($stmt);
    mysqli_close($conn);
    exit;
}

/* ════════════════════════════════════════════════════════════
   GET — return last 5 requests for a user (JSON)
   ════════════════════════════════════════════════════════════ */
if ($method === 'GET') {

    $username = trim($_GET['username'] ?? '');

    if ($username === '') {
        http_response_code(400);
        echo 'Bad Request: username query parameter is required';
        exit;
    }

    $conn = tryConnect($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

    // DB unavailable locally — return empty array, still 200
    if ($conn === null) {
        header('Content-Type: application/json');
        http_response_code(200);
        echo json_encode([]);
        exit;
    }

    $stmt = mysqli_prepare(
        $conn,
        'SELECT timestamp, region, city, country
         FROM requests
         WHERE username = ?
         ORDER BY timestamp DESC
         LIMIT 5'
    );

    if (!$stmt) {
        http_response_code(500);
        echo 'Server Error: prepare failed';
        mysqli_close($conn);
        exit;
    }

    mysqli_stmt_bind_param($stmt, 's', $username);

    if (!mysqli_stmt_execute($stmt)) {
        http_response_code(500);
        echo 'Server Error: query failed';
        mysqli_stmt_close($stmt);
        mysqli_close($conn);
        exit;
    }

    $result = mysqli_stmt_get_result($stmt);
    $rows   = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $rows[] = $row;
    }

    mysqli_stmt_close($stmt);
    mysqli_close($conn);

    header('Content-Type: application/json');
    http_response_code(200);
    echo json_encode($rows);
    exit;
}

/* ════════════════════════════════════════════════════════════
   Other methods
   ════════════════════════════════════════════════════════════ */
http_response_code(405);
echo 'Method Not Allowed';