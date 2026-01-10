/**
 * AI Monitor Content Script
 * ai-hooks.jsからのイベントを受信しBackgroundへ転送
 */

import type { CapturedAIPrompt } from "@service-policy-auditor/detectors";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    // Inject AI hooks script into main world
    injectAIHooksScript();

    // Listen for AI capture events from main world
    window.addEventListener(
      "__AI_PROMPT_CAPTURED__",
      ((event: CustomEvent<CapturedAIPrompt>) => {
        chrome.runtime
          .sendMessage({
            type: "AI_PROMPT_CAPTURED",
            data: event.detail,
          })
          .catch(() => {
            // Ignore if extension context is invalid
          });
      }) as EventListener
    );
  },
});

function injectAIHooksScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("/ai-hooks.js");
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}
