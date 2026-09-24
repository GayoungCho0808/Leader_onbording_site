import { auth, db } from "./firebaseClient.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const GUIDE_CATEGORIES = ["시스템 사용법", "규정", "복리후생", "기타"];

const loginView = document.getElementById("admin-login-view");
const dashView = document.getElementById("admin-dash-view");
const loginForm = document.getElementById("admin-login-form");
const loginError = document.getElementById("admin-login-error");
const logoutBtn = document.getElementById("admin-logout-btn");

// ---------- 관리자 인증 (Firebase Authentication: 이메일/비밀번호) ----------
// 관리자 계정은 Firebase 콘솔 > Authentication > Users에서 미리 생성해둡니다.

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "아이디 또는 비밀번호가 올바르지 않습니다.";
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

onAuthStateChanged(auth, (user) => {
  if (user) showDashboard();
});

async function showDashboard() {
  loginView.classList.add("hidden");
  dashView.classList.remove("hidden");
  await Promise.all([
    loadEmployees(),
    loadGuides(),
    loadNotices(),
    loadComparison(),
    loadChecklistItems(),
    loadContacts(),
  ]);
}

// ---------- 새로 추가된 행으로 스크롤 + 하이라이트 ----------
function focusNewRow(id) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-row-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[var(--accent-lime)]");
    setTimeout(() => el.classList.remove("ring-2", "ring-[var(--accent-lime)]"), 1500);
  });
}

