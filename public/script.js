// script.js
// Frontend logic for the Expense Tracker app.
// This file uses the Fetch API to talk to the Express backend and
// dynamically updates the UI.

// Store all expenses in memory so we can filter them on the client side.
let allExpenses = [];

// Store categories so we can render dropdowns and filters.
let categories = [];

// Track which expense (if any) is being edited.
let editingExpenseId = null;

// Utility: format amounts as AZN currency.
// Uses the built-in Intl API (no extra libraries needed).
function formatMoneyAZN(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('az-AZ', {
    style: 'currency',
    currency: 'AZN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

// Utility: format a date (YYYY-MM-DD) into a nicer string.
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString();
}

// Fetch all expenses from the API and store them in allExpenses.
async function fetchExpenses() {
  try {
    const res = await fetch('/api/expenses');
    if (!res.ok) {
      throw new Error('Failed to fetch expenses');
    }
    allExpenses = await res.json();
    renderExpenses();
  } catch (error) {
    console.error(error);
  }
}

// Fetch categories from the API and populate dropdowns.
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) {
      throw new Error('Failed to fetch categories');
    }
    categories = await res.json();
    renderCategoryOptions();
  } catch (error) {
    console.error(error);
  }
}

// Render category options in the "Add Expense" dropdown and the filter dropdown.
function renderCategoryOptions() {
  const categorySelect = document.getElementById('category');
  const filterSelect = document.getElementById('filter-category');
  const categoryList = document.getElementById('category-list');

  // Keep the first default option (Select category / All)
  categorySelect.innerHTML = '<option value="">Select category</option>';
  filterSelect.innerHTML = '<option value="">All</option>';
  if (categoryList) categoryList.innerHTML = '';

  categories.forEach((cat) => {
    const opt1 = document.createElement('option');
    opt1.value = String(cat.id); // category_id
    opt1.textContent = cat.name;
    categorySelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = String(cat.id);
    opt2.textContent = cat.name;
    filterSelect.appendChild(opt2);

    // Also render a small "chip" list inside the Manage Categories panel (if present).
    if (categoryList) {
      const li = document.createElement('li');
      li.textContent = cat.name;
      categoryList.appendChild(li);
    }
  });
}

// Fetch monthly summary totals from the API and render them.
async function fetchMonthlySummary() {
  try {
    const res = await fetch('/api/summary/monthly');
    if (!res.ok) {
      throw new Error('Failed to fetch monthly summary');
    }
    const data = await res.json();
    renderMonthlySummary(data);
  } catch (error) {
    console.error(error);
  }
}

// Fetch category summary totals from the API and render them.
async function fetchCategorySummary() {
  try {
    const res = await fetch('/api/summary/category');
    if (!res.ok) {
      throw new Error('Failed to fetch category summary');
    }
    const data = await res.json();
    renderCategorySummary(data);
  } catch (error) {
    console.error(error);
  }
}

// Apply filters to allExpenses and return a filtered list.
function getFilteredExpenses() {
  const categoryFilter = document.getElementById('filter-category').value;
  const monthFilter = document.getElementById('filter-month').value; // format: "YYYY-MM"
  const typeFilter = document.getElementById('filter-type').value;

  return allExpenses.filter((expense) => {
    let matches = true;

    if (categoryFilter && String(expense.category_id) !== String(categoryFilter)) {
      matches = false;
    }

    if (typeFilter && expense.expense_type !== typeFilter) {
      matches = false;
    }

    if (monthFilter) {
      // Turn "YYYY-MM" into year and month and compare.
      const [year, month] = monthFilter.split('-');
      const expenseDate = new Date(expense.expense_date);
      const sameYear = expenseDate.getFullYear().toString() === year;
      const sameMonth = (expenseDate.getMonth() + 1).toString().padStart(2, '0') === month;
      if (!sameYear || !sameMonth) {
        matches = false;
      }
    }

    return matches;
  });
}

