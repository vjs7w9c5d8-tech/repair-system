(() => {
  "use strict";

  const installButton = document.querySelector("#install-button");
  const updateButton = document.querySelector("#update-button");
  const connectionMessage = document.querySelector("#connection-message");
  const pwaMessage = document.querySelector("#pwa-message");
  let installPrompt;
  let waitingWorker;
  let updating = false;

  function updateConnection() {
    connectionMessage.hidden = navigator.onLine;
    connectionMessage.textContent = navigator.onLine
      ? ""
      : "目前離線：可開啟已快取的頁面及填寫表單；送出與讀取最新清單需要連線。內容不會自動排隊送出，重新載入會清除未送出的內容。";
  }
  updateConnection();
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      pwaMessage.textContent = "請從瀏覽器選單安裝或加入主畫面。";
      pwaMessage.hidden = false;
    }
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });

  if (!("serviceWorker" in navigator)) return;

  function showUpdate(worker) {
    waitingWorker = worker;
    updateButton.hidden = false;
    pwaMessage.textContent = "新版本已就緒，請先處理未送出的表單，再按更新。";
    pwaMessage.hidden = false;
  }
  updateButton.addEventListener("click", () => {
    if (!waitingWorker) return;
    updating = true;
    updateButton.disabled = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updating) window.location.reload();
  });

  navigator.serviceWorker
    .register("./sw.js", { scope: "./", updateViaCache: "none" })
    .then((registration) => {
      if (registration.waiting) showUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          )
            showUpdate(worker);
        });
      });
    })
    .catch(() => {
      pwaMessage.textContent =
        "離線功能尚未就緒；請連線後重新開啟。安裝與離線功能需要 HTTPS 或 localhost。";
      pwaMessage.hidden = false;
    });
})();
