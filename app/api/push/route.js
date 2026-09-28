import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Delivers one queued notification (see supabase/migrations/*_push_notifications.sql).
// The database calls this with only a queue id; claim_push(id) returns the message,
// its recipients and the signing key once, so nothing else can be sent through here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const id = body?.id;
  if (typeof id !== "string" || !UUID.test(id))
    return Response.json({ ok: false }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false }, { status: 503 });
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("claim_push", { p_id: id });
  if (error || !data) return Response.json({ ok: false }, { status: 404 });

  const payload = JSON.stringify(data.notification);
  const options = {
    TTL: 24 * 60 * 60,
    urgency: "high",
    vapidDetails: {
      subject:
        process.env.NEXT_PUBLIC_SITE_URL || "https://alammarstore.vercel.app",
      publicKey: data.publicKey,
      privateKey: data.privateKey,
    },
  };
  const expired = [];
  let sent = 0;
  await Promise.all(
    data.subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload, options);
        sent++;
      } catch (e) {
        // 404/410: the browser unsubscribed or was reset; stop sending to it.
        if (e?.statusCode === 404 || e?.statusCode === 410)
          expired.push(subscription.endpoint);
      }
    }),
  );
  await db.rpc("finish_push", { p_id: id, p_expired: expired });
  return Response.json({ ok: true, sent, expired: expired.length });
}
