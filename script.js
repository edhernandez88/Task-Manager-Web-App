// ===================== Firebase SDKs =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// ===================== Firebase Config =====================
const firebaseConfig = {
  apiKey: "AIzaSyDCMe90nvajLaPhz1OJB-AsCtVWtE3zIWg",
  authDomain: "cloud-task-tracker.firebaseapp.com",
  databaseURL: "https://cloud-task-tracker-default-rtdb.firebaseio.com",
  projectId: "cloud-task-tracker",
  storageBucket: "cloud-task-tracker.firebasestorage.app",
  messagingSenderId: "260005624979",
  appId: "1:260005624979:web:ebecd1d96372117463e166"
};

// ===================== Init =====================
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ===================== DOM =====================
const taskForm   = document.getElementById("taskForm");
const taskInput  = document.getElementById("taskInput");
const addBtn     = document.getElementById("addBtn");
const taskList   = document.getElementById("taskList");
const loginBtn   = document.getElementById("loginBtn");
const logoutBtn  = document.getElementById("logoutBtn");
const statusMsg  = document.getElementById("statusMsg");
const leftCount  = document.getElementById("leftCount");
const totalCount = document.getElementById("totalCount");
const themeToggle = document.getElementById("themeToggle");
const filterChips = document.querySelectorAll(".chip");

// ===================== Theme =====================
const storedTheme = localStorage.getItem("ctt_theme") || "dark";
document.documentElement.setAttribute("data-theme", storedTheme === "light" ? "light" : "");
themeToggle.textContent = storedTheme === "light" ? "🌙" : "☀️";

themeToggle.addEventListener("click", () => {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) {
    document.documentElement.removeAttribute("data-theme");
    themeToggle.textContent = "☀️";
    localStorage.setItem("ctt_theme", "dark");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    themeToggle.textContent = "🌙";
    localStorage.setItem("ctt_theme", "light");
  }
});

// ===================== Filters =====================
let currentFilter = localStorage.getItem("ctt_filter") || "all";
setActiveFilter(currentFilter);

filterChips.forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.getAttribute("data-filter");
    localStorage.setItem("ctt_filter", currentFilter);
    setActiveFilter(currentFilter);
    if (auth.currentUser) loadTasks(auth.currentUser, true);
  });
});
function setActiveFilter(f) {
  filterChips.forEach(b => b.classList.toggle("chip-active", b.getAttribute("data-filter") === f));
}

// ===================== UI helpers =====================
function setSignedInUI(isSignedIn){
  taskInput.disabled = !isSignedIn;
  addBtn.disabled = !isSignedIn;
  loginBtn.style.display  = isSignedIn ? "none" : "inline-flex";
  logoutBtn.style.display = isSignedIn ? "inline-flex" : "none";
  statusMsg.textContent = isSignedIn
    ? "You are signed in. Add, complete, or delete your tasks."
    : "Please sign in to manage your tasks.";
  if(!isSignedIn){ taskList.innerHTML = ""; updateCounts(0,0); }
}
function updateCounts(left, total){
  leftCount.textContent = `${left} left`;
  totalCount.textContent = `${total} total`;
}

// ===================== Auth flow =====================
getRedirectResult(auth).catch(err => console.warn("Redirect result:", err.code, err.message));

onAuthStateChanged(auth, (user) => {
  setSignedInUI(!!user);
  if (user) loadTasks(user);
});

loginBtn.addEventListener("click", async () => {
  try { await signInWithPopup(auth, provider); }
  catch { await signInWithRedirect(auth, provider); } // Safari popup block fallback
});

logoutBtn.addEventListener("click", async () => { await signOut(auth); });

// ===================== Tasks =====================
taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  const text = taskInput.value.trim();
  if (!user) return alert("Please sign in first.");
  if (!text) return;
  push(ref(db, `users/${user.uid}/tasks`), { text, done:false, createdAt: Date.now() });
  taskInput.value = "";
});

function renderTask(userUid, id, task){
  const li = document.createElement("li");
  li.className = `task ${task.done ? "done" : ""}`;

  const left = document.createElement("div");
  left.className = "left";

  const box = document.createElement("label");
  box.className = "checkbox";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!task.done;
  const dot = document.createElement("span");
  dot.className = "dot";
  box.appendChild(input); box.appendChild(dot);

  const txt = document.createElement("span");
  txt.className = "text";
  txt.textContent = task.text;

  left.appendChild(box); left.appendChild(txt);

  const actions = document.createElement("div");
  actions.className = "actions";
  const del = document.createElement("button");
  del.className = "btn delete";
  del.textContent = "Delete";
  actions.appendChild(del);

  li.appendChild(left); li.appendChild(actions);

  box.addEventListener("click", (e) => {
    e.stopPropagation();
    update(ref(db, `users/${userUid}/tasks/${id}`), { done: !task.done });
  });
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    remove(ref(db, `users/${userUid}/tasks/${id}`));
  });

  return li;
}

let unsubscribe = null;
function loadTasks(user, keepListener=false){
  if (!keepListener && typeof unsubscribe === "function") unsubscribe();

  const base = ref(db, `users/${user.uid}/tasks`);
  const handler = (snap) => {
    taskList.innerHTML = "";
    const data = snap.val() || {};
    const allEntries = Object.entries(data);

    // Apply filter to view
    const view = allEntries.filter(([_, t]) => {
      if (currentFilter === "active") return !t.done;
      if (currentFilter === "done")   return !!t.done;
      return true;
    });

    const left = allEntries.reduce((acc, [_, t]) => acc + (t.done ? 0 : 1), 0);
    updateCounts(left, allEntries.length);

    if (view.length === 0){
      const empty = document.createElement("li");
      empty.className = "task";
      empty.innerHTML = `<div class="left"><span class="text" style="color:#64748b">No tasks here — try another filter or add one!</span></div>`;
      taskList.appendChild(empty);
      return;
    }

    view.forEach(([id, task]) => taskList.appendChild(renderTask(user.uid, id, task)));
  };

  unsubscribe = onValue(base, handler, (err) => console.error("onValue error:", err.code, err.message));
}
