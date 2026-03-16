const STORAGE_KEY = "sec_inventory_tracker_v1";
const LAST_ACTOR_KEY = "sec_inventory_last_actor";

const state = {
  items: [],
  transactions: []
};

const cloud = {
  enabled: false,
  client: null
};

const refs = {
  itemForm: document.getElementById("itemForm"),
  quickActionForm: document.getElementById("quickActionForm"),
  quickActionInput: document.getElementById("quickActionInput"),
  quickActor: document.getElementById("quickActor"),
  transactionForm: document.getElementById("transactionForm"),
  inventoryBody: document.getElementById("inventoryBody"),
  transactionBody: document.getElementById("transactionBody"),
  searchInput: document.getElementById("searchInput"),
  exportBtn: document.getElementById("exportBtn"),
  syncStatus: document.getElementById("syncStatus"),
  viewDashboardBtn: document.getElementById("viewDashboardBtn"),
  viewTrackBtn: document.getElementById("viewTrackBtn"),
  viewItemsBtn: document.getElementById("viewItemsBtn"),
  viewDashboard: document.getElementById("viewDashboard"),
  viewTrack: document.getElementById("viewTrack"),
  viewItems: document.getElementById("viewItems"),
  itemId: document.getElementById("itemId"),
  itemName: document.getElementById("itemName"),
  itemCategory: document.getElementById("itemCategory"),
  itemUnit: document.getElementById("itemUnit"),
  itemQty: document.getElementById("itemQty"),
  itemLocation: document.getElementById("itemLocation"),
  txnItemId: document.getElementById("txnItemId"),
  txnItemSearch: document.getElementById("txnItemSearch"),
  itemNamesList: document.getElementById("itemNamesList"),
  txnType: document.getElementById("txnType"),
  txnQty: document.getElementById("txnQty"),
  txnRequester: document.getElementById("txnRequester"),
  txnNote: document.getElementById("txnNote"),
  txnQuickAdd: document.getElementById("txnQuickAdd"),
  quickName: document.getElementById("quickName"),
  quickCategory: document.getElementById("quickCategory"),
  quickUnit: document.getElementById("quickUnit"),
  quickQty: document.getElementById("quickQty"),
  quickLocation: document.getElementById("quickLocation"),
  dashSearch: document.getElementById("dashSearch"),
  dashCategory: document.getElementById("dashCategory"),
  dashLocation: document.getElementById("dashLocation"),
  dashAvailability: document.getElementById("dashAvailability"),
  dashVisibleCount: document.getElementById("dashVisibleCount"),
  dashCategoryCount: document.getElementById("dashCategoryCount"),
  dashboardGroups: document.getElementById("dashboardGroups"),
  totalItems: document.getElementById("totalItems"),
  totalQuantity: document.getElementById("totalQuantity"),
  todayTransactions: document.getElementById("todayTransactions")
};

const NEW_ITEM_VALUE = "__new_item__";

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function setStatus(message, variant) {
  refs.syncStatus.textContent = message;
  refs.syncStatus.classList.remove("ok", "warn");
  if (variant) refs.syncStatus.classList.add(variant);
}

function initCloud() {
  if (!window.supabase || !window.SUPABASE_CONFIG) {
    setStatus("Local mode", "warn");
    return;
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  const hasConfig =
    url &&
    anonKey &&
    !url.includes("YOUR_SUPABASE_PROJECT_URL") &&
    !anonKey.includes("YOUR_SUPABASE_ANON_KEY");

  if (!hasConfig) {
    setStatus("Local mode", "warn");
    return;
  }

  cloud.client = window.supabase.createClient(url, anonKey);
  cloud.enabled = true;
  setStatus("Cloud sync enabled", "ok");
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.items = Array.isArray(parsed.items) ? parsed.items : [];
    state.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  } catch {
    state.items = [];
    state.transactions = [];
  }
}

