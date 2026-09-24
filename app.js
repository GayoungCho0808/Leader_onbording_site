import { db } from "./firebaseClient.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const SESSION_KEY = "onboarding_employee_id";
const GUIDE_CATEGORIES = ["시스템 사용법", "규정", "복리후생", "기타"];
let activeGuideCategory = "전체";

const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");
const loginForm = document.getElementById("login-form");
const loginInput = document.getElementById("employee-id-input");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const userBadge = document.getElementById("user-badge");
const logoutBtn = document.getElementById("logout-btn");

let currentEmployeeId = null;
let cachedGuides = [];
let cachedContacts = [];
let cachedChecklistItems = [];
let checkedItemIds = new Set();

// 관리자가 콘텐츠를 바꾸면 팀장 화면에 새로고침 없이 실시간으로 반영되도록
// onSnapshot 리스너를 걸어두고, 로그아웃 시 한 번에 해제합니다.
let unsubscribers = [];
function track(unsub) {
  unsubscribers.push(unsub);
}
function clearSubscriptions() {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
}

// ---------- 인증 ----------
async function verifyEmployeeId(id) {
  const ref = doc(db, "allowedEmployees", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { employee_id: id, name: snap.data().name || null };
}

async function enterSite(id, name) {
  currentEmployeeId = id;
  sessionStorage.setItem(SESSION_KEY, id);
  loginView.classList.add("hidden");
  mainView.classList.remove("hidden");
  userBadge.textContent = name ? `${name} 팀장님` : `사번 ${id}`;

  subscribeNotices();
  subscribeComparison();
  subscribeGuides();
  subscribeContacts();
  await subscribeChecklist();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = loginInput.value.trim();
  loginError.classList.add("hidden");
  if (!id) return;

  loginBtn.disabled = true;
  loginBtn.textContent = "확인 중...";
  try {
    const record = await verifyEmployeeId(id);
    if (!record) {
      loginError.textContent = "미등록 사번입니다. 조직문화팀으로 문의해주세요.";
      loginError.classList.remove("hidden");
      return;
    }
    await enterSite(record.employee_id, record.name);
  } catch (err) {
    console.error(err);
    loginError.textContent = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "입장하기";
  }
});

logoutBtn.addEventListener("click", () => {
  clearSubscriptions();
  sessionStorage.removeItem(SESSION_KEY);
  currentEmployeeId = null;
  mainView.classList.add("hidden");
  loginView.classList.remove("hidden");
  loginInput.value = "";
});

// ---------- 자동 로그인 (세션 유지) ----------
(async function restoreSession() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved) return;
  try {
    const record = await verifyEmployeeId(saved);
    if (record) await enterSite(record.employee_id, record.name);
  } catch {
    /* 무시하고 로그인 화면 유지 */
  }
})();

// ---------- 공지사항 (실시간) ----------
function subscribeNotices() {
  const q = query(collection(db, "notices"), orderBy("createdAt", "desc"), limit(5));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderNotices(items);
    },
    (err) => console.error("notices listener error", err)
  );
  track(unsub);
}
function renderNotices(items) {
  const wrap = document.getElementById("notice-list");
  wrap.innerHTML = items.length
    ? items
        .map((n) => {
          const created = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
          return `
      <div class="border-l-2 border-[var(--accent)] pl-4 py-1">
        <p class="text-sm font-medium text-[var(--ink)]">${escapeHtml(n.title)}</p>
        <p class="text-sm text-slate-500 mt-0.5">${escapeHtml(n.content)}</p>
        <p class="text-xs text-slate-400 mt-1">${created.toLocaleDateString("ko-KR")}</p>
      </div>`;
        })
        .join("")
    : `<p class="text-sm text-slate-400">등록된 공지사항이 없습니다.</p>`;
}

