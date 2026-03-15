-- schema.sql
-- This file creates the PostgreSQL schema for the Expense Tracker app.

-- Categories table (separate table so you can manage categories in the DB)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
-- Note: category is stored as a foreign key (category_id) instead of text.
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  category_id INT NOT NULL REFERENCES categories(id),
  expense_date DATE NOT NULL,
  expense_type TEXT CHECK (expense_type IN ('one_time', 'recurring')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: some starter categories (safe to run multiple times)
INSERT INTO categories (name)
VALUES ('Food'), ('Transport'), ('Housing'), ('Entertainment'), ('Utilities'), ('Health'), ('Other')
ON CONFLICT (name) DO NOTHING;

