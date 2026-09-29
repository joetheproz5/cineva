function normalizeAuthResponse(action, data, now = Date.now()) {
  if (!data || typeof data !== "object") return data;
  if (!["signup", "login", "refresh"].includes(action)) return data;

  const session = data.session || (data.access_token ? data : null);
  if (!session?.access_token) return data;

  const normalizedSession = {
    ...session,
    expires_at: Number(session.expires_at) || Math.floor(now / 1000) + (Number(session.expires_in) || 3600)
  };
  return { session:normalizedSession, user:normalizedSession.user || data.user || null };
}

module.exports = { normalizeAuthResponse };
