-- ── Contract Management System Database Schema ─────────────────────────
-- MySQL Schema

CREATE DATABASE IF NOT EXISTS contract_management;
USE contract_management;

CREATE TABLE IF NOT EXISTS contracts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contract_name VARCHAR(255) NOT NULL,
    party_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'Active',
    file_path VARCHAR(512) NOT NULL,
    signature_path VARCHAR(512) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexing for faster search (optional but recommended) ─────────────
CREATE INDEX idx_contract_name ON contracts(contract_name);
CREATE INDEX idx_party_name ON contracts(party_name);