async function loadCloudState() {
  const itemsResult = await cloud.client
    .from("items")
    .select("id,name,category,unit,qty,min,location")
    .order("name", { ascending: true });
  if (itemsResult.error) throw itemsResult.error;

  const txResult = await cloud.client
    .from("transactions")
    .select("id,item_id,type,qty,requested_by,note,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (txResult.error) throw txResult.error;

  state.items = (itemsResult.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    qty: Number(row.qty),
    min: Number(row.min),
    location: row.location
  }));

  state.transactions = (txResult.data || []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    qty: Number(row.qty),
    requestedBy: row.requested_by,
    note: row.note || "",
    date: row.created_at
  }));
}

function renderStats() {
  const today = new Date().toISOString().slice(0, 10);
  refs.totalItems.textContent = String(state.items.length);
  refs.totalQuantity.textContent = String(
    state.items.reduce((sum, it) => sum + Number(it.qty || 0), 0)
  );
  refs.todayTransactions.textContent = String(
    state.transactions.filter((tx) => tx.date.startsWith(today)).length
  );
}

function renderItemOptions() {
  refs.txnItemId.innerHTML = "";
  refs.itemNamesList.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select item";
  refs.txnItemId.append(placeholder);

  state.items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = `${item.name} (${item.qty} ${item.unit})`;
    refs.txnItemId.append(opt);

    const nameOpt = document.createElement("option");
    nameOpt.value = item.name;
    refs.itemNamesList.append(nameOpt);
  });

  const createNew = document.createElement("option");
  createNew.value = NEW_ITEM_VALUE;
  createNew.textContent = "+ Add new item";
  refs.txnItemId.append(createNew);

  refs.txnItemId.value = state.items.length === 0 ? NEW_ITEM_VALUE : "";
  toggleQuickAdd();
}

