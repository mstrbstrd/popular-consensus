import { expect, test, type Locator, type Page } from "@playwright/test";

const formatCases: Array<{
  schemaId: string;
  label: string;
  submit: (detail: Locator) => Promise<void>;
}> = [
  {
    schemaId: "answer-binary-support-oppose",
    label: "Support / Oppose",
    submit: async (detail) => detail.getByRole("button", { name: "Vote support" }).click()
  },
  {
    schemaId: "answer-yes-no",
    label: "Yes / No",
    submit: async (detail) => detail.getByRole("button", { name: "Vote yes" }).click()
  },
  {
    schemaId: "answer-true-false",
    label: "True / False",
    submit: async (detail) => detail.getByRole("button", { name: "Vote true" }).click()
  },
  {
    schemaId: "answer-single-choice-civic-priority",
    label: "Single-Select Multiple Choice",
    submit: async (detail) => detail.getByRole("button", { name: "Vote service frequency" }).click()
  },
  {
    schemaId: "answer-approval-civic-priorities",
    label: "Approval / Select All",
    submit: async (detail) => {
      await detail.getByLabel("Safety upgrades").check();
      await detail.getByLabel("More service").check();
      await detail.getByRole("button", { name: "Submit response" }).click();
    }
  },
  {
    schemaId: "answer-ranked-policy-options",
    label: "Ranked Choice",
    submit: async (detail) => {
      await detail.getByLabel("Rank Limited rollout").fill("1");
      await detail.getByLabel("Rank Full rollout").fill("2");
      await detail.getByLabel("Rank No change").fill("3");
      await detail.getByRole("button", { name: "Submit ranking" }).click();
    }
  },
  {
    schemaId: "answer-likert-agreement-5",
    label: "Five-Point Agreement Scale",
    submit: async (detail) => detail.getByRole("button", { name: "4", exact: true }).click()
  },
  {
    schemaId: "answer-score-0-10",
    label: "Zero-to-Ten Score",
    submit: async (detail) => detail.getByRole("button", { name: "8", exact: true }).click()
  },
  {
    schemaId: "answer-budget-allocation-100",
    label: "Budget Allocation",
    submit: async (detail) => {
      await detail.getByLabel("Allocate to Maintenance").fill("40");
      await detail.getByLabel("Allocate to Expansion").fill("30");
      await detail.getByLabel("Allocate to Safety").fill("20");
      await detail.getByLabel("Allocate to Reserves").fill("10");
      await detail.getByRole("button", { name: "Submit allocation" }).click();
    }
  },
  {
    schemaId: "answer-numeric-estimate",
    label: "Numeric Estimate",
    submit: async (detail) => {
      await detail.getByLabel("Numeric response").fill("42");
      await detail.getByRole("button", { name: "Submit response" }).click();
    }
  },
  {
    schemaId: "answer-short-text",
    label: "Short Form",
    submit: async (detail) => {
      await detail.getByLabel("Text response").fill("Fill potholes");
      await detail.getByRole("button", { name: "Submit response" }).click();
    }
  },
  {
    schemaId: "answer-long-text",
    label: "Long Form",
    submit: async (detail) => {
      await detail.getByLabel("Text response").fill("Add shelters and lighting at every high-use stop.");
      await detail.getByRole("button", { name: "Submit response" }).click();
    }
  }
];

async function switchAccount(page: Page, label: string) {
  await page.getByLabel("Account").selectOption({ label });
}

test("shows the transit advisory poll demo", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");
  await page.goto("/testing");
  const detail = page.locator(".detail");
  await expect(page.getByRole("heading", { name: "Community Feed" })).toBeVisible();
  await expect(page.locator(".sidebar").getByRole("button", { name: /p\/vancouver-transit/ })).toBeVisible();
  await expect(page.locator(".community-hero .statusline").getByText("Advisory", { exact: true })).toBeVisible();
  await expect(detail.getByText("Poll Configured", { exact: true })).toBeVisible();
  await expect(detail.getByText("Registry review", { exact: true })).toBeVisible();
  await expect(page.getByText("Voting opens after registry acceptance.")).toBeVisible();
  await expect(page.getByText("Advisory signals community preference; no automatic legal or operational effect is implied.")).toBeVisible();
});

