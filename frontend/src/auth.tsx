import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { api, loadBranch, loadToken, NetworkError, setBranchId, setToken, setUnauthorizedHandler } from "@/src/api";
import { User } from "@/src/types";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const USER_KEY = "auth_user";
type Ctx = {
  user: User | null; loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  enterBranch: (id: string | null) => Promise<void>;
};
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);

function extractSessionId(url?: string | null) {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sent = useRef(new Set<string>());

  const applyUser = useCallback(async (u: User) => {
    await storage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const exchange = useCallback(
    async (sid: string) => {
      if (sent.current.has(sid)) return false;
      sent.current.add(sid);
      const r = await api.post("/auth/session", { session_id: sid });
      await setToken(r.session_token);
      await applyUser(r.user);
      return true;
    },
    [applyUser],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      storage.removeItem(USER_KEY);
      setUser(null);
    });
    (async () => {
      try {
        const sid = Platform.OS === "web" ? extractSessionId(window.location.href) : extractSessionId(await Linking.getInitialURL());
        if (sid) {
          try {
            await exchange(sid);
            if (Platform.OS === "web") {
              const clean = window.location.href.replace(/[?#&]session_id=[^&#]+/, "");
              window.history.replaceState(window.history.state, "", clean);
            }
            return;
          } catch {
            // fall through to stored session
          }
        }
        const t = await loadToken();
        await loadBranch();
        if (!t) return;
        try {
          await applyUser(await api.get("/auth/me"));
        } catch (e) {
          if (e instanceof NetworkError) {
            const cached = (await storage.getItem(USER_KEY, null)) as string | null;
            if (cached) setUser(JSON.parse(cached));
          } else {
            await setToken(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", ({ url }) => {
      const sid = extractSessionId(url);
      if (sid) exchange(sid).catch(() => {});
    });
    return () => sub.remove();
  }, [exchange, applyUser]);

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      await setBranchId(null);
      const r = await api.post("/auth/login", { email, password });
      await setToken(r.token);
      await applyUser(r.user);
    },
    [applyUser],
  );

  const loginGoogle = useCallback(async () => {
    const redirect = Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      captured = url;
    });
    try {
      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      const url = (res.type === "success" ? res.url : null) ?? captured ?? (await Linking.getInitialURL());
      const sid = extractSessionId(url);
      if (sid) await exchange(sid);
    } finally {
      sub.remove();
    }
  }, [exchange]);

  const refreshUser = useCallback(async () => {
    applyUser(await api.get("/auth/me"));
  }, [applyUser]);

  /** المسؤول العام: الدخول إلى فرع (id) أو العودة إلى البوابة العامة (null). */
  const enterBranch = useCallback(async (id: string | null) => {
    await setBranchId(id);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    await setBranchId(null);
    await setToken(null);
    await storage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, loading, loginEmail, loginGoogle, logout, refreshUser, enterBranch }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
