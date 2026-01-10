/**
 * URL解析ユーティリティ
 * privacy-finder, tos-finder, その他で共通利用
 */

export function decodeUrlSafe(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

export function getPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function extractOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function resolveUrl(href: string, baseOrigin: string): string {
  return new URL(href, baseOrigin).href;
}
