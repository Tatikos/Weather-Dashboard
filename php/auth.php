<?php
/**
 * php/auth.php
 * Handles User Login, Registration, and Sessions.
 */
declare(strict_types=1);
session_start();

header('Content-Type: application/json');

// Load environment variables safely
function loadEnvAuth(): array {
    $base = __DIR__ . '/..';
    foreach (['.env.local', '.env'] as $file) {
        $path = "$base/$file";
        if (file_exists($path)) return parse_ini_file($path);
    }
    return [];
}
$env = loadEnvAuth();

function getDbConnection() {
    global $env;
    $host = $env['DB_HOST'] ?? '';
    if ($host === '') return null; // Local dev fallback
    $conn = @mysqli_connect($host, $env['DB_USER'] ?? '', $env['DB_PASS'] ?? '', $env['DB_NAME'] ?? '');
    return $conn ?: null;
}

$action = $_GET['action'] ?? '';

// --- CHECK SESSION STATUS ---
if ($action === 'status') {
    if (isset($_SESSION['user_name'])) {
        echo json_encode(['logged_in' => true, 'user_name' => $_SESSION['user_name'], 'display_name' => $_SESSION['display_name']]);
    } else {
        echo json_encode(['logged_in' => false]);
    }
    exit;
}

// --- LOGOUT ---
if ($action === 'logout') {
    session_destroy();
    echo json_encode(['status' => 'success']);
    exit;
}

// --- POST REQUESTS (Login & Register) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $conn = getDbConnection();

    if (!$conn) {
        $_SESSION['user_name'] = $data['user_name'] ?? 'local_test';
        $_SESSION['display_name'] = 'Local Dev User';
        echo json_encode(['status' => 'success', 'message' => 'Local fallback login.']);
        exit;
    }

    // --- REGISTER ---
    if ($action === 'register') {
        $user_name = trim($data['user_name'] ?? '');
        $display_name = trim($data['display_name'] ?? '');
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if (!$user_name || !$display_name || !$email || !$password) {
            echo json_encode(['status' => 'error', 'message' => 'All fields required.']);
            exit;
        }

        $hashed_password = password_hash($password, PASSWORD_DEFAULT);

        $stmt = mysqli_prepare($conn, "INSERT INTO registered_users (user_name, display_name, password, email) VALUES (?, ?, ?, ?)");
        mysqli_stmt_bind_param($stmt, 'ssss', $user_name, $display_name, $hashed_password, $email);
        
        if (mysqli_stmt_execute($stmt)) {
            $_SESSION['user_name'] = $user_name;
            $_SESSION['display_name'] = $display_name;
            echo json_encode(['status' => 'success']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Username or email already exists.']);
        }
        mysqli_stmt_close($stmt);
    }

    // --- LOGIN ---
    if ($action === 'login') {
        $user_name = trim($data['user_name'] ?? '');
        $password = $data['password'] ?? '';

        $stmt = mysqli_prepare($conn, "SELECT display_name, password FROM registered_users WHERE user_name = ?");
        mysqli_stmt_bind_param($stmt, 's', $user_name);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $user = mysqli_fetch_assoc($result);

        // Verify the secure hash against the typed password
        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_name'] = $user_name;
            $_SESSION['display_name'] = $user['display_name'];

            // Update last_login timestamp automatically via query
            $updateStmt = mysqli_prepare($conn, "UPDATE registered_users SET last_login = CURRENT_TIMESTAMP WHERE user_name = ?");
            mysqli_stmt_bind_param($updateStmt, 's', $user_name);
            mysqli_stmt_execute($updateStmt);

            echo json_encode(['status' => 'success', 'display_name' => $user['display_name']]);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Invalid username or password.']);
        }
    }
    mysqli_close($conn);
    exit;
}