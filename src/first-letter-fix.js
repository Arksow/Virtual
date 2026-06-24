// The first role screen is rendered immediately before its opening countdown.
// Keep the lamp mounted for one frame before the initial blink sequence begins.
document.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver(() => {
    const lamp = document.querySelector("#lamp");
    if (lamp) lamp.getBoundingClientRect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