function toTitleCase(value) {
  return String(value || "")
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function findItemByName(name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  return state.items.find((it) => normalizeName(it.name) === normalized) || null;
}

function getActorName(value) {
  const typed = String(value || "").trim();
  if (typed) {
    localStorage.setItem(LAST_ACTOR_KEY, typed);
    return typed;
  }

  const cached = localStorage.getItem(LAST_ACTOR_KEY);
  return cached && cached.trim() ? cached.trim() : "Store Team";
}

function parseQuickCommand(input) {
  const value = String(input || "").trim();
  const matched = value.match(/^(.+?)\s*([+\-=])\s*(\d+)$/);
  if (!matched) return null;

  const itemName = toTitleCase(matched[1]);
  const operator = matched[2];
  const amount = Number(matched[3]);
  if (!itemName || Number.isNaN(amount)) return null;

  if (operator === "+") return { itemName, type: "IN", qty: amount };
  if (operator === "-") return { itemName, type: "OUT", qty: amount };
  return { itemName, type: "ADJUST", qty: amount };
}

async function ensureItemExistsByName(name) {
  const existing = findItemByName(name);
  if (existing) return existing;

  const created = {
    id: uid(),
    name: toTitleCase(name),
    category: "General",
    unit: "pcs",
    qty: 0,
    min: 0,
    location: "Main Store"
  };

  await upsertItem(created);
  return state.items.find((it) => it.id === created.id) || created;
}

function showView(viewName) {
  const dashboard = viewName === "dashboard";
  const track = viewName === "track";
  const items = viewName === "items";

  refs.viewDashboard.classList.toggle("hidden", !dashboard);
  refs.viewTrack.classList.toggle("hidden", !track);
  refs.viewItems.classList.toggle("hidden", !items);

  refs.viewDashboardBtn.classList.toggle("btn-primary", dashboard);
  refs.viewDashboardBtn.classList.toggle("btn-secondary", !dashboard);
  refs.viewTrackBtn.classList.toggle("btn-primary", track);
  refs.viewTrackBtn.classList.toggle("btn-secondary", !track);
  refs.viewItemsBtn.classList.toggle("btn-primary", items);
  refs.viewItemsBtn.classList.toggle("btn-secondary", !items);
}

function toggleQuickAdd() {
  const show = refs.txnItemId.value === NEW_ITEM_VALUE;
  refs.txnQuickAdd.classList.toggle("hidden", !show);
}

function applySmartItemSelection() {
  const typed = refs.txnItemSearch.value;
  const matched = findItemByName(typed);

  if (matched) {
    refs.txnItemId.value = matched.id;
    toggleQuickAdd();
  }
}

function buildQuickItemPayload() {
  const payload = {
    id: uid(),
    name: toTitleCase(refs.quickName.value),
    category: toTitleCase(refs.quickCategory.value),
    unit: refs.quickUnit.value.trim().toLowerCase(),
    qty: Number(refs.quickQty.value || 0),
    min: 0,
    location: toTitleCase(refs.quickLocation.value)
  };

  if (!payload.name || !payload.category || !payload.unit || !payload.location) {
    return null;
  }

  return payload;
}

function renderInventory() {
  const q = refs.searchInput.value.trim().toLowerCase();
  const data = q
    ? state.items.filter((it) =>
        `${it.name} ${it.category} ${it.location}`.toLowerCase().includes(q)
      )
    : state.items;

  refs.inventoryBody.innerHTML = "";
  if (data.length === 0) {
    const row = document.getElementById("emptyState").content.cloneNode(true);
    refs.inventoryBody.append(row);
    return;
  }

  data.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>${item.qty} ${item.unit}</td>
      <td>${item.location}</td>
      <td>
        <div class="actions">
          <button class="small-btn" data-edit="${item.id}">Edit</button>
          <button class="small-btn" data-del="${item.id}">Delete</button>
        </div>
      </td>
    `;
    refs.inventoryBody.append(tr);
  });
}

function getDashboardFilteredItems() {
  const search = refs.dashSearch.value.trim().toLowerCase();
  const category = refs.dashCategory.value;
  const location = refs.dashLocation.value;
  const availability = refs.dashAvailability.value;

  return state.items.filter((it) => {
    const searchMatches = search
      ? `${it.name} ${it.category} ${it.location}`.toLowerCase().includes(search)
      : true;
    const categoryMatches = category ? it.category === category : true;
    const locationMatches = location ? it.location === location : true;
    const availabilityMatches =
      availability === "in-stock"
        ? Number(it.qty) > 0
        : availability === "out-of-stock"
          ? Number(it.qty) <= 0
          : true;

    return searchMatches && categoryMatches && locationMatches && availabilityMatches;
  });
}

function renderDashboardFilters() {
  const categories = [...new Set(state.items.map((it) => it.category).filter(Boolean))].sort();
  const locations = [...new Set(state.items.map((it) => it.location).filter(Boolean))].sort();

  const selectedCategory = refs.dashCategory.value;
  const selectedLocation = refs.dashLocation.value;

  refs.dashCategory.innerHTML = '<option value="">All categories</option>';
  refs.dashLocation.innerHTML = '<option value="">All locations</option>';

  categories.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    refs.dashCategory.append(option);
  });

  locations.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    refs.dashLocation.append(option);
  });

  refs.dashCategory.value = categories.includes(selectedCategory) ? selectedCategory : "";
  refs.dashLocation.value = locations.includes(selectedLocation) ? selectedLocation : "";
}

function renderDashboardGroups() {
  const filtered = getDashboardFilteredItems();
  refs.dashVisibleCount.textContent = `${filtered.length} items shown`;

  const grouped = filtered.reduce((acc, item) => {
    const key = item.category || "Uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const categoryNames = Object.keys(grouped).sort();
  refs.dashCategoryCount.textContent = `${categoryNames.length} categories`;

  refs.dashboardGroups.innerHTML = "";
  if (filtered.length === 0) {
    refs.dashboardGroups.innerHTML =
      '<div class="empty-dashboard">No items match your filters. Try clearing one filter.</div>';
    return;
  }

  categoryNames.forEach((categoryName) => {
    const items = grouped[categoryName].sort((a, b) => a.name.localeCompare(b.name));
    const section = document.createElement("section");
    section.className = "category-card";

    const totalCategoryQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    section.innerHTML = `
      <div class="category-head">
        <h4>${categoryName}</h4>
        <span class="count-pill">${items.length} items | ${totalCategoryQty} total</span>
      </div>
      <ul class="category-list">
        ${items
          .map(
            (item) => `
              <li>
                <div>
                  <div class="item-title">${item.name}</div>
                  <div class="item-meta">${item.location} | ${item.unit}</div>
                </div>
                <span class="qty-pill ${Number(item.qty) <= 0 ? "empty-stock" : ""}">${item.qty}</span>
              </li>
            `
          )
          .join("")}
      </ul>
    `;
    refs.dashboardGroups.append(section);
  });
}

function renderDashboard() {
  renderDashboardFilters();
  renderDashboardGroups();
}

function renderTransactions() {
  const recent = [...state.transactions]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12);

  refs.transactionBody.innerHTML = "";
  if (recent.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="empty" colspan="6">No transactions yet</td>';
    refs.transactionBody.append(tr);
    return;
  }

  recent.forEach((tx) => {
    const item = state.items.find((it) => it.id === tx.itemId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(tx.date).toLocaleString()}</td>
      <td>${item ? item.name : "Deleted item"}</td>
      <td>${tx.type}</td>
      <td>${tx.qty}</td>
      <td>${tx.requestedBy}</td>
      <td>${tx.note || "-"}</td>
    `;
    refs.transactionBody.append(tr);
  });
}