test("runs the transit poll flow and handles duplicate voting in the UI", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");
  await page.goto("/testing");
  const detail = page.locator(".detail");
  await expect(detail.getByText("Poll Configured", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load result" })).toBeDisabled();

  await switchAccount(page, "Demo Challenger");
  await expect(detail.getByText("Poll Configured", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open wording challenge" }).click();
  await expect(page.getByText("Challenge opened with 50 PC challenge stake.")).toBeVisible();
  await expect(page.getByText("Challenge pending", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending challenge must be ruled on or amended before acceptance.")).toBeVisible();

  await switchAccount(page, "Demo Proposer");
  await expect(page.getByText("Challenge pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept amendment" }).click();
  await expect(page.getByText("Question amended and returned to registry review.")).toBeVisible();

  await switchAccount(page, "Demo Curator");
  await expect(detail.getByText("Poll Configured", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept and open poll" }).click();
  await expect(page.getByText("Question accepted into the registry and poll opened.")).toBeVisible();
  await expect(detail.getByText("Poll Open", { exact: true })).toBeVisible();

  await switchAccount(page, "Demo Resident");
  await expect(detail.getByText("Poll Open", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Issue demo resident credential" }).click();
  await expect(page.getByText("Demo resident credential issued.")).toBeVisible();

  await page.getByRole("button", { name: "Vote support" }).click();
  await expect(page.getByText("Encrypted support ballot accepted.")).toBeVisible();

  await page.getByRole("button", { name: "Vote oppose" }).click();
  await expect(page.getByText("Duplicate ballot nullifier rejected")).toBeVisible();

  await page.getByRole("button", { name: "Close and tally" }).click();
  await expect(page.getByText("Poll closed and coordinator published aggregate result artifacts.")).toBeVisible();
  await expect(detail.getByText("Poll Result Published", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vote support" })).toBeDisabled();
  await expect(page.getByText('"support": 1')).toBeVisible();
  await expect(page.getByText('"authorityLevel": "Advisory"')).toBeVisible();

  await page.getByLabel("Discussion note").fill("The published artifact is ready for review.");
  await page.getByRole("button", { name: "Post note" }).click();
  await expect(page.getByText("The published artifact is ready for review.")).toBeVisible();

  await switchAccount(page, "Demo Challenger");
  await page.getByRole("button", { name: "Challenge result" }).click();
  await expect(page.getByText("Result challenge opened with 50 PC challenge stake.")).toBeVisible();

  await switchAccount(page, "Demo Curator");
  await page.getByRole("button", { name: "Sustain result challenge" }).click();
  await expect(page.getByText("Result challenge sustained and artifact corrected.")).toBeVisible();
  await page.getByRole("button", { name: "Finalize and archive" }).click();
  await expect(page.getByText("Result finalized and public archive published.")).toBeVisible();
  await expect(page.getByText('"status": "Archived"')).toBeVisible();
});

test("creates a local account, private community, and proposed question", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");
  await page.goto("/testing");
  const detail = page.locator(".detail");

  await page.getByLabel("Username").fill("local_builder");
  await page.getByLabel("Display name").fill("Local Builder");
  await page.getByRole("button", { name: "Create local account" }).click();
  await expect(page.getByText("Account created for Local Builder.")).toBeVisible();

  await page.getByLabel("Username").fill("local_builder");
  await page.getByLabel("Display name").fill("Duplicate Builder");
  await page.getByRole("button", { name: "Create local account" }).click();
  await expect(page.getByText("Username is already taken")).toBeVisible();

  await page.getByLabel("Community name").fill("Neighborhood Assembly");
  await page.getByLabel("Community description").fill("Private practice space for local governance.");
  await page.getByLabel("Community visibility").selectOption("Private");
  await page.getByRole("button", { name: "Create community" }).click();
  await expect(page.getByText("Neighborhood Assembly created.")).toBeVisible();
  await expect(page.locator(".community-hero .statusline").getByText("Private", { exact: true })).toBeVisible();

  await page.getByLabel("Community name").fill("Neighborhood Assembly");
  await page.getByLabel("Community description").fill("Duplicate community slug.");
  await page.getByLabel("Community visibility").selectOption("Public");
  await page.getByRole("button", { name: "Create community" }).click();
  await expect(page.getByText("Community slug is already taken")).toBeVisible();

  await page.getByLabel("Question title").fill("Should the assembly adopt rotating facilitation?");
  await page.getByLabel("Question body").fill("A member advisory question about rotating meeting facilitation every month.");
  await page.getByLabel("Sponsor disclosure").fill("Sponsored by Local Builder.");
  await page.getByRole("button", { name: "Submit question with PC stake" }).click();
  await expect(page.getByText("Question submitted with 100 PC proposal stake and sent to registry review.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Should the assembly adopt rotating facilitation/ })).toBeVisible();
  await expect(detail.getByText("Poll Configured", { exact: true })).toBeVisible();

  await page.getByLabel("Account").selectOption("demo-resident");
  await expect(page.locator(".message").getByText("Join this private community to view its questions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit question with PC stake" })).toBeDisabled();
  await expect(page.getByText("Join this private community before proposing a question.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Should the assembly adopt rotating facilitation/ })).toHaveCount(0);
  await expect(page.getByText("No published result yet.")).toBeVisible();
  await page.getByRole("button", { name: "Join private community" }).click();
  await expect(page.getByText("Demo Resident joined Neighborhood Assembly.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Should the assembly adopt rotating facilitation/ })).toBeVisible();
});

test("routes the social client pages around the testing hub", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Public opinion infrastructure/ })).toBeVisible();
  await page.getByRole("link", { name: "Open feed" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("heading", { name: "Community Feed" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Should Vancouver pilot car-free Sundays/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public Audit" })).toBeVisible();
  await expect(page.getByText("Civic Actions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Issue credential" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with wallet" })).toBeVisible();

  await page.goto("/signup");
  await page.getByLabel("Username").fill("route_builder");
  await page.getByLabel("Display name").fill("Route Builder");
  await page.getByLabel("Bio").fill("Testing the social client routes.");
  await expect(page.getByRole("button", { name: "Create with passkey" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create with wallet" })).toBeVisible();

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.locator(".account-session-panel").getByRole("link", { name: "Log in" })).toBeVisible();

  await page.goto("/testing");
  await expect(page.locator(".detail").getByText("Poll Configured", { exact: true })).toBeVisible();
});

for (const [index, formatCase] of formatCases.entries()) {
  test(`renders and submits ${formatCase.label} in the UI`, async ({ page, request }) => {
    await request.post("http://127.0.0.1:4000/dev/reset");
    await page.goto("/testing");
    const detail = page.locator(".detail");
    const title = `UI format coverage ${index + 1}: ${formatCase.label}`;

    await expect(detail.getByText("Poll Configured", { exact: true })).toBeVisible();
    await page.getByLabel("Question title").fill(title);
    await page.getByLabel("Question body").fill(`Coverage question for ${formatCase.label}.`);
    await page.getByLabel("Question format").selectOption(formatCase.schemaId);
    await page.getByLabel("Sponsor disclosure").fill("Demo sponsor");
    await page.getByRole("button", { name: "Submit question with PC stake" }).click();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
    await expect(detail.getByRole("heading", { name: title })).toBeVisible();
    await expect(detail.getByText(formatCase.label, { exact: true })).toBeVisible();

    await switchAccount(page, "Demo Curator");
    await expect(detail.getByRole("heading", { name: title })).toBeVisible();
    await detail.getByRole("button", { name: "Accept and open poll" }).click();
    await expect(detail.getByText("Poll Open", { exact: true })).toBeVisible();

    await switchAccount(page, "Demo Resident");
    await expect(detail.getByText("Poll Open", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Issue demo resident credential" }).click();
    await expect(page.getByText("Demo resident credential issued.")).toBeVisible();

    await formatCase.submit(detail);
    await expect(page.locator(".message").getByText(/ballot accepted/i)).toBeVisible();

    await detail.getByRole("button", { name: "Close and tally" }).click();
    await expect(detail.getByText("Poll Result Published", { exact: true })).toBeVisible();
    await expect(page.getByText(`"answerSchemaId": "${formatCase.schemaId}"`)).toBeVisible();
  });
}