// Render the expenses table from filtered expenses.
function renderExpenses() {
  const tbody = document.getElementById('expenses-body');
  const emptyState = document.getElementById('expenses-empty');
  const filteredTotalEl = document.getElementById('filtered-total');
  const filtered = getFilteredExpenses();

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
  }

  // Update filtered total summary
  if (filteredTotalEl) {
    const total = filtered.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    filteredTotalEl.textContent = `Filtered total: ${formatMoneyAZN(total)}`;
  }

  filtered.forEach((expense) => {
    const tr = document.createElement('tr');

    const titleTd = document.createElement('td');
    titleTd.textContent = expense.title;

    const amountTd = document.createElement('td');
    amountTd.textContent = formatMoneyAZN(expense.amount);

    const categoryTd = document.createElement('td');
    categoryTd.textContent = expense.category;

    const dateTd = document.createElement('td');
    dateTd.textContent = formatDate(expense.expense_date);

    const typeTd = document.createElement('td');
    typeTd.textContent = expense.expense_type === 'recurring' ? 'Recurring' : 'One-time';

    const actionsTd = document.createElement('td');

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'btn-ghost btn-small';
    editBtn.style.marginRight = '0.25rem';
    editBtn.addEventListener('click', () => {
      enterEditMode(expense);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'btn-danger btn-small';
    deleteBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this expense?')) {
        deleteExpense(expense.id);
      }
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(titleTd);
    tr.appendChild(amountTd);
    tr.appendChild(categoryTd);
    tr.appendChild(dateTd);
    tr.appendChild(typeTd);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  });
}

// Render monthly summary list.
function renderMonthlySummary(data) {
  const list = document.getElementById('monthly-summary');
  list.innerHTML = '';

  if (!data || data.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No data yet.';
    list.appendChild(li);
    return;
  }

  data.forEach((item) => {
    const li = document.createElement('li');
    // item.year: number (e.g. 2026), item.month: number (1-12)
    const monthDate = new Date(item.year, item.month - 1, 1);
    const label = monthDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
    });

    const left = document.createElement('span');
    left.textContent = label;

    const right = document.createElement('span');
    right.textContent = formatMoneyAZN(item.total_amount);

    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

// Render category summary list.
function renderCategorySummary(data) {
  const list = document.getElementById('category-summary');
  list.innerHTML = '';

  if (!data || data.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No data yet.';
    list.appendChild(li);
    return;
  }

  data.forEach((item) => {
    const li = document.createElement('li');

    const left = document.createElement('span');
    left.textContent = item.category;

    const right = document.createElement('span');
    right.textContent = formatMoneyAZN(item.total_amount);

    li.appendChild(left);
    li.appendChild(right);
    list.appendChild(li);
  });
}

// Switch the form into "edit mode" for a given expense.
function enterEditMode(expense) {
  editingExpenseId = expense.id;

  document.getElementById('title').value = expense.title;
  document.getElementById('amount').value = Number(expense.amount);
  document.getElementById('category').value = String(expense.category_id);
  document.getElementById('expense_type').value = expense.expense_type;

  // Ensure date is in YYYY-MM-DD (in case backend sends something else)
  const dateInput = document.getElementById('expense_date');
  const date = new Date(expense.expense_date);
  if (!Number.isNaN(date.getTime())) {
    const iso = date.toISOString().split('T')[0];
    dateInput.value = iso;
  }

  const formTitle = document.getElementById('form-title');
  const submitButton = document.getElementById('submit-button');
  const cancelButton = document.getElementById('cancel-edit-button');
  const indicator = document.getElementById('edit-indicator');

  formTitle.textContent = 'Edit Expense';
  submitButton.textContent = 'Update Expense';
  if (cancelButton) cancelButton.style.display = 'inline-block';
  if (indicator) indicator.style.display = 'inline-flex';

  // Scroll to the form so the user sees it.
  document.getElementById('expense-form').scrollIntoView({ behavior: 'smooth' });
}

// Reset form back to "add mode".
function exitEditMode() {
  editingExpenseId = null;

  const form = document.getElementById('expense-form');
  form.reset();

  const today = new Date();
  const isoToday = today.toISOString().split('T')[0];
  document.getElementById('expense_date').value = isoToday;

  const formTitle = document.getElementById('form-title');
  const submitButton = document.getElementById('submit-button');
  const cancelButton = document.getElementById('cancel-edit-button');
  const indicator = document.getElementById('edit-indicator');

  formTitle.textContent = 'Add New Expense';
  submitButton.textContent = 'Add Expense';
  if (cancelButton) cancelButton.style.display = 'none';
  if (indicator) indicator.style.display = 'none';
}

// Handle form submission to add or update an expense.
async function handleFormSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const errorEl = document.getElementById('form-error');
  errorEl.textContent = '';

  const title = document.getElementById('title').value.trim();
  const amount = document.getElementById('amount').value;
  const category_id = document.getElementById('category').value;
  const expense_date = document.getElementById('expense_date').value;
  const expense_type = document.getElementById('expense_type').value;

  // Very simple client-side validation. The server also validates.
  if (!title || !amount || !category_id || !expense_date || !expense_type) {
    errorEl.textContent = 'Please fill in all fields.';
    return;
  }

  const payload = {
    title,
    amount: Number(amount),
    category_id: Number(category_id),
    expense_date,
    expense_type,
  };

  const isEditing = editingExpenseId !== null;
  const url = isEditing ? `/api/expenses/${editingExpenseId}` : '/api/expenses';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error || 'Failed to add expense.';
      return;
    }

    const savedExpense = await res.json();

    if (isEditing) {
      // Replace in local list
      allExpenses = allExpenses.map((exp) =>
        exp.id === savedExpense.id ? savedExpense : exp
      );
      exitEditMode();
    } else {
      allExpenses.unshift(savedExpense);
      form.reset();
      // restore today's date
      const today = new Date();
      const isoToday = today.toISOString().split('T')[0];
      document.getElementById('expense_date').value = isoToday;
    }

    renderExpenses();
    // Also refresh summaries.
    fetchMonthlySummary();
    fetchCategorySummary();
  } catch (error) {
    console.error(error);
    errorEl.textContent = 'An unexpected error occurred.';
  }
}