function refresh() {
  renderStats();
  renderItemOptions();
  renderDashboard();
  renderInventory();
  renderTransactions();
}

async function upsertItem(item) {
  if (!cloud.enabled) {
    const idx = state.items.findIndex((it) => it.id === item.id);
    if (idx >= 0) state.items[idx] = item;
    else state.items.push(item);
    saveLocalState();
    return;
  }

  const { error } = await cloud.client.from("items").upsert({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    qty: item.qty,
    min: item.min,
    location: item.location
  });
  if (error) throw error;
  await loadCloudState();
}

async function deleteItem(itemId) {
  if (!cloud.enabled) {
    state.items = state.items.filter((it) => it.id !== itemId);
    saveLocalState();
    return;
  }

  const { error } = await cloud.client.from("items").delete().eq("id", itemId);
  if (error) throw error;
  await loadCloudState();
}

async function recordTransaction(payload) {
  const item = state.items.find((it) => it.id === payload.itemId);
  if (!item) throw new Error("Item not found");

  let nextQty = item.qty;
  if (payload.type === "IN") nextQty = item.qty + payload.qty;
  if (payload.type === "OUT") nextQty = Math.max(0, item.qty - payload.qty);
  if (payload.type === "ADJUST") nextQty = payload.qty;

  if (!cloud.enabled) {
    item.qty = nextQty;
    state.transactions.push({
      id: uid(),
      itemId: payload.itemId,
      type: payload.type,
      qty: payload.qty,
      requestedBy: payload.requestedBy,
      note: payload.note,
      date: new Date().toISOString()
    });
    saveLocalState();
    return;
  }

  const updateResult = await cloud.client
    .from("items")
    .update({ qty: nextQty })
    .eq("id", payload.itemId);
  if (updateResult.error) throw updateResult.error;

  const insertResult = await cloud.client.from("transactions").insert({
    id: uid(),
    item_id: payload.itemId,
    type: payload.type,
    qty: payload.qty,
    requested_by: payload.requestedBy,
    note: payload.note
  });
  if (insertResult.error) throw insertResult.error;

  await loadCloudState();
}

refs.itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    id: refs.itemId.value || uid(),
    name: toTitleCase(refs.itemName.value),
    category: toTitleCase(refs.itemCategory.value),
    unit: refs.itemUnit.value.trim().toLowerCase(),
    qty: Number(refs.itemQty.value),
    min: 0,
    location: toTitleCase(refs.itemLocation.value)
  };

  if (!payload.name || !payload.category || !payload.unit || !payload.location) return;

  try {
    await upsertItem(payload);
    refs.itemForm.reset();
    refs.itemId.value = "";
    refresh();
  } catch (error) {
    console.error(error);
    window.alert("Could not save item. Check Supabase setup.");
  }
});

