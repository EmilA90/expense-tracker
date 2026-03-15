// server.js
// Main server file for the Expense Tracker application.
// This file sets up an Express server, connects to PostgreSQL using `pg`,
// and exposes a small JSON API used by the frontend.

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create a PostgreSQL connection pool using DATABASE_URL from .env
// Example: DATABASE_URL=postgres://user:password@localhost:5432/expense_tracker
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from the public folder (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Simple helper for basic validation errors
function sendValidationError(res, message) {
  return res.status(400).json({ error: message });
}

// -----------------------------
// API ROUTES
// -----------------------------

// GET /api/categories
// Return all categories (used to populate dropdowns on the frontend).
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories
// Create a new category (useful if you want to add categories from the UI).
app.post('/api/categories', async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return sendValidationError(res, 'Category name is required.');
  }

  const trimmed = name.trim();

  try {
    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name',
      [trimmed]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// GET /api/expenses
// Return all expenses, ordered by expense_date (newest first), then created_at.
app.get('/api/expenses', async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT
          e.id,
          e.title,
          e.amount,
          e.category_id,
          c.name AS category,
          e.expense_date,
          e.expense_type,
          e.created_at
        FROM expenses e
        JOIN categories c ON c.id = e.category_id
        ORDER BY e.expense_date DESC, e.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// POST /api/expenses
// Create a new expense with basic validation.
app.post('/api/expenses', async (req, res) => {
  const { title, amount, category_id, expense_date, expense_type } = req.body;

  // Basic validation checks
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return sendValidationError(res, 'Title is required.');
  }

  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return sendValidationError(res, 'Amount must be a valid number.');
  }

  const numericAmount = Number(amount);
  if (numericAmount <= 0) {
    return sendValidationError(res, 'Amount must be greater than 0.');
  }

  const parsedCategoryId = Number(category_id);
  if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
    return sendValidationError(res, 'Category is required.');
  }

  if (!expense_date) {
    return sendValidationError(res, 'Expense date is required.');
  }

  if (expense_type !== 'one_time' && expense_type !== 'recurring') {
    return sendValidationError(res, "Expense type must be 'one_time' or 'recurring'.");
  }

  try {
    // Ensure category exists (basic integrity check)
    const cat = await pool.query('SELECT id, name FROM categories WHERE id = $1', [parsedCategoryId]);
    if (cat.rowCount === 0) {
      return sendValidationError(res, 'Selected category does not exist.');
    }

    const insertQuery = `
      INSERT INTO expenses (title, amount, category_id, expense_date, expense_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, amount, category_id, expense_date, expense_type, created_at
    `;
    const values = [title.trim(), numericAmount, parsedCategoryId, expense_date, expense_type];

    const result = await pool.query(insertQuery, values);
    const createdExpense = result.rows[0];

    // Return a consistent shape with GET /api/expenses (include category name)
    res.status(201).json({
      ...createdExpense,
      category: cat.rows[0].name,
    });
  } catch (err) {
    console.error('Error creating expense:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// DELETE /api/expenses/:id
// Delete an expense by id.
app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;

  const parsedId = Number(id);
  if (isNaN(parsedId) || parsedId <= 0) {
    return sendValidationError(res, 'Invalid expense id.');
  }

  try {
    const deleteQuery = 'DELETE FROM expenses WHERE id = $1 RETURNING id';
    const result = await pool.query(deleteQuery, [parsedId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// PUT /api/expenses/:id
// Update an existing expense.
app.put('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;
  const { title, amount, category_id, expense_date, expense_type } = req.body;

  const parsedId = Number(id);
  if (isNaN(parsedId) || parsedId <= 0) {
    return sendValidationError(res, 'Invalid expense id.');
  }

  // Reuse basic validation rules from POST
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return sendValidationError(res, 'Title is required.');
  }

  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return sendValidationError(res, 'Amount must be a valid number.');
  }

  const numericAmount = Number(amount);
  if (numericAmount <= 0) {
    return sendValidationError(res, 'Amount must be greater than 0.');
  }

  const parsedCategoryId = Number(category_id);
  if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
    return sendValidationError(res, 'Category is required.');
  }

  if (!expense_date) {
    return sendValidationError(res, 'Expense date is required.');
  }

  if (expense_type !== 'one_time' && expense_type !== 'recurring') {
    return sendValidationError(res, "Expense type must be 'one_time' or 'recurring'.");
  }

  try {
    // Ensure category exists
    const cat = await pool.query('SELECT id, name FROM categories WHERE id = $1', [parsedCategoryId]);
    if (cat.rowCount === 0) {
      return sendValidationError(res, 'Selected category does not exist.');
    }

    const updateQuery = `
      UPDATE expenses
      SET title = $1,
          amount = $2,
          category_id = $3,
          expense_date = $4,
          expense_type = $5
      WHERE id = $6
      RETURNING id, title, amount, category_id, expense_date, expense_type, created_at
    `;
    const values = [title.trim(), numericAmount, parsedCategoryId, expense_date, expense_type, parsedId];

    const result = await pool.query(updateQuery, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const updated = result.rows[0];

    res.json({
      ...updated,
      category: cat.rows[0].name,
    });
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// GET /api/summary/monthly
// Return monthly totals (sum of amount) grouped by year and month.
app.get('/api/summary/monthly', async (req, res) => {
  try {
    const query = `
      SELECT
        EXTRACT(YEAR FROM expense_date) AS year,
        EXTRACT(MONTH FROM expense_date) AS month,
        SUM(amount) AS total_amount
      FROM expenses
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    const result = await pool.query(query);

    const formatted = result.rows.map((row) => ({
      year: Number(row.year),
      month: Number(row.month), // 1-12
      total_amount: Number(row.total_amount),
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching monthly summary:', err);
    res.status(500).json({ error: 'Failed to fetch monthly summary' });
  }
});

// GET /api/summary/category
// Return totals grouped by category.
app.get('/api/summary/category', async (req, res) => {
  try {
    const query = `
      SELECT
        c.name AS category,
        SUM(amount) AS total_amount
      FROM expenses e
      JOIN categories c ON c.id = e.category_id
      GROUP BY c.name
      ORDER BY c.name
    `;

    const result = await pool.query(query);

    const formatted = result.rows.map((row) => ({
      category: row.category,
      total_amount: Number(row.total_amount),
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching category summary:', err);
    res.status(500).json({ error: 'Failed to fetch category summary' });
  }
});

// -----------------------------
// START SERVER
// -----------------------------

// Simple root route (optional, index.html is served from /public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start listening for HTTP requests
app.listen(PORT, () => {
  console.log(`Expense Tracker server running on http://localhost:${PORT}`);
});

