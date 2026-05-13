import { AppFrame } from "../../components/AppFrame";
import { LoginPageClient } from "../../components/SocialClient";

export default function LoginPage() {
  return (
    <AppFrame active="login">
      <LoginPageClient />
    </AppFrame>
  );
}