// ============================================================
// 0. 최초 배포 시 샘플 데이터 채우기
// ============================================================
document.getElementById("seed-data-btn").addEventListener("click", async () => {
  if (!confirm("가이드·공지·Before/After·체크리스트·담당자·샘플 사번 데이터를 채워넣을까요?\n이미 등록된 데이터가 있어도 별도 항목으로 추가됩니다.")) return;

  const btn = document.getElementById("seed-data-btn");
  btn.disabled = true;
  btn.textContent = "채우는 중...";

  try {
    const batch = writeBatch(db);

    // 사번 (문서 ID = 사번)
    [
      { id: "10023", name: "김지현" },
      { id: "10045", name: "박서준" },
    ].forEach((e) => batch.set(doc(db, "allowedEmployees", e.id), { name: e.name, addedAt: serverTimestamp() }));

    // 공지사항
    [
      { title: "9월 신임 팀장 오리엔테이션 안내", content: "9/30(수) 14시, 대강당에서 진행됩니다. 전원 참석 바랍니다." },
      { title: "팀장 평가 가이드 업데이트", content: "2026년 하반기 평가 가이드가 개정되었습니다. 가이드 탭에서 확인하세요." },
    ].forEach((n) => batch.set(doc(collection(db, "notices")), { ...n, createdAt: serverTimestamp() }));

    // Before/After
    [
      { category: "결재 권한", beforeText: "지출 결의 없음, 상신만 가능", afterText: "팀 예산 내 1차 결재권 보유", orderIndex: 1 },
      { category: "채용 프로세스", beforeText: "면접관으로 참여", afterText: "채용 요청 및 최종 후보 선정 권한", orderIndex: 2 },
      { category: "평가", beforeText: "피평가자", afterText: "HR 시스템에서 팀원 1차 평가 입력", orderIndex: 3 },
      { category: "회의체", beforeText: "팀 회의 참석", afterText: "파트장 회의 및 경영 보고 참석", orderIndex: 4 },
    ].forEach((c) => batch.set(doc(collection(db, "comparisonItems")), c));

    // 가이드
    [
      { title: "팀장의 첫 1:1 미팅 가이드", content: "첫 1:1은 평가가 아닌 관계 형성의 자리입니다. 팀원의 업무 히스토리와 커리어 목표를 먼저 듣는 것을 권장합니다.", category: "기타", orderIndex: 1 },
      { title: "예산 결재 시스템 사용법", content: "ERP > 예산관리 > 결재함에서 상신된 지출 건을 확인하고 승인/반려할 수 있습니다.", category: "시스템 사용법", orderIndex: 2 },
      { title: "팀 목표(OKR) 작성 가이드", content: "분기 시작 2주 전까지 팀 OKR 초안을 작성해 상위 리더와 얼라인해야 합니다.", category: "기타", orderIndex: 3 },
      { title: "팀장 리더십 역량 교육 신청 방법", content: "사내 교육 포털 > 리더십 과정에서 분기별 필수 교육을 신청할 수 있습니다. 미이수 시 분기 평가에 반영됩니다.", category: "복리후생", orderIndex: 4 },
      { title: "팀장 전용 건강검진 안내", content: "팀장 보임 후 3개월 이내 종합검진을 1회 지원합니다. 복지 포털 > 건강검진 예약에서 신청하세요.", category: "복리후생", orderIndex: 5 },
      { title: "인사평가 규정", content: "팀장은 반기별로 팀원에 대한 1차 평가자 역할을 수행합니다. 평가 등급 분포와 이의제기 절차는 인사규정 제12조를 따릅니다.", category: "규정", orderIndex: 6 },
      { title: "경비 집행 규정", content: "팀 예산 내 건당 100만원 이하는 팀장 전결, 초과 건은 본부장 결재가 필요합니다.", category: "규정", orderIndex: 7 },
    ].forEach((g) => batch.set(doc(collection(db, "guides")), { ...g, updatedAt: serverTimestamp() }));

    // 담당자
    [
      { taskArea: "예산/결재 시스템 문의", department: "재무팀", name: "이수민", phone: "02-1234-5601", email: "smlee@company.com", orderIndex: 1 },
      { taskArea: "채용/조직 개편", department: "인사팀", name: "정하윤", phone: "02-1234-5612", email: "hyjung@company.com", orderIndex: 2 },
      { taskArea: "평가 제도/이의제기", department: "인사팀", name: "오세훈", phone: "02-1234-5615", email: "shoh@company.com", orderIndex: 3 },
      { taskArea: "복리후생/건강검진", department: "조직문화팀", name: "김나연", phone: "02-1234-5623", email: "nykim@company.com", orderIndex: 4 },
      { taskArea: "리더십 교육 신청", department: "인재개발팀", name: "박도윤", phone: "02-1234-5630", email: "dypark@company.com", orderIndex: 5 },
      { taskArea: "사내 시스템(ERP/HR) 오류", department: "IT지원팀", name: "최지안", phone: "02-1234-5640", email: "jachoi@company.com", orderIndex: 6 },
    ].forEach((c) => batch.set(doc(collection(db, "contacts")), { ...c, updatedAt: serverTimestamp() }));

    // 체크리스트
    [
      { phase: "D1", title: "HR 시스템에서 팀장 권한 승인 확인", orderIndex: 1 },
      { phase: "D1", title: "팀원 1:1 미팅 일정 공지", orderIndex: 2 },
      { phase: "D7", title: "팀 목표(OKR) 초안 작성", orderIndex: 1 },
      { phase: "D7", title: "전체 팀원과 1:1 미팅 완료", orderIndex: 2 },
      { phase: "D30", title: "분기 예산 검토", orderIndex: 1 },
      { phase: "D30", title: "상위 리더와 30일 회고 미팅", orderIndex: 2 },
    ].forEach((c) => batch.set(doc(collection(db, "checklistItems")), c));

    await batch.commit();
    alert("샘플 데이터를 채워넣었습니다.");
    await showDashboard();
  } catch (err) {
    console.error(err);
    alert("샘플 데이터 생성 실패: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "샘플 데이터 채우기";
  }
});

// ============================================================
// 1. 사번(접속 권한) 관리
// ============================================================
async function loadEmployees() {
  const tbody = document.getElementById("employee-table-body");
  const snap = await getDocs(collection(db, "allowedEmployees"));
  const rows = snap.docs.map((d) => ({ employee_id: d.id, ...d.data() }));

  document.getElementById("employee-count").textContent = `총 ${rows.length}명`;
  tbody.innerHTML = rows
    .map(
      (row) => `
      <tr class="border-b border-slate-100">
        <td class="py-2.5 pr-4 text-sm font-mono">${escapeHtml(row.employee_id)}</td>
        <td class="py-2.5 pr-4 text-sm">${escapeHtml(row.name || "-")}</td>
        <td class="py-2.5 text-right">
          <button class="text-xs text-red-500 hover:underline" data-del-emp="${row.employee_id}">삭제</button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-del-emp]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(`사번 ${btn.dataset.delEmp} 를 삭제할까요?`)) return;
      await deleteDoc(doc(db, "allowedEmployees", btn.dataset.delEmp));
      loadEmployees();
    });
  });

  const deleteAllBtn = document.getElementById("employee-delete-all-btn");
  deleteAllBtn.classList.toggle("opacity-40", rows.length === 0);
  deleteAllBtn.classList.toggle("pointer-events-none", rows.length === 0);
}

document.getElementById("employee-delete-all-btn").addEventListener("click", async () => {
  const snap = await getDocs(collection(db, "allowedEmployees"));
  const total = snap.size;
  if (total === 0) return;

  if (
    !confirm(
      `등록된 사번 ${total}건을 전체 삭제할까요?\n이 작업은 되돌릴 수 없으며, 삭제된 사번의 팀장은 더 이상 로그인할 수 없습니다.`
    )
  )
    return;
  const typed = prompt(`정말 진행하려면 "전체삭제"를 입력해주세요.`);
  if (typed !== "전체삭제") {
    if (typed !== null) alert("입력값이 일치하지 않아 취소되었습니다.");
    return;
  }

  try {
    // Firestore 배치는 1건당 최대 500개 쓰기까지 가능. 500건씩 나눠서 삭제.
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = writeBatch(db);
      docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    loadEmployees();
    alert("사번 목록을 전체 삭제했습니다.");
  } catch (err) {
    alert("삭제 실패: " + err.message);
  }
});

document.getElementById("employee-add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const idInput = document.getElementById("employee-id-field");
  const nameInput = document.getElementById("employee-name-field");
  const id = idInput.value.trim();
  if (!id) return;
  try {
    await setDoc(
      doc(db, "allowedEmployees", id),
      { name: nameInput.value.trim() || null, addedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    alert("등록 실패: " + err.message);
  }
  idInput.value = "";
  nameInput.value = "";
  loadEmployees();
});

document.getElementById("employee-bulk-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const textarea = document.getElementById("employee-bulk-field");
  const tokens = textarea.value.split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
  if (tokens.length === 0) return;
  const rows = tokens
    .map((t) => {
      const [id, name] = t.split(":").map((v) => (v || "").trim());
      return { employee_id: id, name: name || null };
    })
    .filter((row) => row.employee_id);

  try {
    const batch = writeBatch(db);
    rows.forEach((r) =>
      batch.set(
        doc(db, "allowedEmployees", r.employee_id),
        { name: r.name, addedAt: serverTimestamp() },
        { merge: true }
      )
    );
    await batch.commit();
    alert(`${rows.length}건 등록 완료`);
  } catch (err) {
    alert("일괄 등록 실패: " + err.message);
  }
  textarea.value = "";
  loadEmployees();
});

// ---------- 엑셀 / CSV 업로드로 일괄 등록 ----------
document.getElementById("employee-excel-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const status = document.getElementById("employee-excel-status");
  if (!file) return;

  if (typeof XLSX === "undefined") {
    status.textContent = "엑셀 처리 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.";
    status.className = "text-xs text-red-500";
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

    if (!rows.length) {
      status.textContent = "파일에서 데이터를 찾지 못했습니다.";
      status.className = "text-xs text-red-500";
      return;
    }

    const headerCell = String(rows[0][0] || "").trim().toLowerCase();
    const startIdx = ["사번", "employee_id", "id"].includes(headerCell) ? 1 : 0;

    const parsed = rows
      .slice(startIdx)
      .map((row) => ({
        employee_id: String(row[0] ?? "").trim(),
        name: String(row[1] ?? "").trim() || null,
      }))
      .filter((row) => row.employee_id);

    if (!parsed.length) {
      status.textContent = "등록할 사번을 찾지 못했습니다. 첫 번째 열에 사번이 있는지 확인해주세요.";
      status.className = "text-xs text-red-500";
      return;
    }

    for (let i = 0; i < parsed.length; i += 500) {
      const batch = writeBatch(db);
      parsed.slice(i, i + 500).forEach((r) =>
        batch.set(
          doc(db, "allowedEmployees", r.employee_id),
          { name: r.name, addedAt: serverTimestamp() },
          { merge: true }
        )
      );
      await batch.commit();
    }

    loadEmployees();
    status.textContent = `${parsed.length}건 등록 완료 (${file.name})`;
    status.className = "text-xs text-[var(--success)]";
  } catch (err) {
    console.error(err);
    status.textContent = "파일을 읽는 중 오류가 발생했습니다. 형식을 확인해주세요.";
    status.className = "text-xs text-red-500";
  } finally {
    e.target.value = "";
  }
});

// ============================================================
// 2. 온보딩 가이드 CRUD
// ============================================================
async function loadGuides() {
  const wrap = document.getElementById("guide-admin-list");
  const snap = await getDocs(query(collection(db, "guides"), orderBy("orderIndex", "asc")));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  wrap.innerHTML = rows.map((g) => guideRowTemplate(g)).join("");
  attachCrudHandlers(wrap, "guides", loadGuides);
}

function guideRowTemplate(g) {
  return `
  <div class="border border-slate-200 rounded-lg p-4 space-y-2" data-row-id="${g.id}">
    <div class="flex gap-2">
      <select class="border border-slate-300 rounded px-2 py-1.5 text-sm field-category w-32">
        ${GUIDE_CATEGORIES.map(
          (c) => `<option value="${c}" ${c === (g.category || "기타") ? "selected" : ""}>${c}</option>`
        ).join("")}
      </select>
      <input class="border border-slate-300 rounded px-3 py-1.5 text-sm field-orderIndex w-16" type="number" value="${g.orderIndex ?? 0}" placeholder="순서" />
      <input class="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm field-title" value="${escAttr(g.title)}" placeholder="제목" />
    </div>
    <textarea class="w-full border border-slate-300 rounded px-3 py-1.5 text-sm field-content" rows="2" placeholder="내용">${escapeHtml(g.content)}</textarea>
    <div class="flex justify-end gap-2">
      <button class="text-xs text-white bg-[var(--accent)] hover:bg-[#6F2F85] px-3 py-1.5 rounded btn-save transition-colors">저장</button>
      <button class="text-xs text-red-500 px-3 py-1.5 rounded btn-delete">삭제</button>
    </div>
  </div>`;
}

document.getElementById("guide-add-btn").addEventListener("click", async () => {
  const ref = await addDoc(collection(db, "guides"), {
    title: "새 가이드",
    content: "",
    category: "기타",
    orderIndex: 0,
    updatedAt: serverTimestamp(),
  });
  await loadGuides();
  focusNewRow(ref.id);
});

// ============================================================
// 3. 공지사항 CRUD
// ============================================================
async function loadNotices() {
  const wrap = document.getElementById("notice-admin-list");
  const snap = await getDocs(query(collection(db, "notices"), orderBy("createdAt", "desc")));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  wrap.innerHTML = rows
    .map(
      (n) => `
    <div class="border border-slate-200 rounded-lg p-4 space-y-2" data-row-id="${n.id}">
      <input class="w-full border border-slate-300 rounded px-3 py-1.5 text-sm field-title" value="${escAttr(n.title)}" placeholder="제목" />
      <textarea class="w-full border border-slate-300 rounded px-3 py-1.5 text-sm field-content" rows="2" placeholder="내용">${escapeHtml(n.content)}</textarea>
      <div class="flex justify-end gap-2">
        <button class="text-xs text-white bg-[var(--accent)] hover:bg-[#6F2F85] px-3 py-1.5 rounded btn-save transition-colors">저장</button>
        <button class="text-xs text-red-500 px-3 py-1.5 rounded btn-delete">삭제</button>
      </div>
    </div>`
    )
    .join("");
  attachCrudHandlers(wrap, "notices", loadNotices);
}

document.getElementById("notice-add-btn").addEventListener("click", async () => {
  const ref = await addDoc(collection(db, "notices"), {
    title: "새 공지",
    content: "",
    createdAt: serverTimestamp(),
  });
  await loadNotices();
  focusNewRow(ref.id);
});

// ============================================================
// 4. Before/After 비교 항목 CRUD
// ============================================================
async function loadComparison() {
  const wrap = document.getElementById("comparison-admin-list");
  const snap = await getDocs(query(collection(db, "comparisonItems"), orderBy("orderIndex", "asc")));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  wrap.innerHTML = rows
    .map(
      (c) => `
    <div class="border border-slate-200 rounded-lg p-4 space-y-2" data-row-id="${c.id}">
      <div class="flex gap-2">
        <input class="border border-slate-300 rounded px-3 py-1.5 text-sm field-orderIndex w-16" type="number" value="${c.orderIndex ?? 0}" placeholder="순서" />
        <input class="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm field-category" value="${escAttr(c.category)}" placeholder="항목명 (예: 결재 권한)" />
      </div>
      <input class="w-full border border-slate-300 rounded px-3 py-1.5 text-sm field-beforeText" value="${escAttr(c.beforeText)}" placeholder="팀원일 때" />
      <input class="w-full border border-slate-300 rounded px-3 py-1.5 text-sm field-afterText" value="${escAttr(c.afterText)}" placeholder="팀장이 된 후" />
      <div class="flex justify-end gap-2">
        <button class="text-xs text-white bg-[var(--accent)] hover:bg-[#6F2F85] px-3 py-1.5 rounded btn-save transition-colors">저장</button>
        <button class="text-xs text-red-500 px-3 py-1.5 rounded btn-delete">삭제</button>
      </div>
    </div>`
    )
    .join("");
  attachCrudHandlers(wrap, "comparisonItems", loadComparison);
}

document.getElementById("comparison-add-btn").addEventListener("click", async () => {
  const ref = await addDoc(collection(db, "comparisonItems"), {
    category: "새 항목",
    beforeText: "",
    afterText: "",
    orderIndex: 0,
  });
  await loadComparison();
  focusNewRow(ref.id);
});

// ============================================================
// 5. 체크리스트 항목 CRUD (D+1 / D+7 / D+30)
// ============================================================
async function loadChecklistItems() {
  const wrap = document.getElementById("checklist-admin-list");
  const snap = await getDocs(query(collection(db, "checklistItems"), orderBy("orderIndex", "asc")));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  wrap.innerHTML = rows
    .map(
      (c) => `
    <div class="border border-slate-200 rounded-lg p-4 space-y-2" data-row-id="${c.id}">
      <div class="flex gap-2">
        <select class="border border-slate-300 rounded px-2 py-1.5 text-sm field-phase">
          <option value="D1" ${c.phase === "D1" ? "selected" : ""}>D+1</option>
          <option value="D7" ${c.phase === "D7" ? "selected" : ""}>D+7</option>
          <option value="D30" ${c.phase === "D30" ? "selected" : ""}>D+30</option>
        </select>
        <input class="border border-slate-300 rounded px-3 py-1.5 text-sm field-orderIndex w-16" type="number" value="${c.orderIndex ?? 0}" placeholder="순서" />
        <input class="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm field-title" value="${escAttr(c.title)}" placeholder="과제명" />
      </div>
      <div class="flex justify-end gap-2">
        <button class="text-xs text-white bg-[var(--accent)] hover:bg-[#6F2F85] px-3 py-1.5 rounded btn-save transition-colors">저장</button>
        <button class="text-xs text-red-500 px-3 py-1.5 rounded btn-delete">삭제</button>
      </div>
    </div>`
    )
    .join("");
  attachCrudHandlers(wrap, "checklistItems", loadChecklistItems);
}

document.getElementById("checklist-add-btn").addEventListener("click", async () => {
  const ref = await addDoc(collection(db, "checklistItems"), {
    phase: "D1",
    title: "새 과제",
    orderIndex: 0,
  });
  await loadChecklistItems();
  focusNewRow(ref.id);
});

// ============================================================
// 6. 업무 담당자 CRUD
// ============================================================
async function loadContacts() {
  const wrap = document.getElementById("contact-admin-list");
  const snap = await getDocs(query(collection(db, "contacts"), orderBy("orderIndex", "asc")));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  wrap.innerHTML = rows
    .map(
      (c) => `
    <div class="border border-slate-200 rounded-lg p-4 space-y-2" data-row-id="${c.id}">
      <div class="flex gap-2">
        <input class="border border-slate-300 rounded px-3 py-1.5 text-sm field-orderIndex w-16" type="number" value="${c.orderIndex ?? 0}" placeholder="순서" />
        <input class="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm field-taskArea" value="${escAttr(c.taskArea)}" placeholder="업무 영역 (예: 예산/결재 문의)" />
        <input class="w-28 border border-slate-300 rounded px-3 py-1.5 text-sm field-department" value="${escAttr(c.department)}" placeholder="부서" />
        <input class="w-24 border border-slate-300 rounded px-3 py-1.5 text-sm field-name" value="${escAttr(c.name)}" placeholder="담당자 이름" />
      </div>
      <div class="flex gap-2">
        <input class="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm field-phone" value="${escAttr(c.phone)}" placeholder="연락처" />
        <input class="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm field-email" value="${escAttr(c.email)}" placeholder="이메일" />
      </div>
      <div class="flex justify-end gap-2">
        <button class="text-xs text-white bg-[var(--accent)] hover:bg-[#6F2F85] px-3 py-1.5 rounded btn-save transition-colors">저장</button>
        <button class="text-xs text-red-500 px-3 py-1.5 rounded btn-delete">삭제</button>
      </div>
    </div>`
    )
    .join("");
  attachCrudHandlers(wrap, "contacts", loadContacts);
}

document.getElementById("contact-add-btn").addEventListener("click", async () => {
  const ref = await addDoc(collection(db, "contacts"), {
    taskArea: "새 업무 영역",
    department: "",
    name: "",
    phone: "",
    email: "",
    orderIndex: 0,
    updatedAt: serverTimestamp(),
  });
  await loadContacts();
  focusNewRow(ref.id);
});

// ============================================================
// 공용 저장/삭제 핸들러
// ============================================================
function attachCrudHandlers(wrap, collectionName, reload) {
  wrap.querySelectorAll(".btn-save").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-row-id]");
      const id = row.dataset.rowId;
      const payload = {};

      row.querySelectorAll("[class*='field-']").forEach((field) => {
        const key = [...field.classList].find((c) => c.startsWith("field-")).replace("field-", "");
        payload[key] = field.type === "number" ? Number(field.value) : field.value;
      });

      try {
        await updateDoc(doc(db, collectionName, id), payload);
        reload();
      } catch (err) {
        alert("저장 실패: " + err.message);
      }
    });
  });

  wrap.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("삭제할까요?")) return;
      const row = btn.closest("[data-row-id]");
      await deleteDoc(doc(db, collectionName, row.dataset.rowId));
      reload();
    });
  });
}

// ---------- 유틸 ----------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

// ---------- 탭 전환 ----------
document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("tab-active"));
    document.querySelectorAll(".admin-tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("tab-active");
    document.getElementById(btn.dataset.target).classList.remove("hidden");
  });
});
