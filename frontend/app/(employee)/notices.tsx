import { AnnouncementsView } from "@/src/components/announcements";

export default function EmployeeNotices() {
  return <AnnouncementsView canSend={false} canDelete={false} />;
}
