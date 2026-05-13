import { AppFrame } from "../../components/AppFrame";
import { AccountPageClient } from "../../components/SocialClient";

export default function AccountPage() {
  return (
    <AppFrame active="account">
      <AccountPageClient />
    </AppFrame>
  );
}
