// Node 18 does not expose the Web Crypto API as a global (it became global in Node 19+).
// LangGraph's checkpointer calls `crypto.getRandomValues`, so we polyfill it here.
// Import this module FIRST (before any @langchain/* import) so the global is set in time.
import { webcrypto } from "node:crypto";

if (!(globalThis as { crypto?: unknown }).crypto) {
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}
