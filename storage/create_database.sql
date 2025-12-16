-- SQL script to create database and user for Aave dataset storage
-- Run this as the postgres superuser: psql -U postgres -f create_database.sql

-- Create database
CREATE DATABASE aave_dataset;

-- Create user
CREATE USER aave_user WITH PASSWORD 'aave_dataset_password_2024';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aave_dataset TO aave_user;

-- Connect to the new database
\c aave_dataset

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO aave_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO aave_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO aave_user;

-- Output success message
\echo 'Database aave_dataset and user aave_user created successfully!'
\echo 'Remember to update storage/.env with the password: aave_dataset_password_2024'

