import { useState } from "react";
import type { AppRoot } from "@fungi.computer/agar";
import { appMethods } from "@fungi.computer/agar/backend";
import { Button } from "@fungi.computer/caps/components/button";
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CenteredCard,
} from "@fungi.computer/caps/components/card";
import { greetingInput, greetingOutput } from "./backend/methods.js";

export function App({ session }: { session: AppRoot }) {
  const [message, setMessage] = useState("Your App is running inside Oyster.");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Error | null>(null);
  async function greet() {
    setBusy(true);
    setFailure(null);
    try {
      const result = await session.capabilities
        .require(appMethods)
        .call("greet", JSON.stringify(greetingInput.parse({ name: "friend" })));
      setMessage(greetingOutput.parse(result).message);
    } catch (cause) {
      setFailure(
        new Error("Could not reach the backend. Try again.", { cause }),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <CenteredCard>
      <CardHeader>
        <CardTitle level={2}>My App</CardTitle>
      </CardHeader>
      <CardContent>
        <p role="status">{failure?.message ?? message}</p>
      </CardContent>
      <CardFooter>
        <Button loading={busy} disabled={busy} onClick={() => void greet()}>
          Say hello
        </Button>
      </CardFooter>
    </CenteredCard>
  );
}