refs.quickActionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const parsed = parseQuickCommand(refs.quickActionInput.value);
  if (!parsed) {
    window.alert("Use format: Item Name +2, Item Name -1, or Item Name =30");
    return;
  }

  try {
    const item = await ensureItemExistsByName(parsed.itemName);
    const requestedBy = getActorName(refs.quickActor.value);

    await recordTransaction({
      itemId: item.id,
      type: parsed.type,
      qty: parsed.qty,
      requestedBy,
      note: "Quick command"
    });

    refs.quickActionInput.value = "";
    refresh();
  } catch (error) {
    console.error(error);
    window.alert("Could not apply quick command.");
  }
});

refs.transactionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  let itemId = refs.txnItemId.value;
  const type = refs.txnType.value;
  const qty = Number(refs.txnQty.value);
  const requestedBy = getActorName(refs.txnRequester.value);
  const note = refs.txnNote.value.trim();

  if (!itemId || qty <= 0) return;

  try {
    if (itemId === NEW_ITEM_VALUE) {
      const quickItem = buildQuickItemPayload();
      const matchedByName = findItemByName(refs.quickName.value);

      if (matchedByName) {
        itemId = matchedByName.id;
      } else {
        if (!quickItem) {
          window.alert("Fill all quick-add fields to create a new item.");
          return;
        }

        if (type === "OUT") {
          window.alert("New item cannot start with OUT. Use IN or ADJUST.");
          return;
        }

        await upsertItem(quickItem);
        itemId = quickItem.id;
      }
    }

    await recordTransaction({
      itemId,
      type,
      qty,
      requestedBy,
      note
    });
    refs.transactionForm.reset();
    refs.txnItemId.value = "";
    refs.txnItemSearch.value = "";
    toggleQuickAdd();
    refresh();
  } catch (error) {
    console.error(error);
    window.alert("Could not record transaction.");
  }
});

refs.inventoryBody.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const editId = target.dataset.edit;
  const delId = target.dataset.del;

  if (editId) {
    const item = state.items.find((it) => it.id === editId);
    if (!item) return;
    refs.itemId.value = item.id;
    refs.itemName.value = item.name;
    refs.itemCategory.value = item.category;
    refs.itemUnit.value = item.unit;
    refs.itemQty.value = String(item.qty);
    refs.itemLocation.value = item.location;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (delId) {
    const okay = window.confirm("Delete this item and keep transaction history?");
    if (!okay) return;

    try {
      await deleteItem(delId);
      refresh();
    } catch (error) {
      console.error(error);
      window.alert("Could not delete item.");
    }
  }
});

refs.searchInput.addEventListener("input", renderInventory);
refs.txnItemId.addEventListener("change", toggleQuickAdd);
refs.txnItemSearch.addEventListener("input", applySmartItemSelection);
refs.txnItemSearch.addEventListener("change", applySmartItemSelection);

refs.dashSearch.addEventListener("input", renderDashboardGroups);
refs.dashCategory.addEventListener("change", renderDashboardGroups);
refs.dashLocation.addEventListener("change", renderDashboardGroups);
refs.dashAvailability.addEventListener("change", renderDashboardGroups);

refs.viewDashboardBtn.addEventListener("click", () => showView("dashboard"));
refs.viewTrackBtn.addEventListener("click", () => showView("track"));
refs.viewItemsBtn.addEventListener("click", () => showView("items"));

refs.exportBtn.addEventListener("click", () => {
  const rows = [
    ["name", "category", "unit", "qty", "location"],
    ...state.items.map((it) => [
      it.name,
      it.category,
      it.unit,
      it.qty,
      it.location
    ])
  ];

  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `sec_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

async function init() {
  initCloud();
  try {
    if (cloud.enabled) {
      await loadCloudState();
    } else {
      loadLocalState();
    }
  } catch (error) {
    console.error(error);
    setStatus("Cloud error, using local", "warn");
    cloud.enabled = false;
    loadLocalState();
  }
  refs.quickActor.value = localStorage.getItem(LAST_ACTOR_KEY) || "";
  showView("dashboard");
  refresh();
}

init();
