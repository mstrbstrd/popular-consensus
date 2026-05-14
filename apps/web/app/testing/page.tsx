import { AppFrame } from "../../components/AppFrame";
import { TransitDemo } from "../../components/TransitDemo";

export default function TestingPage() {
  return (
    <AppFrame active="testing">
      <div className="testing-page">
        <TransitDemo />
      </div>
    </AppFrame>
  );
}
