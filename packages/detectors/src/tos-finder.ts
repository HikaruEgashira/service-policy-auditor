import {
  isTosUrl,
  isTosText,
  isPrivacyText,
  TOS_OG_PATTERNS,
  TOS_JSONLD_KEYS,
  TOS_LINK_REL_VALUES,
  decodeUrlSafe,
  getPathFromUrl,
} from "@service-policy-auditor/core";
import type { DOMAdapter, TosResult } from "./types.js";
import { createPolicyFinder } from "./policy-finder-base.js";

// Patterns that should NOT be detected as ToS (privacy pages, etc.)
const TOS_EXCLUSION_PATTERNS = [
  /privacy/i,
  /プライバシー/,
  /datenschutz/i,
  /개인정보/,
  /隐私/,
  /隱私/,
];

function isExcludedUrl(url: string): boolean {
  const decoded = decodeUrlSafe(url);
  return TOS_EXCLUSION_PATTERNS.some(
    (pattern) => pattern.test(url) || pattern.test(decoded)
  );
}

function shouldExcludePrivacy(text: string, url: string): boolean {
  const pathname = getPathFromUrl(url);
  const decodedPath = decodeUrlSafe(pathname);
  const decodedText = decodeUrlSafe(text);

  return (
    isPrivacyText(text) ||
    isPrivacyText(decodedText) ||
    isExcludedUrl(pathname) ||
    isPrivacyText(decodedPath)
  );
}

export function createTosFinder(dom: DOMAdapter) {
  return createPolicyFinder(dom, {
    isTargetUrl: isTosUrl,
    isTargetText: isTosText,
    linkRelValues: TOS_LINK_REL_VALUES,
    jsonLdKeys: TOS_JSONLD_KEYS,
    ogPatterns: TOS_OG_PATTERNS,
    shouldExclude: shouldExcludePrivacy,
  }) as () => TosResult;
}
