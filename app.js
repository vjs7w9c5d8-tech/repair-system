(() => {
  "use strict";

  const form = document.querySelector("#repair-form");
  const fields = document.querySelector("#form-fields");
  const submitButton = document.querySelector("#submit-button");
  const refreshButton = document.querySelector("#refresh-button");
  const formMessage = document.querySelector("#form-message");
  const listMessage = document.querySelector("#list-message");
  const list = document.querySelector("#request-list");
  const filterButtons = document.querySelectorAll("[data-urgency]");
  const filterMessage = document.querySelector("#filter-message");
  const config = window.REPAIR_CONFIG || {};
  let client;
  let submitting = false;
  let requests = [];
  let selectedUrgency = "全部";

  function showMessage(element, text, type = "") {
    element.textContent = text;
    element.className = `message ${type}`.trim();
    element.hidden = !text;
  }

  function renderRequests(requests) {
    list.replaceChildren();
    for (const request of requests) {
      const item = document.createElement("li");
      item.className = "request-card";
      const top = document.createElement("div");
      top.className = "card-top";
      const tags = document.createElement("div");
      tags.className = "card-tags";
      const urgencyClass = {
        高: "urgency-high",
        中: "urgency-medium",
        低: "urgency-low",
      };
      for (const [value, className] of [
        [request.category, ""],
        [`${request.urgency}緊急`, urgencyClass[request.urgency] || ""],
        [request.status, ""],
      ]) {
        const tag = document.createElement("span");
        tag.className = `tag ${className}`.trim();
        tag.textContent = value;
        tags.append(tag);
      }
      const time = document.createElement("time");
      const date = new Date(request.created_at);
      if (!Number.isNaN(date.getTime())) {
        time.dateTime = date.toISOString();
        time.textContent = new Intl.DateTimeFormat("zh-TW", {
          timeZone: "Asia/Taipei",
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(date);
      } else {
        time.textContent = "時間未提供";
      }
      const description = document.createElement("p");
      description.className = "card-description";
      description.textContent = request.description;
      const meta = document.createElement("p");
      meta.className = "card-meta";
      meta.textContent = `${request.reporter_name} · ${request.location}`;
      top.append(tags, time);
      item.append(top, description, meta);
      list.append(item);
    }
  }

  function renderFilteredRequests() {
    const filtered =
      selectedUrgency === "全部"
        ? requests
        : requests.filter((request) => request.urgency === selectedUrgency);
    renderRequests(filtered);
    showMessage(
      filterMessage,
      requests.length && !filtered.length
        ? `最近 20 筆報修中，沒有緊急程度為「${selectedUrgency}」的紀錄。`
        : "",
    );
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedUrgency = button.dataset.urgency;
      filterButtons.forEach((filterButton) => {
        filterButton.setAttribute(
          "aria-pressed",
          String(filterButton === button),
        );
      });
      renderFilteredRequests();
    });
  });

  async function loadRequests() {
    if (!navigator.onLine) {
      showMessage(
        listMessage,
        "目前離線，無法取得最新報修。已顯示的紀錄不會自動更新，連線恢復後請按重新整理。",
        "error",
      );
      return;
    }
    refreshButton.disabled = true;
    list.setAttribute("aria-busy", "true");
    showMessage(listMessage, "正在讀取報修紀錄…");
    try {
      const { data, error } = await client
        .from("repair_requests")
        .select(
          "id,reporter_name,location,category,description,urgency,status,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      requests = data || [];
      renderFilteredRequests();
      showMessage(
        listMessage,
        data?.length ? "" : "目前還沒有報修紀錄。第一筆回報，從這裡開始。",
      );
    } catch (error) {
      showMessage(
        listMessage,
        `清單讀取失敗：${error.message || "請確認網路連線後重新整理。"}`,
        "error",
      );
    } finally {
      refreshButton.disabled = false;
      list.setAttribute("aria-busy", "false");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || !client) return;
    if (!navigator.onLine) {
      showMessage(
        formMessage,
        "目前離線，這筆報修尚未送出。請保留此頁，恢復連線後再按送出；重新載入會清除未送出的內容。",
        "error",
      );
      return;
    }
    const values = new FormData(form);
    const payload = {};
    for (const name of [
      "reporter_name",
      "location",
      "category",
      "description",
      "urgency",
    ]) {
      const input = form.elements.namedItem(name);
      const value = String(values.get(name) || "").trim();
      input.setCustomValidity(value ? "" : "請填寫此欄位，不能只輸入空白。");
      payload[name] = value;
    }
    if (!form.reportValidity()) return;
    submitting = true;
    fields.disabled = true;
    submitButton.textContent = "送出中…";
    showMessage(formMessage, "");
    try {
      // 僅送出表單五個欄位；status、id、created_at 由資料庫產生。
      const { error } = await client.from("repair_requests").insert(payload);
      if (error) throw error;
      form.reset();
      showMessage(formMessage, "報修已成功送出，謝謝你的回報！", "success");
      await loadRequests();
    } catch (error) {
      showMessage(
        formMessage,
        `送出失敗：${error.message || "請確認網路連線後再試。"}`,
        "error",
      );
    } finally {
      submitting = false;
      fields.disabled = false;
      submitButton.textContent = "送出報修 ↗";
    }
  });

  form.addEventListener("input", (event) => {
    if (typeof event.target.setCustomValidity === "function")
      event.target.setCustomValidity("");
  });
  refreshButton.addEventListener("click", loadRequests);

  try {
    const url = new URL(config.supabaseUrl);
    if (url.protocol !== "https:" || url.hostname.endsWith("github.io")) {
      throw new Error("請填入 Supabase Project URL，而非 GitHub Pages 網址。");
    }
    if (!config.supabasePublishableKey?.startsWith("sb_publishable_")) {
      throw new Error("請在 config.js 填入 Supabase publishable key。");
    }
    if (!window.supabase?.createClient)
      throw new Error("Supabase 程式庫載入失敗，請確認網路後重新載入。");
    client = window.supabase.createClient(
      url.href,
      config.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    fields.disabled = false;
    loadRequests();
  } catch (error) {
    const message = !config.supabaseUrl
      ? "尚未設定資料庫：請在 config.js 的 supabaseUrl 填入 Supabase Project URL（https://專案識別碼.supabase.co）。"
      : error.message;
    showMessage(formMessage, message, "error");
    showMessage(
      listMessage,
      "資料庫連線尚未就緒，暫時無法讀取報修紀錄。",
      "error",
    );
  }
})();
