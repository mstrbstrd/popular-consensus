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
  await page.getByLabel("Test as").selectOption({ label });
}

test("shows the transit advisory poll demo", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");
  await page.goto("/testing");
  const detail = page.locator(".detail");
  await expect(page.getByRole("heading", { name: "Testing Lab" })).toBeVisible();
  await expect(page.locator(".sidebar").getByRole("button", { name: /p\/vancouver-transit/ })).toBeVisible();
  await expect(page.locator(".community-hero .statusline").getByText("Community signal", { exact: true })).toBeVisible();
  await expect(detail.getByText("Ready for check", { exact: true })).toBeVisible();
  await expect(detail.locator(".workflow-summary").getByRole("heading", { name: "Question check" })).toBeVisible();
  await expect(page.getByText("Voting opens after a community guide checks the question.")).toBeVisible();
  await expect(page.getByText("This is a community signal: it shows where the community is leaning, without forcing an outside decision.")).toBeVisible();
});

test("runs the transit poll flow and handles duplicate voting in the UI", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");
  await page.goto("/testing");
  const detail = page.locator(".detail");
  await expect(detail.getByText("Ready for check", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load result" })).toBeDisabled();

  await switchAccount(page, "Demo Challenger");
  await expect(detail.getByText("Ready for check", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Flag question" }).click();
  await expect(page.getByText("Question flagged with 50 PC stake.")).toBeVisible();
  await expect(detail.locator(".workflow-summary").getByRole("heading", { name: "Flag under review" })).toBeVisible();
  await expect(page.getByText("Open flag must be resolved or clarified before voting starts.")).toBeVisible();

  await switchAccount(page, "Demo Proposer");
  await expect(detail.locator(".workflow-summary").getByRole("heading", { name: "Flag under review" })).toBeVisible();
  await page.getByRole("button", { name: "Clarify question" }).click();
  await expect(page.getByText("Question clarified and sent back for checking.")).toBeVisible();

  await switchAccount(page, "Demo Curator");
  await expect(detail.getByText("Ready for check", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open voting" }).click();
  await expect(page.getByText("Question checked. Voting is open.")).toBeVisible();
  await expect(detail.locator(".statusline").getByText("Voting open", { exact: true })).toBeVisible();

  await switchAccount(page, "Demo Resident");
  await expect(detail.locator(".statusline").getByText("Voting open", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Get voting pass" }).click();
  await expect(page.getByText("Voting pass issued.")).toBeVisible();

  await page.getByRole("button", { name: "Vote support" }).click();
  await expect(page.getByText("Private support vote accepted.")).toBeVisible();

  await page.getByRole("button", { name: "Vote oppose" }).click();
  await expect(page.getByText("Duplicate ballot nullifier rejected")).toBeVisible();

  await page.getByRole("button", { name: "Count votes" }).click();
  await expect(page.getByText("Votes counted and public result receipt posted.")).toBeVisible();
  await expect(detail.locator(".statusline span").nth(1)).toHaveText("Results posted");
  await expect(page.getByRole("button", { name: "Vote support" })).toBeDisabled();
  await expect(page.getByText('"support": 1')).toBeVisible();
  await expect(page.getByText('"authorityLevel": "Advisory"')).toBeVisible();

  await page.getByLabel("Discussion note").fill("The published artifact is ready for review.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByText("The published artifact is ready for review.")).toBeVisible();

  await switchAccount(page, "Demo Challenger");
  await page.getByRole("button", { name: "Flag result" }).click();
  await expect(page.getByText("Result flagged with 50 PC stake.")).toBeVisible();

  await switchAccount(page, "Demo Curator");
  await page.getByRole("button", { name: "Keep result flag" }).click();
  await expect(page.getByText("Result flag kept and receipt corrected.")).toBeVisible();
  await page.getByRole("button", { name: "Save final result" }).click();
  await expect(page.getByText("Final result saved to the public record.")).toBeVisible();
  await expect(page.getByText('"status": "Archived"')).toBeVisible();
});

test("creates a local account, private community, and proposed question", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");
  await page.goto("/testing");
  const detail = page.locator(".detail");

  await page.getByLabel("Username").fill("local_builder");
  await page.getByLabel("Display name").fill("Local Builder");
  await page.getByRole("button", { name: "Create test account" }).click();
  await expect(page.getByText("Test account created for Local Builder.")).toBeVisible();

  await page.getByLabel("Username").fill("local_builder");
  await page.getByLabel("Display name").fill("Duplicate Builder");
  await page.getByRole("button", { name: "Create test account" }).click();
  await expect(page.getByText("Username is already taken")).toBeVisible();

  await page.getByLabel("Community name").fill("Neighborhood Assembly");
  await page.getByLabel("Community description").fill("Private practice space for local governance.");
  await page.getByLabel("Community visibility").selectOption("Private");
  await page.getByRole("button", { name: "Start community" }).click();
  await expect(page.getByText("Neighborhood Assembly created.")).toBeVisible();
  await expect(page.locator(".community-hero .statusline").getByText("Private", { exact: true })).toBeVisible();

  await page.getByLabel("Community name").fill("Neighborhood Assembly");
  await page.getByLabel("Community description").fill("Duplicate community slug.");
  await page.getByLabel("Community visibility").selectOption("Public");
  await page.getByRole("button", { name: "Start community" }).click();
  await expect(page.getByText("Community slug is already taken")).toBeVisible();

  await page.getByLabel("Question audience").selectOption("Members");
  await page.getByLabel("Question title").fill("Should the assembly adopt rotating facilitation?");
  await page.getByLabel("Question body").fill("A member advisory question about rotating meeting facilitation every month.");
  await page.getByLabel("Sponsor disclosure").fill("Sponsored by Local Builder.");
  await page.getByRole("button", { name: "Ask question" }).click();
  await expect(page.getByText("Question asked with 100 PC stake and sent for checking.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Should the assembly adopt rotating facilitation/ })).toBeVisible();
  await expect(detail.getByText("Ready for check", { exact: true })).toBeVisible();

  await page.getByLabel("Test as").selectOption("demo-resident");
  await expect(page.locator(".message").getByText("Join this private community to view its questions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask question" })).toBeDisabled();
  await expect(page.getByText("Join this private community before asking a question.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Should the assembly adopt rotating facilitation/ })).toHaveCount(0);
  await expect(page.getByText("No published result yet.")).toBeVisible();
  await page.getByRole("button", { name: "Join private community" }).click();
  await expect(page.getByText("Demo Resident joined Neighborhood Assembly.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Should the assembly adopt rotating facilitation/ })).toBeVisible();
});

test("routes the social client pages around the testing hub", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4000/dev/reset");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Seek the Wisdom of the Crowd." })).toBeVisible();
  await page.getByRole("link", { name: "Open feed" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Should Vancouver pilot car-free Sundays/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proof everyone can check" })).toBeVisible();
  await expect(page.getByText("Actions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Get voting pass" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data Rewards" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suggest sharing rules" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish report" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What happens next" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suggest next-step rule" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with wallet" })).toBeVisible();

  await page.goto("/signup");
  await page.getByLabel("Username").fill("route_builder");
  await page.getByLabel("Display name").fill("Route Builder");
  await page.getByLabel("Bio").fill("Testing the social client routes.");
  await expect(page.getByRole("button", { name: "Join with passkey" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join with wallet" })).toBeVisible();

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "My Account" })).toBeVisible();
  await expect(page.locator(".account-session-panel").getByRole("link", { name: "Log in" })).toBeVisible();

  await page.goto("/testing");
  await expect(page.locator(".detail").getByText("Ready for check", { exact: true })).toBeVisible();
});

for (const [index, formatCase] of formatCases.entries()) {
  test(`renders and submits ${formatCase.label} in the UI`, async ({ page, request }) => {
    await request.post("http://127.0.0.1:4000/dev/reset");
    await page.goto("/testing");
    const detail = page.locator(".detail");
    const title = `UI format coverage ${index + 1}: ${formatCase.label}`;

    await expect(detail.getByText("Ready for check", { exact: true })).toBeVisible();
    await page.getByLabel("Question title").fill(title);
    await page.getByLabel("Question body").fill(`Coverage question for ${formatCase.label}.`);
    await page.getByLabel("Question format").selectOption(formatCase.schemaId);
    await page.getByLabel("Sponsor disclosure").fill("Demo sponsor");
    await page.getByRole("button", { name: "Ask question" }).click();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
    await expect(detail.getByRole("heading", { name: title })).toBeVisible();
    await expect(detail.getByText(formatCase.label, { exact: true })).toBeVisible();

    await switchAccount(page, "Demo Curator");
    await expect(detail.getByRole("heading", { name: title })).toBeVisible();
    await detail.getByRole("button", { name: "Open voting" }).click();
    await expect(detail.locator(".statusline").getByText("Voting open", { exact: true })).toBeVisible();

    await switchAccount(page, "Demo Resident");
    await expect(detail.locator(".statusline").getByText("Voting open", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Get voting pass" }).click();
    await expect(page.getByText("Voting pass issued.")).toBeVisible();

    await formatCase.submit(detail);
    await expect(page.locator(".message").getByText(/vote accepted/i)).toBeVisible();

    await detail.getByRole("button", { name: "Count votes" }).click();
    await expect(detail.locator(".statusline span").nth(1)).toHaveText("Results posted");
    await expect(page.getByText(`"answerSchemaId": "${formatCase.schemaId}"`)).toBeVisible();
  });
}
