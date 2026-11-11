import { useAuth } from "@/src/auth";
import { AnnouncementsView } from "@/src/components/announcements";

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const send = user?.role === "admin" || !!user?.perms?.send_announcements;
  return <AnnouncementsView canSend={send} canDelete={send} />;
}
