import { AppFrame } from "../../components/AppFrame";
import { SignupPageClient } from "../../components/SocialClient";

export default function SignupPage() {
  return (
    <AppFrame active="signup">
      <SignupPageClient />
    </AppFrame>
  );
}
