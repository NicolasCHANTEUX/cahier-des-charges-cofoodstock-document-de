import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";
import { AuthGate } from "@/components/shared/AuthGate";

export default function OnboardingPage() {
  return (
    <AuthGate>
      <OnboardingFlow />
    </AuthGate>
  );
}
