<?php
/**
 * FurrGuard - Database Configuration
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 */

class Database {
    private static $instance = null;
    private $connection;

    private $host;
    private $dbname;
    private $username;
    private $password;
    private $charset = 'utf8mb4';

    private function __construct() {
        $this->host = getenv('DB_HOST') ?: '';
        $this->dbname = getenv('DB_NAME') ?: '';
        $this->username = getenv('DB_USERNAME') ?: '';
        $this->password = getenv('DB_PASSWORD') ?: '';

        $maxRetries = 2;
        $retryDelay = 500000; // 0.5s in microseconds

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $dsn = "mysql:host={$this->host};dbname={$this->dbname};charset={$this->charset}";
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_PERSISTENT => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$this->charset} COLLATE utf8mb4_unicode_ci",
                    PDO::ATTR_TIMEOUT => 2
                ];

                $start = microtime(true);
                $this->connection = new PDO($dsn, $this->username, $this->password, $options);
                $elapsed = round((microtime(true) - $start) * 1000, 2);
                error_log("FurrGuard DB: Connected in {$elapsed}ms (attempt {$attempt})");

                // Set strict mode and secure settings (MySQL 5.7/8.0 compatible)
                $this->connection->exec("
                    SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
                    SET SESSION time_zone = '+00:00';
                ");

                // Success - exit retry loop
                return;

            } catch (PDOException $e) {
                $errorMsg = "Database connection failed (attempt {$attempt}): " . $e->getMessage();
                error_log($errorMsg);
                $this->connection = null;

                if ($attempt < $maxRetries) {
                    usleep($retryDelay);
                }
            } catch (Exception $e) {
                error_log("Database init error (attempt {$attempt}): " . $e->getMessage());
                $this->connection = null;

                if ($attempt < $maxRetries) {
                    usleep($retryDelay);
                }
            }
        }
    }

    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    public function getConnection(): ?PDO {
        return $this->connection;
    }

    public function isAlive(): bool {
        if ($this->connection === null) {
            return false;
        }
        try {
            return $this->connection->query('SELECT 1')->fetchColumn() === '1';
        } catch (Exception $e) {
            return false;
        }
    }

    public function getStats(): array {
        if ($this->connection === null) {
            return [];
        }
        try {
            $stats = $this->connection->query('SHOW STATUS')->fetchAll(PDO::FETCH_KEY_PAIR);
            return [
                'connections' => $stats['Threads_connected'] ?? 0,
                'max_connections' => $stats['Max_used_connections'] ?? 0,
                'queries' => $stats['Questions'] ?? 0,
                'uptime' => $stats['Uptime'] ?? 0
            ];
        } catch (Exception $e) {
            return [];
        }
    }

    private function __clone() {}

    public function __wakeup() {
        throw new Exception("Cannot unserialize singleton");
    }

    public function __destruct() {
        $this->connection = null;
    }
}

function db(): ?PDO {
    try {
        $conn = Database::getInstance()->getConnection();
        if ($conn === null) {
            error_log("FurrGuard: Database connection is null");
        }
        return $conn;
    } catch (Exception $e) {
        error_log("FurrGuard: Failed to get database connection: " . $e->getMessage());
        return null;
    }
}