// ---------- Before / After 비교 (실시간) ----------
function subscribeComparison() {
  const q = query(collection(db, "comparisonItems"), orderBy("orderIndex", "asc"));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderComparison(items);
    },
    (err) => console.error("comparison listener error", err)
  );
  track(unsub);
}
function renderComparison(items) {
  const wrap = document.getElementById("comparison-list");
  wrap.innerHTML = items.length
    ? items
        .map(
          (row) => `
      <div class="grid grid-cols-[auto,1fr,1fr] gap-0 border-b border-slate-100 last:border-0">
        <div class="py-4 pr-4 flex items-center text-sm font-semibold text-[var(--ink)] w-28 shrink-0">${escapeHtml(
          row.category
        )}</div>
        <div class="py-4 pr-4">
          <p class="text-xs text-slate-400 mb-1">팀원일 때</p>
          <p class="text-sm text-slate-600">${escapeHtml(row.beforeText)}</p>
        </div>
        <div class="py-4 pl-4 border-l border-slate-100">
          <p class="text-xs text-[var(--accent)] font-medium mb-1">팀장이 된 후</p>
          <p class="text-sm text-[var(--ink)] font-medium">${escapeHtml(row.afterText)}</p>
        </div>
      </div>`
        )
        .join("")
    : `<p class="text-sm text-slate-400">등록된 비교 항목이 없습니다.</p>`;
}

// ---------- 온보딩 가이드 (카테고리 필터, 실시간) ----------
function subscribeGuides() {
  const q = query(collection(db, "guides"), orderBy("orderIndex", "asc"));
  const unsub = onSnapshot(
    q,
    (snap) => {
      cachedGuides = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderGuideCategoryFilter();
      renderGuideList();
    },
    (err) => console.error("guides listener error", err)
  );
  track(unsub);
}
function renderGuideCategoryFilter() {
  const wrap = document.getElementById("guide-category-filter");
  const cats = ["전체", ...GUIDE_CATEGORIES];
  wrap.innerHTML = cats
    .map((cat) => {
      const active = cat === activeGuideCategory;
      return `<button data-cat="${escapeHtml(cat)}"
      class="guide-cat-chip whitespace-nowrap px-3 py-1.5 rounded-full border text-sm transition-colors ${
        active
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "bg-white/60 text-slate-500 border-slate-200 hover:border-[var(--accent)]"
      }">${escapeHtml(cat)}</button>`;
    })
    .join("");
  wrap.querySelectorAll(".guide-cat-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeGuideCategory = btn.dataset.cat;
      renderGuideCategoryFilter();
      renderGuideList();
    });
  });
}
function renderGuideList() {
  const wrap = document.getElementById("guide-list");
  let items = cachedGuides;
  if (activeGuideCategory !== "전체") {
    items = items.filter((g) => (g.category || "기타") === activeGuideCategory);
  }
  wrap.innerHTML = items.length
    ? items
        .map(
          (g) => `
      <details class="group border border-slate-200 rounded-lg open:border-[var(--accent)] transition-colors">
        <summary class="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3">
          <span class="flex items-center gap-2 min-w-0">
            <span class="shrink-0 text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 rounded-full px-2 py-0.5">${escapeHtml(
              g.category || "기타"
            )}</span>
            <span class="font-medium text-[var(--ink)] truncate">${escapeHtml(g.title)}</span>
          </span>
          <span class="shrink-0 text-slate-400 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
        </summary>
        <div class="px-5 pb-5 text-sm text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(
          g.content
        )}</div>
      </details>`
        )
        .join("")
    : `<p class="text-sm text-slate-400">해당 카테고리에 등록된 가이드가 없습니다.</p>`;
}

