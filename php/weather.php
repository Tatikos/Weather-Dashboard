<?php
/**
 * php/weather.php
 * ───────────────
 * Middleware between the browser and MySQL (epl425 database).
 *
 * Reads credentials from ../.env via parse_ini_file() so that
 * sensitive values are NEVER hard-coded in source code.
 *
 * Services:
 *   POST  (Content-Type: application/json)
 *   GET   (?username=xxx)                   
 */