// Handle adding a new category.
async function handleCategorySubmit(event) {
  event.preventDefault();

  const input = document.getElementById('new-category-name');
  const errorEl = document.getElementById('category-error');
  errorEl.textContent = '';

  const name = input.value.trim();
  if (!name) {
    errorEl.textContent = 'Please enter a category name.';
    return;
  }

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error || 'Failed to add category.';
      return;
    }

    input.value = '';
    await fetchCategories(); // refresh dropdowns
  } catch (error) {
    console.error(error);
    errorEl.textContent = 'An unexpected error occurred.';
  }
}

// Delete an expense by id and refresh data.
async function deleteExpense(id) {
  try {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      alert('Failed to delete expense.');
      return;
    }

    // Remove from local list and re-render.
    allExpenses = allExpenses.filter((e) => e.id !== id);
    renderExpenses();
    // Refresh summaries.
    fetchMonthlySummary();
    fetchCategorySummary();
  } catch (error) {
    console.error(error);
    alert('An unexpected error occurred.');
  }
}

// Initialize the app when the DOM is ready.
function init() {
  const form = document.getElementById('expense-form');
  form.addEventListener('submit', handleFormSubmit);

  const categoryForm = document.getElementById('category-form');
  categoryForm.addEventListener('submit', handleCategorySubmit);

  const cancelEditButton = document.getElementById('cancel-edit-button');
  cancelEditButton.addEventListener('click', exitEditMode);

  // Re-render expenses whenever filters change.
  document.getElementById('filter-category').addEventListener('change', renderExpenses);
  document.getElementById('filter-month').addEventListener('change', renderExpenses);
  document.getElementById('filter-type').addEventListener('change', renderExpenses);

  // Set default date to today.
  const dateInput = document.getElementById('expense_date');
  const today = new Date();
  const isoToday = today.toISOString().split('T')[0];
  dateInput.value = isoToday;

  // Initial data load.
  fetchCategories();
  fetchExpenses();
  fetchMonthlySummary();
  fetchCategorySummary();
}

document.addEventListener('DOMContentLoaded', init);