// ---------- 담당자 찾기 (실시간 + 검색) ----------
function subscribeContacts() {
  const q = query(collection(db, "contacts"), orderBy("orderIndex", "asc"));
  const unsub = onSnapshot(
    q,
    (snap) => {
      cachedContacts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderContactList(document.getElementById("contact-search-input").value);
    },
    (err) => console.error("contacts listener error", err)
  );
  track(unsub);
}
function renderContactList(searchText = "") {
  const wrap = document.getElementById("contact-list");
  const q = searchText.trim().toLowerCase();
  let items = cachedContacts;
  if (q) {
    items = items.filter((c) =>
      [c.taskArea, c.name, c.department].some((v) => (v || "").toLowerCase().includes(q))
    );
  }
  wrap.innerHTML = items.length
    ? items
        .map(
          (c) => `
      <div class="px-5 py-4 flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-medium text-[var(--ink)]">${escapeHtml(c.taskArea)}</p>
          <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(c.department)} · ${escapeHtml(c.name)}</p>
        </div>
        <div class="text-right shrink-0 text-xs text-slate-500 space-y-0.5">
          <p>${escapeHtml(c.phone || "-")}</p>
          <p class="text-[var(--accent)]">${escapeHtml(c.email || "-")}</p>
        </div>
      </div>`
        )
        .join("")
    : `<p class="text-sm text-slate-400 px-5 py-4">검색 결과가 없습니다.</p>`;
}
document.getElementById("contact-search-input").addEventListener("input", (e) => {
  renderContactList(e.target.value);
});

// ---------- 체크리스트 (D+1 / D+7 / D+30, 항목은 실시간·진행상태는 로그인 시 1회 조회) ----------
async function subscribeChecklist() {
  const progressQuery = query(
    collection(db, "checklistProgress"),
    where("employeeId", "==", currentEmployeeId)
  );
  const progressSnap = await getDocs(progressQuery);
  checkedItemIds = new Set(
    progressSnap.docs.filter((d) => d.data().checked).map((d) => d.data().itemId)
  );

  const q = query(collection(db, "checklistItems"), orderBy("orderIndex", "asc"));
  const unsub = onSnapshot(
    q,
    (snap) => {
      cachedChecklistItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderChecklist();
    },
    (err) => console.error("checklist listener error", err)
  );
  track(unsub);
}

function renderChecklist() {
  const items = cachedChecklistItems;
  let total = items.length;
  let done = 0;

  ["D1", "D7", "D30"].forEach((phase) => {
    const container = document.getElementById(`checklist-${phase}`);
    const phaseItems = items.filter((i) => i.phase === phase);
    if (phaseItems.length === 0) {
      container.innerHTML = `<p class="text-sm text-slate-400">등록된 과제가 없습니다.</p>`;
      return;
    }
    container.innerHTML = phaseItems
      .map((item) => {
        const checked = checkedItemIds.has(item.id);
        if (checked) done++;
        return `
        <label class="flex items-start gap-3 py-2.5 cursor-pointer group">
          <input type="checkbox" data-item-id="${item.id}"
            class="checklist-checkbox mt-0.5 h-5 w-5 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
            ${checked ? "checked" : ""} />
          <span class="text-sm text-slate-700 group-has-[:checked]:text-slate-400 group-has-[:checked]:line-through">${escapeHtml(
            item.title
          )}</span>
        </label>`;
      })
      .join("");
  });

  updateProgressBar(total, done);

  document.querySelectorAll(".checklist-checkbox").forEach((box) => {
    box.addEventListener("change", async (e) => {
      const itemId = e.target.getAttribute("data-item-id");
      const checked = e.target.checked;
      if (checked) checkedItemIds.add(itemId);
      else checkedItemIds.delete(itemId);

      const docId = `${currentEmployeeId}__${itemId}`;
      try {
        await setDoc(
          doc(db, "checklistProgress", docId),
          {
            employeeId: currentEmployeeId,
            itemId,
            checked,
            checkedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error(err);
      }
      const totalChecked = document.querySelectorAll(".checklist-checkbox:checked").length;
      updateProgressBar(cachedChecklistItems.length, totalChecked);
    });
  });
}
function updateProgressBar(total, done) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById("progress-bar").style.width = `${pct}%`;
  document.getElementById("progress-text").textContent = `${done} / ${total} 완료 (${pct}%)`;
}

// ---------- 탭 전환 ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("tab-active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("tab-active");
    document.getElementById(btn.dataset.target).classList.remove("hidden");
  });
});

// ---------- 유틸 ----------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
