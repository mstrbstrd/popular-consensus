"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  BuiltInAnswerSchemas,
  DiscussionViewDefinitions,
  type AnswerSchema,
  type BallotResponse,
  type DiscussionPostKind,
  type DiscussionViewKey
} from "@pc/shared";
import Image from "next/image";
import logoMark from "../src/logo2026_nobackground.png";

type UserAccount = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  reputation: number;
};

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: "Public" | "Private";
  defaultAuthorityLevel: string;
  credentialSchemaId: string;
  memberCount: number;
  questionCount: number;
  isMember: boolean;
  activeUserRole?: "Owner" | "Moderator" | "Member" | null;
};

type AdoptionPolicy = {
  id: string;
  authorityLevel: "Advisory" | "Recognized" | "Binding";
  eligibleQuestionTypes: string[];
  credentialSchemaIds: string[];
  status: "Proposed" | "Active" | "Suspended" | "Retired";
};

type DiscussionPost = {
  id: string;
  authorId: string;
  kind: DiscussionPostKind;
  body: string;
  createdAt: string;
};

type DiscussionView = {
  key: DiscussionViewKey;
  kind: DiscussionPostKind;
  label: string;
  count: number;
  posts: DiscussionPost[];
};

type ResultChallenge = {
  id: string;
  reasonCode: string;
  ruling: string;
  challenger: string;
};

type Question = {
  id: string;
  title: string;
  status: string;
  version: number;
  bodyHash: string;
  sponsorDisclosureHash?: string | null;
  methodologyLabel: string;
  authorityLevel: string;
  proposer: string;
  answerSchemaId: string;
  answerSchema?: AnswerSchema;
  community?: Community | null;
  poll?: {
    id: string;
    status: string;
    result?: { turnout: number; resultArtifactHash: string; finalStatus?: string } | null;
    resultChallenges?: ResultChallenge[];
  } | null;
  challenges: Array<{ id: string; reasonCode: string; ruling: string; challenger: string }>;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const emptyQuestion = {
  title: "",
  body: "",
  sponsorDisclosure: "",
  answerSchemaId: "answer-binary-support-oppose"
};

const emptyResponseDraft = {
  choices: [] as string[],
  ranking: {} as Record<string, number>,
  scaleValue: 0,
  allocations: {} as Record<string, number>,
  text: "",
  numericValue: 0
};

const discussionKindLabels: Record<DiscussionPostKind, string> = {
  Comment: "Comment",
  Source: "Source",
  ProArgument: "Pro",
  ConArgument: "Con",
  ClarifyingQuestion: "Clarifying",
  ModeratorNote: "Moderator"
};

function formatStatus(status: string) {
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function buildDiscussionViews(posts: DiscussionPost[]): DiscussionView[] {
  return DiscussionViewDefinitions.map((view) => {
    const viewPosts = posts.filter((post) => post.kind === view.kind);
    return { key: view.key, kind: view.kind, label: view.label, count: viewPosts.length, posts: viewPosts };
  });
}

function authorityCopy(authorityLevel: string) {
  if (authorityLevel === "Binding") {
    return "Binding means a recognized decision-maker has committed to honor the result under an adoption policy.";
  }
  if (authorityLevel === "Recognized") {
    return "Recognized means the community has a stated adoption policy, but implementation still sits outside this demo.";
  }
  return "Advisory signals community preference; no automatic legal or operational effect is implied.";
}

function lifecycleSummary(question: Question | null, pollStatus: string, pendingChallenge: Question["challenges"][number] | null) {
  if (!question) {
    return {
      label: "No question selected",
      body: "Choose a question from the feed to review its registry state, ballot controls, and artifacts."
    };
  }
  if (pendingChallenge) {
    return {
      label: "Challenge pending",
      body: "A wording or eligibility challenge is active. Rule on it or let the proposer amend before opening the poll."
    };
  }
  if (question.status === "Submitted" && pollStatus === "Configured") {
    return {
      label: "Registry review",
      body: "The proposal bond is escrowed and the poll is configured. Review scope, disclosure, and challenges before opening voting."
    };
  }
  if (pollStatus === "Open") {
    return {
      label: "Encrypted voting open",
      body: "Eligible members can issue a demo credential and submit one encrypted ballot with duplicate-nullifier protection."
    };
  }
  if (pollStatus === "ResultPublished") {
    return {
      label: "Result artifact published",
      body: "The coordinator has published aggregate counts, turnout, privacy report, and proof references."
    };
  }
  if (question.status === "Rejected") {
    return {
      label: "Rejected in review",
      body: "A challenge was sustained. The poll remains closed unless a new proposal is submitted."
    };
  }
  return {
    label: formatStatus(question.status),
    body: question.poll ? `Poll status: ${formatStatus(pollStatus)}.` : "No poll has been configured for this question."
  };
}

function buildDraftResponse(answerSchema: AnswerSchema, draft: typeof emptyResponseDraft): BallotResponse {
  if (answerSchema.responseShape === "MultipleChoice") {
    return { type: "multiple_choice", choices: draft.choices };
  }
  if (answerSchema.responseShape === "RankedChoice") {
    const ranking = answerSchema.options
      .map((option) => ({ id: option.id, rank: draft.ranking[option.id] ?? 0 }))
      .filter((item) => item.rank > 0)
      .sort((left, right) => left.rank - right.rank)
      .map((item) => item.id);
    return { type: "ranked_choice", ranking };
  }
  if (answerSchema.responseShape === "Scale") {
    return { type: "scale", value: draft.scaleValue || answerSchema.validationRules.minValue || 1 };
  }
  if (answerSchema.responseShape === "BudgetAllocation") {
    return { type: "budget_allocation", allocations: draft.allocations };
  }
  if (answerSchema.responseShape === "Numeric") {
    return { type: "numeric", value: draft.numericValue };
  }
  if (answerSchema.responseShape === "FreeText") {
    return { type: "free_text", text: draft.text };
  }
  return { type: "single_choice", choice: "abstain" };
}

export function TransitDemo() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [activeUserId, setActiveUserId] = useState("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState("community-vancouver");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ credentialId: string; credentialSecret: string } | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState("Choose a community or propose a civic question.");
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", displayName: "" });
  const [newCommunity, setNewCommunity] = useState({ name: "", description: "", visibility: "Public" as "Public" | "Private" });
  const [adoptionPolicies, setAdoptionPolicies] = useState<AdoptionPolicy[]>([]);
  const [adoptionDraft, setAdoptionDraft] = useState({ authorityLevel: "Recognized" as "Recognized" | "Binding", legalHandoff: "" });
  const [discussion, setDiscussion] = useState<DiscussionPost[]>([]);
  const [discussionViews, setDiscussionViews] = useState<DiscussionView[]>(buildDiscussionViews([]));
  const [activeDiscussionView, setActiveDiscussionView] = useState<DiscussionViewKey>("comments");
  const [discussionDraftKind, setDiscussionDraftKind] = useState<DiscussionPostKind>("Comment");
  const [discussionDraft, setDiscussionDraft] = useState("");
  const [archive, setArchive] = useState<unknown>(null);
  const [draft, setDraft] = useState(emptyQuestion);
  const [responseDraft, setResponseDraft] = useState(emptyResponseDraft);

  const activeUser = useMemo(() => users.find((user) => user.id === activeUserId) ?? users[0] ?? null, [users, activeUserId]);
  const selectedCommunity = useMemo(
    () => (selectedCommunityId === "all" ? null : communities.find((community) => community.id === selectedCommunityId) ?? communities[0] ?? null),
    [communities, selectedCommunityId]
  );
  const selected = useMemo(() => questions.find((question) => question.id === selectedId) ?? questions[0] ?? null, [questions, selectedId]);
  const activeAnswerSchema = useMemo(
    () => selected?.answerSchema ?? BuiltInAnswerSchemas.find((schema) => schema.answerSchemaId === selected?.answerSchemaId) ?? BuiltInAnswerSchemas[0],
    [selected]
  );
  const pollStatus = selected?.poll?.status ?? "NotCreated";
  const pollStatusLabel = selected?.poll ? `Poll ${formatStatus(pollStatus)}` : "No poll";
  const isPollOpen = pollStatus === "Open";
  const canLoadResult = Boolean(selected?.poll?.result) || pollStatus === "ResultPublished";
  const activeCommunityIsPrivate = selectedCommunity?.visibility === "Private";
  const pendingChallenge = selected?.challenges?.find((challenge) => challenge.ruling === "Pending") ?? null;
  const activeUserRole = selectedCommunity?.activeUserRole ?? null;
  const canCurateSelectedCommunity = activeUserRole === "Owner" || activeUserRole === "Moderator";
  const activeUserIsProposer = Boolean(selected && activeUser?.id === selected.proposer);
  const activeUserIsChallenger = Boolean(pendingChallenge && activeUser?.id === pendingChallenge.challenger);
  const pendingResultChallenge = selected?.poll?.resultChallenges?.find((challenge) => challenge.ruling === "Pending") ?? null;
  const canFinalizeResult = Boolean(
    selected?.poll?.result &&
      !pendingResultChallenge &&
      ["Published", "Corrected"].includes(selected.poll.result.finalStatus ?? "Published") &&
      canCurateSelectedCommunity
  );
  const visibleDiscussionViews = discussionViews.length ? discussionViews : buildDiscussionViews(discussion);
  const activeDiscussionPanel = visibleDiscussionViews.find((view) => view.key === activeDiscussionView) ?? visibleDiscussionViews[0];
  const activeDiscussionPosts = activeDiscussionPanel?.posts ?? [];
  const canChallengeQuestion = Boolean(selected && activeUser && !activeUserIsProposer && ["Submitted", "Challenged", "Accepted"].includes(selected.status));
  const canAmendQuestion = Boolean(selected && activeUser?.id === selected.proposer && ["Submitted", "Challenged", "Amendment"].includes(selected.status));
  const canAcceptQuestion = Boolean(
    selected?.poll &&
      activeUser &&
      canCurateSelectedCommunity &&
      !activeUserIsProposer &&
      pollStatus === "Configured" &&
      ["Submitted", "Accepted"].includes(selected.status) &&
      !pendingChallenge
  );
  const canRuleChallenge = Boolean(pendingChallenge && activeUser && canCurateSelectedCommunity && !activeUserIsProposer && !activeUserIsChallenger);
  const canProposeQuestion = Boolean(
    activeUser && selectedCommunity && (selectedCommunity.visibility === "Public" || selectedCommunity.isMember)
  );
  const lifecycle = lifecycleSummary(selected, pollStatus, pendingChallenge);
  const challengeDisabledReason = selected
    ? !activeUser
      ? "Choose an account before opening a challenge."
      : activeUserIsProposer
      ? "Proposer cannot challenge their own question."
      : canChallengeQuestion
      ? ""
      : "Challenges are only available before a poll opens or after a challenge is rejected."
    : "Select a question before opening a challenge.";
  const acceptDisabledReason = selected
    ? !activeUser
      ? "Choose an account before accepting a question."
      : activeUserIsProposer
      ? "Proposer cannot accept their own question."
      : !canCurateSelectedCommunity
      ? "Only community owners or moderators can accept registry questions."
      : !selected.poll
      ? "This question does not have a configured poll."
      : pendingChallenge
      ? "Resolve the pending challenge before opening the poll."
      : pollStatus !== "Configured"
      ? "The poll must be configured and still closed."
      : ["Submitted", "Accepted"].includes(selected.status)
      ? ""
      : "Only submitted or accepted registry items can open a poll."
    : "Select a question before accepting it.";
  const amendDisabledReason = selected
    ? activeUser?.id !== selected.proposer
      ? "Only the original proposer can amend this question."
      : canAmendQuestion
      ? ""
      : "Amendments are only available during registry review or remand."
    : "Select a question before amending it.";
  const rulingDisabledReason = pendingChallenge
    ? !activeUser
      ? "Choose an account before ruling."
      : activeUserIsProposer
      ? "Proposer cannot rule on their own question challenge."
      : activeUserIsChallenger
      ? "Challenger cannot rule on their own challenge."
      : !canCurateSelectedCommunity
      ? "Only community owners or moderators can rule on challenges."
      : ""
    : "Open or select a pending challenge before ruling.";
  const credentialDisabledReason = activeUser ? "" : "Choose an account before issuing a credential.";
  const ballotDisabledReason = selected?.poll
    ? !isPollOpen
      ? pollStatus === "Configured"
        ? "Voting opens after registry acceptance."
        : pollStatus === "ResultPublished"
        ? "Voting is closed because results are published."
        : `Voting is disabled while the poll is ${formatStatus(pollStatus)}.`
      : credential
      ? ""
      : "Issue a demo resident credential before submitting an encrypted ballot."
    : "Open a poll before voting.";
  const closeDisabledReason = selected?.poll
    ? isPollOpen
      ? ""
      : "Close and tally is available only while the poll is open."
    : "Open a poll before tallying.";
  const resultDisabledReason = selected?.poll
    ? canLoadResult
      ? ""
      : "A result artifact appears after close and tally."
    : "No poll is attached to this question.";
  const proposeDisabledReason = activeUser
    ? selectedCommunity
      ? selectedCommunity.visibility === "Private" && !selectedCommunity.isMember
        ? "Join this private community before proposing a question."
        : ""
      : "Choose one community, not the all-feed, before proposing."
    : "Choose or create an account before proposing.";
  const registryHint = pendingChallenge
    ? "Pending challenge must be ruled on or amended before acceptance."
    : acceptDisabledReason || challengeDisabledReason || amendDisabledReason;

  async function call(path: string, init?: RequestInit) {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }

  async function runAction(action: () => Promise<void>) {
    setActionPending(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setActionPending(false);
    }
  }

  async function refreshQuestions(communityId: string, userId: string, preferredQuestionId = selectedId) {
    setFeedLoading(true);
    setFeedError("");
    const params = new URLSearchParams();
    if (communityId && communityId !== "all") params.set("communityId", communityId);
    if (userId) params.set("userId", userId);
    try {
      const response = await fetch(`${apiBase}/questions?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setQuestions([]);
        setSelectedId(null);
        setResult(null);
        const errorMessage = data.error ?? "Question feed failed to load";
        setFeedError(errorMessage);
        throw new Error(errorMessage);
      }
      const nextQuestions = data.questions ?? [];
      const nextSelectedId =
        preferredQuestionId && nextQuestions.some((question: Question) => question.id === preferredQuestionId)
          ? preferredQuestionId
          : nextQuestions[0]?.id ?? null;

      setQuestions(nextQuestions);
      setSelectedId(nextSelectedId);
      if (nextSelectedId !== selectedId) {
        setResult(null);
        setResponseDraft(emptyResponseDraft);
      }
    } finally {
      setFeedLoading(false);
    }
  }

  async function refreshAdoption(communityId: string, userId: string) {
    if (!communityId || communityId === "all") {
      setAdoptionPolicies([]);
      return;
    }
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    const data = await call(`/communities/${communityId}/adoption?${params.toString()}`);
    setAdoptionPolicies(data.policies ?? []);
  }

  async function refreshDiscussion(questionId: string, userId: string) {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    const data = await call(`/questions/${questionId}/discussion?${params.toString()}`);
    const nextDiscussion = data.discussion ?? [];
    setDiscussion(nextDiscussion);
    setDiscussionViews(data.views ?? buildDiscussionViews(nextDiscussion));
  }

  async function refreshAll(nextCommunityId = selectedCommunityId, nextUserId = activeUserId, preferredQuestionId = selectedId) {
    setFeedLoading(true);
    setFeedError("");
    try {
      const usersResponse = await fetch(`${apiBase}/users`, { cache: "no-store" });
      const usersData = await usersResponse.json();
      if (!usersResponse.ok) throw new Error(usersData.error ?? "Accounts failed to load");
      const nextUsers = usersData.users ?? [];
      setUsers(nextUsers);

      const effectiveUserId = nextUserId || nextUsers[0]?.id || "";
      if (!activeUserId && effectiveUserId) setActiveUserId(effectiveUserId);

      const communityParams = new URLSearchParams();
      if (effectiveUserId) communityParams.set("userId", effectiveUserId);
      const communitiesResponse = await fetch(`${apiBase}/communities?${communityParams.toString()}`, { cache: "no-store" });
      const communitiesData = await communitiesResponse.json();
      if (!communitiesResponse.ok) throw new Error(communitiesData.error ?? "Communities failed to load");
      const nextCommunities = communitiesData.communities ?? [];
      setCommunities(nextCommunities);

      const effectiveCommunityId =
        nextCommunityId === "all"
          ? "all"
          : nextCommunityId && nextCommunities.some((community: Community) => community.id === nextCommunityId)
          ? nextCommunityId
          : nextCommunities[0]?.id ?? "";
      if (effectiveCommunityId && selectedCommunityId !== effectiveCommunityId) setSelectedCommunityId(effectiveCommunityId);
      if (effectiveCommunityId) {
        await refreshQuestions(effectiveCommunityId, effectiveUserId, preferredQuestionId);
        if (effectiveCommunityId !== "all") await refreshAdoption(effectiveCommunityId, effectiveUserId);
      } else {
        setQuestions([]);
        setSelectedId(null);
        setFeedLoading(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Dashboard failed to load";
      setQuestions([]);
      setSelectedId(null);
      setResult(null);
      setFeedError(errorMessage);
      setFeedLoading(false);
      throw error;
    }
  }

  useEffect(() => {
    const storedUserId = window.localStorage.getItem("pc.activeUserId") ?? "";
    if (storedUserId) setActiveUserId(storedUserId);
    void refreshAll("community-vancouver", storedUserId).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (activeUserId) window.localStorage.setItem("pc.activeUserId", activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    if (!selected?.id) {
      setDiscussion([]);
      setDiscussionViews(buildDiscussionViews([]));
      return;
    }
    void refreshDiscussion(selected.id, activeUser?.id ?? "").catch(() => {
      setDiscussion([]);
      setDiscussionViews(buildDiscussionViews([]));
    });
  }, [selected?.id, activeUser?.id]);

  useEffect(() => {
    if (!selectedCommunity?.id) {
      setAdoptionPolicies([]);
      return;
    }
    void refreshAdoption(selectedCommunity.id, activeUser?.id ?? "").catch(() => setAdoptionPolicies([]));
  }, [selectedCommunity?.id, activeUser?.id]);

  async function switchUser(userId: string) {
    setActiveUserId(userId);
    setCredential(null);
    setResult(null);
    setArchive(null);
    setResponseDraft(emptyResponseDraft);
    setQuestions([]);
    setSelectedId(null);
    await refreshAll(selectedCommunityId, userId);
  }

  async function selectCommunity(community: Community) {
    setSelectedCommunityId(community.id);
    setSelectedId(null);
    setQuestions([]);
    setResult(null);
    setArchive(null);
    setResponseDraft(emptyResponseDraft);
    await refreshQuestions(community.id, activeUser?.id ?? "");
    setMessage(
      community.visibility === "Private"
        ? `${community.name} is private. Only active members can view and propose questions.`
        : `${community.name} feed loaded.`
    );
  }

  async function selectAllFeed() {
    setSelectedCommunityId("all");
    setSelectedId(null);
    setResult(null);
    setArchive(null);
    setResponseDraft(emptyResponseDraft);
    await refreshQuestions("all", activeUser?.id ?? "");
    setMessage("All visible communities loaded. Private questions only appear for active members.");
  }

  function selectQuestion(question: Question) {
    setSelectedId(question.id);
    setResult(null);
    setArchive(null);
    setResponseDraft(emptyResponseDraft);
    if (question.poll?.status === "Open") {
      setMessage("Poll is open. Issue a demo resident credential to submit one encrypted ballot.");
      return;
    }
    if (question.poll?.status === "ResultPublished") {
      setMessage("Poll has published aggregate result artifacts. Load the result to inspect them.");
      return;
    }
    setMessage(
      question.poll?.status === "Configured"
        ? "Question is in registry review. Resolve challenges, then accept it to open the poll."
        : question.poll
        ? `Poll status: ${formatStatus(question.poll.status)}.`
        : "No poll has been opened for this question."
    );
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await call("/users", { method: "POST", body: JSON.stringify(newUser) });
    setNewUser({ username: "", displayName: "" });
    setActiveUserId(data.user.id);
    setMessage(`Account created for ${data.user.displayName}.`);
    await refreshAll(selectedCommunityId, data.user.id);
  }

  async function createCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser) throw new Error("Create an account before creating a community");
    const data = await call("/communities", {
      method: "POST",
      body: JSON.stringify({ ...newCommunity, creatorId: activeUser.id })
    });
    setNewCommunity({ name: "", description: "", visibility: "Public" });
    setSelectedCommunityId(data.community.id);
    setMessage(`${data.community.name} created.`);
    await refreshAll(data.community.id, activeUser.id);
  }

  async function joinCommunity(community: Community) {
    if (!activeUser) throw new Error("Create an account before joining a community");
    await call(`/communities/${community.id}/join`, { method: "POST", body: JSON.stringify({ userId: activeUser.id }) });
    setSelectedCommunityId(community.id);
    setMessage(`${activeUser.displayName} joined ${community.name}.`);
    await refreshAll(community.id, activeUser.id);
  }

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser || !selectedCommunity) throw new Error("Choose an account and community first");
    const data = await call("/questions", {
      method: "POST",
      body: JSON.stringify({
        ...draft,
        proposer: activeUser.id,
        communityId: selectedCommunity.id,
        topicIds: ["community", selectedCommunity.slug],
        geoScope: selectedCommunity.name,
        methodologyLabel: `Verified ${selectedCommunity.name} community response, self-selected sample`,
        credentialSchemaId: selectedCommunity.credentialSchemaId
      })
    });
    setDraft(emptyQuestion);
    setSelectedId(data.question.id);
    setMessage(`Question submitted with ${data.stakedPc} PC proposal stake and sent to registry review.`);
    await refreshAll(selectedCommunity.id, activeUser.id, data.question.id);
  }

  async function challengeQuestion() {
    if (!selected) return;
    const data = await call(`/questions/${selected.id}/challenges`, {
      method: "POST",
      body: JSON.stringify({ challenger: activeUser?.id ?? "demo-challenger" })
    });
    setMessage(`Challenge opened with ${data.stakedPc} PC challenge stake.`);
    await refreshAll(selectedCommunity?.id, activeUser?.id, selected.id);
  }

  async function acceptQuestion() {
    if (!selected || !activeUser) return;
    await call(`/questions/${selected.id}/accept`, {
      method: "POST",
      body: JSON.stringify({ curator: activeUser.id })
    });
    setMessage("Question accepted into the registry and poll opened.");
    await refreshAll(selectedCommunity?.id, activeUser.id, selected.id);
  }

  async function ruleChallenge(ruling: "Sustained" | "Rejected" | "Remanded") {
    if (!selected || !pendingChallenge || !activeUser) return;
    await call(`/questions/${selected.id}/challenges/${pendingChallenge.id}/ruling`, {
      method: "POST",
      body: JSON.stringify({
        ruling,
        juror: activeUser.id,
        resolution:
          ruling === "Sustained"
            ? "The challenge is sustained under demo registry rules."
            : ruling === "Rejected"
            ? "The challenge is rejected under demo registry rules."
            : "The challenge is remanded for proposer amendment."
      })
    });
    setMessage(
      ruling === "Sustained"
        ? "Challenge sustained. Question rejected and proposal bond settled."
        : ruling === "Rejected"
        ? "Challenge rejected. Question accepted for registry opening."
        : "Challenge remanded. Proposer can amend and resubmit."
    );
    await refreshAll(selectedCommunity?.id, activeUser.id, selected.id);
  }

  async function amendQuestion() {
    if (!selected) return;
    await call(`/questions/${selected.id}/amendments`, {
      method: "POST",
      body: JSON.stringify({
        proposer: activeUser?.id ?? "demo-proposer",
        body: "A community advisory poll with clarified scope, temporary implementation, and post-pilot review."
      })
    });
    setMessage("Question amended and returned to registry review.");
    await refreshAll(selectedCommunity?.id, activeUser?.id, selected.id);
  }

  async function issueCredential() {
    const data = await call("/credentials/demo-resident", {
      method: "POST",
      body: JSON.stringify({ holderAlias: activeUser?.id ?? "demo-resident" })
    });
    setCredential({
      credentialId: data.credential.credentialId,
      credentialSecret: data.credential.secret
    });
    setMessage("Demo resident credential issued. Secret is held in browser state for this local demo.");
  }

  async function vote(response: BallotResponse, label: string) {
    if (!selected?.poll || !credential || !isPollOpen) return;
    await call(`/polls/${selected.poll.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ ...credential, response })
    });
    setMessage(`Encrypted ${label} ballot accepted. Try voting twice to see duplicate nullifier protection.`);
    await refreshAll(selectedCommunity?.id, activeUser?.id, selected.id);
  }

  async function submitDraftResponse() {
    const response = buildDraftResponse(activeAnswerSchema, responseDraft);
    await vote(response, activeAnswerSchema.label.toLowerCase());
  }

  async function closeAndTally() {
    if (!selected?.poll || !isPollOpen) return;
    await call(`/polls/${selected.poll.id}/close`, { method: "POST", body: "{}" });
    const data = await call(`/polls/${selected.poll.id}/tally`, { method: "POST", body: "{}" });
    setResult(data.artifact);
    setMessage("Poll closed and coordinator published aggregate result artifacts.");
    await refreshAll(selectedCommunity?.id, activeUser?.id, selected.id);
  }

  async function loadResult() {
    if (!selected?.poll) return;
    const params = new URLSearchParams();
    if (activeUser?.id) params.set("userId", activeUser.id);
    const data = await call(`/polls/${selected.poll.id}/results?${params.toString()}`);
    setResult(data.artifact);
    setMessage("Loaded public result artifact.");
  }

  async function challengeResult() {
    if (!selected?.poll || !activeUser) return;
    const data = await call(`/polls/${selected.poll.id}/results/challenges`, {
      method: "POST",
      body: JSON.stringify({
        challenger: activeUser.id,
        reasonCode: "PrivacyThresholdViolation",
        evidence: "Review the published privacy report before finalization."
      })
    });
    setMessage(`Result challenge opened with ${data.stakedPc} PC challenge stake.`);
    await refreshAll(selectedCommunity?.id, activeUser.id, selected.id);
  }

  async function ruleResultChallenge(ruling: "Sustained" | "Rejected") {
    if (!selected?.poll || !pendingResultChallenge || !activeUser) return;
    await call(`/polls/${selected.poll.id}/results/challenges/${pendingResultChallenge.id}/ruling`, {
      method: "POST",
      body: JSON.stringify({
        ruling,
        juror: activeUser.id,
        resolution:
          ruling === "Sustained"
            ? "Privacy review sustained; corrected artifact annotates the result before finalization."
            : "Privacy review rejected; result can proceed to finalization."
      })
    });
    setMessage(ruling === "Sustained" ? "Result challenge sustained and artifact corrected." : "Result challenge rejected.");
    await refreshAll(selectedCommunity?.id, activeUser.id, selected.id);
  }

  async function finalizeAndArchive() {
    if (!selected?.poll || !activeUser) return;
    await call(`/polls/${selected.poll.id}/finalize`, { method: "POST", body: JSON.stringify({ curator: activeUser.id }) });
    const data = await call(`/questions/${selected.id}/archive`, { method: "POST", body: JSON.stringify({ curator: activeUser.id }) });
    setArchive(data.artifact);
    setMessage("Result finalized and public archive published.");
    await refreshAll(selectedCommunity?.id, activeUser.id, selected.id);
  }

  async function loadArchive() {
    if (!selected || !activeUser) return;
    const params = new URLSearchParams();
    params.set("userId", activeUser.id);
    const data = await call(`/questions/${selected.id}/archive?${params.toString()}`);
    setArchive(data.artifact);
    setMessage("Loaded archived civic record.");
  }

  async function postDiscussion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !activeUser) return;
    await call(`/questions/${selected.id}/discussion`, {
      method: "POST",
      body: JSON.stringify({ authorId: activeUser.id, kind: discussionDraftKind, body: discussionDraft })
    });
    setDiscussionDraft("");
    setActiveDiscussionView(DiscussionViewDefinitions.find((view) => view.kind === discussionDraftKind)?.key ?? "comments");
    setMessage(`${discussionKindLabels[discussionDraftKind]} note posted.`);
    await refreshDiscussion(selected.id, activeUser.id);
  }

  async function proposeAdoptionPolicy() {
    if (!selectedCommunity || !activeUser) return;
    const data = await call(`/communities/${selectedCommunity.id}/adoption/proposals`, {
      method: "POST",
      body: JSON.stringify({
        steward: activeUser.id,
        authorityLevel: adoptionDraft.authorityLevel,
        eligibleQuestionTypes: ["community", selectedCommunity.slug],
        credentialSchemaIds: [selectedCommunity.credentialSchemaId],
        quorumRule: "Community steward review for local MVP.",
        approvalRule: "Community steward activation recorded in the archive.",
        legalHandoff: adoptionDraft.authorityLevel === "Binding" ? adoptionDraft.legalHandoff : undefined,
        forkRule: "Community may fork metadata and archive references."
      })
    });
    setMessage(`${data.policy.authorityLevel} adoption policy proposed.`);
    await refreshAdoption(selectedCommunity.id, activeUser.id);
  }

  async function activateAdoptionPolicy(policyId: string) {
    if (!selectedCommunity || !activeUser) return;
    await call(`/communities/${selectedCommunity.id}/adoption/policies/${policyId}/activate`, {
      method: "POST",
      body: JSON.stringify({ steward: activeUser.id, adoptionRecord: "Community steward activated the policy for local MVP." })
    });
    setMessage("Adoption policy activated.");
    await refreshAdoption(selectedCommunity.id, activeUser.id);
  }

  async function suspendAdoptionPolicy(policyId: string) {
    if (!selectedCommunity || !activeUser) return;
    await call(`/communities/${selectedCommunity.id}/adoption/policies/${policyId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ steward: activeUser.id, reason: "Community steward paused this policy pending review." })
    });
    setMessage("Adoption policy suspended.");
    await refreshAdoption(selectedCommunity.id, activeUser.id);
  }

  function renderBallotControls() {
    const disabled = Boolean(ballotDisabledReason) || actionPending;
    if (!selected?.poll) return null;

    if (activeAnswerSchema.responseShape === "SingleChoice") {
      return (
        <>
          {activeAnswerSchema.options.map((option) => (
            <button
              key={option.id}
              onClick={() => void runAction(() => vote({ type: "single_choice", choice: option.id }, option.label.toLowerCase()))}
              disabled={disabled}
              title={ballotDisabledReason || undefined}
            >
              Vote {option.label.toLowerCase()}
            </button>
          ))}
          {activeAnswerSchema.allowsAbstain ? (
            <button
              onClick={() => void runAction(() => vote({ type: "single_choice", choice: "abstain" }, "abstain"))}
              disabled={disabled}
              title={ballotDisabledReason || undefined}
            >
              Vote abstain
            </button>
          ) : null}
        </>
      );
    }

    if (activeAnswerSchema.responseShape === "MultipleChoice") {
      return (
        <div className="ballot-control">
          {activeAnswerSchema.options.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={responseDraft.choices.includes(option.id)}
                onChange={(event) =>
                  setResponseDraft((current) => ({
                    ...current,
                    choices: event.target.checked ? [...current.choices, option.id] : current.choices.filter((choice) => choice !== option.id)
                  }))
                }
                disabled={disabled}
                title={ballotDisabledReason || undefined}
              />
              {option.label}
            </label>
          ))}
          <button onClick={() => void runAction(submitDraftResponse)} disabled={disabled} title={ballotDisabledReason || undefined}>
            Submit response
          </button>
        </div>
      );
    }

    if (activeAnswerSchema.responseShape === "RankedChoice") {
      return (
        <div className="ballot-control">
          {activeAnswerSchema.options.map((option) => (
            <label key={option.id}>
              {option.label}
              <input
                aria-label={`Rank ${option.label}`}
                min={0}
                max={activeAnswerSchema.options.length}
                type="number"
                value={responseDraft.ranking[option.id] ?? 0}
                onChange={(event) =>
                  setResponseDraft((current) => ({
                    ...current,
                    ranking: { ...current.ranking, [option.id]: Number(event.target.value) }
                  }))
                }
                disabled={disabled}
                title={ballotDisabledReason || undefined}
              />
            </label>
          ))}
          <button onClick={() => void runAction(submitDraftResponse)} disabled={disabled} title={ballotDisabledReason || undefined}>
            Submit ranking
          </button>
        </div>
      );
    }

    if (activeAnswerSchema.responseShape === "Scale") {
      const min = activeAnswerSchema.validationRules.minValue ?? 1;
      const max = activeAnswerSchema.validationRules.maxValue ?? 5;
      const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
      return (
        <>
          {values.map((value) => (
            <button
              key={value}
              onClick={() => void runAction(() => vote({ type: "scale", value }, String(value)))}
              disabled={disabled}
              title={ballotDisabledReason || undefined}
            >
              {value}
            </button>
          ))}
          {activeAnswerSchema.allowsAbstain ? (
            <button
              onClick={() => void runAction(() => vote({ type: "single_choice", choice: "abstain" }, "abstain"))}
              disabled={disabled}
              title={ballotDisabledReason || undefined}
            >
              Vote abstain
            </button>
          ) : null}
        </>
      );
    }

    if (activeAnswerSchema.responseShape === "BudgetAllocation") {
      const budgetTotal = activeAnswerSchema.validationRules.budgetTotal ?? 100;
      const currentTotal = activeAnswerSchema.options.reduce((sum, option) => sum + (responseDraft.allocations[option.id] ?? 0), 0);
      return (
        <div className="ballot-control">
          {activeAnswerSchema.options.map((option) => (
            <label key={option.id}>
              {option.label}
              <input
                aria-label={`Allocate to ${option.label}`}
                min={0}
                max={budgetTotal}
                type="number"
                value={responseDraft.allocations[option.id] ?? 0}
                onChange={(event) =>
                  setResponseDraft((current) => ({
                    ...current,
                    allocations: { ...current.allocations, [option.id]: Number(event.target.value) }
                  }))
                }
                disabled={disabled}
                title={ballotDisabledReason || undefined}
              />
            </label>
          ))}
          <small>{currentTotal}/{budgetTotal}</small>
          <button
            onClick={() => void runAction(submitDraftResponse)}
            disabled={disabled || currentTotal !== budgetTotal}
            title={ballotDisabledReason || (currentTotal !== budgetTotal ? `Allocate exactly ${budgetTotal} points before submitting.` : undefined)}
          >
            Submit allocation
          </button>
        </div>
      );
    }

    if (activeAnswerSchema.responseShape === "FreeText") {
      return (
        <div className="ballot-control">
          <textarea
            aria-label="Text response"
            placeholder="Response"
            value={responseDraft.text}
            onChange={(event) => setResponseDraft((current) => ({ ...current, text: event.target.value }))}
            disabled={disabled}
            title={ballotDisabledReason || undefined}
          />
          <button
            onClick={() => void runAction(submitDraftResponse)}
            disabled={disabled || !responseDraft.text.trim()}
            title={ballotDisabledReason || (!responseDraft.text.trim() ? "Enter a response before submitting." : undefined)}
          >
            Submit response
          </button>
        </div>
      );
    }

    return (
      <div className="ballot-control">
        <input
          aria-label="Numeric response"
          type="number"
          value={responseDraft.numericValue}
          onChange={(event) => setResponseDraft((current) => ({ ...current, numericValue: Number(event.target.value) }))}
          disabled={disabled}
          title={ballotDisabledReason || undefined}
        />
        <button onClick={() => void runAction(submitDraftResponse)} disabled={disabled} title={ballotDisabledReason || undefined}>
          Submit response
        </button>
      </div>
    );
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brand-lockup">
          <Image className="brand-mark" src={logoMark} alt="" priority />
          <div>
            <p className="eyebrow">Popular Consensus MVP</p>
            <h1>Civic Communities</h1>
          </div>
        </div>
        <div className="account-switcher">
          <label htmlFor="active-user">Account</label>
          <select id="active-user" value={activeUser?.id ?? ""} onChange={(event) => void runAction(() => switchUser(event.target.value))}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="social-grid">
        <aside className="panel sidebar">
          <h2>Communities</h2>
          <div className="list">
            <button className={selectedCommunityId === "all" ? "row active" : "row"} onClick={() => void runAction(selectAllFeed)}>
              <span>All visible communities</span>
              <small>Public spaces plus private spaces you have joined</small>
            </button>
            {communities.map((community) => (
              <button
                className={community.id === selectedCommunity?.id ? "row active" : "row"}
                key={community.id}
                onClick={() => void runAction(() => selectCommunity(community))}
              >
                <span>p/{community.slug}</span>
                <small>
                  {community.visibility} · {community.memberCount} members · {community.questionCount} questions
                </small>
              </button>
            ))}
          </div>

          {selectedCommunity && !selectedCommunity.isMember ? (
            <button className="wide-action" onClick={() => void runAction(() => joinCommunity(selectedCommunity))} disabled={actionPending}>
              Join {selectedCommunity.visibility.toLowerCase()} community
            </button>
          ) : null}

          <form className="stacked-form" onSubmit={(event) => void runAction(() => createCommunity(event))}>
            <h3>Create Community</h3>
            <input
              aria-label="Community name"
              placeholder="Community name"
              value={newCommunity.name}
              onChange={(event) => setNewCommunity((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <textarea
              aria-label="Community description"
              placeholder="Description"
              value={newCommunity.description}
              onChange={(event) => setNewCommunity((current) => ({ ...current, description: event.target.value }))}
              required
            />
            <select
              aria-label="Community visibility"
              value={newCommunity.visibility}
              onChange={(event) => setNewCommunity((current) => ({ ...current, visibility: event.target.value as "Public" | "Private" }))}
            >
              <option value="Public">Public</option>
              <option value="Private">Private</option>
            </select>
            <button type="submit" disabled={!activeUser || actionPending} title={!activeUser ? "Choose or create an account first." : undefined}>
              Create community
            </button>
          </form>
        </aside>

        <section className="feed">
          <section className="panel community-hero">
            <div>
              <p className="eyebrow">{selectedCommunity ? `p/${selectedCommunity.slug}` : "Community"}</p>
              <h2>{selectedCommunity?.name ?? "All Visible Communities"}</h2>
              <p>{selectedCommunity?.description ?? "A combined feed of public questions and private questions from communities you have joined."}</p>
            </div>
            <div className="statusline">
              <span className={activeCommunityIsPrivate ? "poll-closed" : "poll-open"}>{selectedCommunity?.visibility ?? "Mixed"}</span>
              <span>{selectedCommunity?.defaultAuthorityLevel ?? "Advisory default"}</span>
              <span className={selectedCommunity?.isMember ? "poll-open" : "poll-closed"}>
                {selectedCommunity ? (selectedCommunity.isMember ? "Member" : "Not joined") : "Visible to account"}
              </span>
            </div>
          </section>

          <form className="panel compose" onSubmit={(event) => void runAction(() => createQuestion(event))}>
            <div className="section-heading">
              <div>
                <h2>Propose a Question</h2>
                <p className="muted">Submissions enter registry review with a 100 PC proposal stake before voting opens.</p>
              </div>
              <span className="badge-soft">{selectedCommunity?.defaultAuthorityLevel ?? "Advisory"}</span>
            </div>
            <input
              aria-label="Question title"
              placeholder="Question title"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <textarea
              aria-label="Question body"
              placeholder="Context, scope, and what a support response means"
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              required
            />
            <select
              aria-label="Question format"
              value={draft.answerSchemaId}
              onChange={(event) => setDraft((current) => ({ ...current, answerSchemaId: event.target.value }))}
            >
              {BuiltInAnswerSchemas.map((schema) => (
                <option key={schema.answerSchemaId} value={schema.answerSchemaId}>
                  {schema.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Sponsor disclosure"
              placeholder="Sponsor disclosure"
              value={draft.sponsorDisclosure}
              onChange={(event) => setDraft((current) => ({ ...current, sponsorDisclosure: event.target.value }))}
              required
            />
            <button type="submit" disabled={!canProposeQuestion || actionPending} title={proposeDisabledReason || undefined}>
              {selectedCommunity ? "Submit question with PC stake" : "Choose a community to propose"}
            </button>
            {!canProposeQuestion ? <small className="form-hint">{proposeDisabledReason}</small> : null}
          </form>

          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Question Feed</h2>
                <p className="muted">
                  {selectedCommunity
                    ? `${selectedCommunity.questionCount} total questions in p/${selectedCommunity.slug}`
                    : "Public communities plus private communities joined by this account"}
                </p>
              </div>
              <span className="badge-soft">{feedLoading ? "Loading" : `${questions.length} visible`}</span>
            </div>
            <div className="post-list">
              {feedLoading ? (
                <div className="empty-state">
                  <strong>Loading question feed</strong>
                  <p>Fetching the latest visible registry items for this account.</p>
                </div>
              ) : feedError ? (
                <div className="empty-state warning">
                  <strong>{feedError}</strong>
                  <p>Private community questions stay hidden until this account joins.</p>
                </div>
              ) : questions.length ? (
                questions.map((question) => (
                  <button
                    className={question.id === selected?.id ? "post active" : "post"}
                    key={question.id}
                    onClick={() => selectQuestion(question)}
                  >
                    <span className="post-community">p/{question.community?.slug ?? selectedCommunity?.slug ?? "general"}</span>
                    <strong>{question.title}</strong>
                    <span className="post-badges">
                      <small>{formatStatus(question.status)}</small>
                      <small>{question.poll ? `Poll ${formatStatus(question.poll.status)}` : "No poll"}</small>
                      <small>{question.authorityLevel}</small>
                    </span>
                    <small>
                      by {question.proposer} · {question.answerSchema?.label ?? question.answerSchemaId}
                    </small>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <strong>No questions visible yet</strong>
                  <p>
                    {selectedCommunity
                      ? selectedCommunity.visibility === "Private" && !selectedCommunity.isMember
                        ? "Join this private community to view its questions."
                        : "Propose the first question for this community."
                      : "Join private communities or choose a public community to start a proposal."}
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="panel detail">
          <div className="statusline">
            <span>{selected ? `Question ${formatStatus(selected.status)}` : "No question"}</span>
            <span className={isPollOpen ? "poll-open" : "poll-closed"}>{pollStatusLabel}</span>
            <span>{selected?.authorityLevel ?? "Advisory"}</span>
            <span>v{selected?.version ?? 1}</span>
          </div>
          <h2>{selected?.title ?? "Select a question"}</h2>
          <p>{selected?.methodologyLabel ?? "Community-scoped civic response, self-selected sample"}</p>
          {selected ? <p className="schema-line">{activeAnswerSchema.label}</p> : null}

          <section className="workflow-summary">
            <p className="eyebrow">Current Stage</p>
            <h3>{lifecycle.label}</h3>
            <p>{lifecycle.body}</p>
            <dl className="meta-grid">
              <div>
                <dt>Authority</dt>
                <dd>{selected?.authorityLevel ?? "Advisory"}</dd>
              </div>
              <div>
                <dt>Credential</dt>
                <dd>{selected?.community?.credentialSchemaId ?? selectedCommunity?.credentialSchemaId ?? "credential-vancouver-resident"}</dd>
              </div>
              <div>
                <dt>Challenges</dt>
                <dd>{selected?.challenges?.length ?? 0} total</dd>
              </div>
            </dl>
          </section>

          <div className="action-groups">
            <section className="action-group">
              <div className="group-heading">
                <h3>Registry Review</h3>
                <p>Challenge wording, resolve pending review, amend as proposer, then accept to open voting.</p>
              </div>
              <div className="actions">
                <button
                  onClick={() => void runAction(challengeQuestion)}
                  disabled={!canChallengeQuestion || actionPending}
                  title={challengeDisabledReason || undefined}
                >
                  Open wording challenge
                </button>
                <button
                  onClick={() => void runAction(() => ruleChallenge("Rejected"))}
                  disabled={!canRuleChallenge || actionPending}
                  title={rulingDisabledReason || undefined}
                >
                  Reject challenge
                </button>
                <button
                  onClick={() => void runAction(() => ruleChallenge("Sustained"))}
                  disabled={!canRuleChallenge || actionPending}
                  title={rulingDisabledReason || undefined}
                >
                  Sustain challenge
                </button>
                <button onClick={() => void runAction(amendQuestion)} disabled={!canAmendQuestion || actionPending} title={amendDisabledReason || undefined}>
                  Accept amendment
                </button>
                <button onClick={() => void runAction(acceptQuestion)} disabled={!canAcceptQuestion || actionPending} title={acceptDisabledReason || undefined}>
                  Accept and open poll
                </button>
              </div>
              {registryHint ? <small className="action-hint">{registryHint}</small> : null}
            </section>

            <section className="action-group">
              <div className="group-heading">
                <h3>Credential and Encrypted Ballot</h3>
                <p>{credential ? `Credential ready: ${credential.credentialId}` : "Issue a demo resident credential before casting a private ballot."}</p>
              </div>
              <div className="actions ballot-actions">
                <button onClick={() => void runAction(issueCredential)} disabled={!activeUser || actionPending} title={credentialDisabledReason || undefined}>
                  Issue demo resident credential
                </button>
                {renderBallotControls()}
              </div>
              {ballotDisabledReason ? <small className="action-hint">{ballotDisabledReason}</small> : null}
            </section>

            <section className="action-group">
              <div className="group-heading">
                <h3>Closeout and Artifacts</h3>
                <p>Close the open poll, tally encrypted ballots, then inspect the public aggregate artifact.</p>
              </div>
              <div className="actions">
                <button onClick={() => void runAction(closeAndTally)} disabled={!isPollOpen || actionPending} title={closeDisabledReason || undefined}>
                  Close and tally
                </button>
                <button
                  onClick={() => void runAction(loadResult)}
                  disabled={!selected?.poll || !canLoadResult || actionPending}
                  title={resultDisabledReason || undefined}
                >
                  Load result
                </button>
              </div>
              {resultDisabledReason ? <small className="action-hint">{resultDisabledReason}</small> : null}
            </section>

            <section className="action-group">
              <div className="group-heading">
                <h3>Result Integrity</h3>
                <p>Challenge aggregate artifacts, resolve review, then publish the final archive.</p>
              </div>
              <div className="actions">
                <button
                  onClick={() => void runAction(challengeResult)}
                  disabled={!selected?.poll?.result || Boolean(pendingResultChallenge) || actionPending}
                  title={!selected?.poll?.result ? "Publish a result before challenging it." : undefined}
                >
                  Challenge result
                </button>
                <button
                  onClick={() => void runAction(() => ruleResultChallenge("Rejected"))}
                  disabled={!pendingResultChallenge || !canCurateSelectedCommunity || actionPending}
                >
                  Reject result challenge
                </button>
                <button
                  onClick={() => void runAction(() => ruleResultChallenge("Sustained"))}
                  disabled={!pendingResultChallenge || !canCurateSelectedCommunity || actionPending}
                >
                  Sustain result challenge
                </button>
                <button onClick={() => void runAction(finalizeAndArchive)} disabled={!canFinalizeResult || actionPending}>
                  Finalize and archive
                </button>
                <button onClick={() => void runAction(loadArchive)} disabled={selected?.status !== "Archived" || actionPending}>
                  Load archive
                </button>
              </div>
              {pendingResultChallenge ? <small className="action-hint">Result challenge pending: {pendingResultChallenge.reasonCode}</small> : null}
            </section>

            {selectedCommunity ? (
              <section className="action-group">
                <div className="group-heading">
                  <h3>Adoption Policy</h3>
                  <p>Record recognized or binding community authority separately from advisory defaults.</p>
                </div>
                <div className="ballot-control">
                  <select
                    aria-label="Adoption authority"
                    value={adoptionDraft.authorityLevel}
                    onChange={(event) =>
                      setAdoptionDraft((current) => ({ ...current, authorityLevel: event.target.value as "Recognized" | "Binding" }))
                    }
                  >
                    <option value="Recognized">Recognized</option>
                    <option value="Binding">Binding</option>
                  </select>
                  {adoptionDraft.authorityLevel === "Binding" ? (
                    <input
                      aria-label="Legal handoff"
                      placeholder="Legal or community handoff"
                      value={adoptionDraft.legalHandoff}
                      onChange={(event) => setAdoptionDraft((current) => ({ ...current, legalHandoff: event.target.value }))}
                    />
                  ) : null}
                  <button
                    onClick={() => void runAction(proposeAdoptionPolicy)}
                    disabled={!canCurateSelectedCommunity || actionPending || (adoptionDraft.authorityLevel === "Binding" && !adoptionDraft.legalHandoff)}
                  >
                    Propose policy
                  </button>
                </div>
                <div className="post-list compact-list">
                  {adoptionPolicies.map((policy) => (
                    <div className="post" key={policy.id}>
                      <strong>
                        {policy.authorityLevel} · {policy.status}
                      </strong>
                      <small>{policy.credentialSchemaIds.join(", ")}</small>
                      <div className="actions">
                        <button
                          onClick={() => void runAction(() => activateAdoptionPolicy(policy.id))}
                          disabled={policy.status !== "Proposed" || !canCurateSelectedCommunity || actionPending}
                        >
                          Activate
                        </button>
                        <button
                          onClick={() => void runAction(() => suspendAdoptionPolicy(policy.id))}
                          disabled={policy.status !== "Active" || !canCurateSelectedCommunity || actionPending}
                        >
                          Suspend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="message" role="status">
            {actionPending ? "Working..." : message}
          </div>

          <div className="detail-stack">
            <article>
              <h3>Discussion</h3>
              <form className="stacked-form embedded-form" onSubmit={(event) => void runAction(() => postDiscussion(event))}>
                <select
                  aria-label="Discussion type"
                  value={discussionDraftKind}
                  onChange={(event) => setDiscussionDraftKind(event.target.value as DiscussionPostKind)}
                  disabled={!selected || !activeUser || actionPending}
                >
                  {DiscussionViewDefinitions.map((view) => (
                    <option key={view.kind} value={view.kind}>
                      {discussionKindLabels[view.kind]}
                    </option>
                  ))}
                </select>
                <textarea
                  aria-label="Discussion note"
                  placeholder="Add context, source notes, or a concern"
                  value={discussionDraft}
                  onChange={(event) => setDiscussionDraft(event.target.value)}
                  disabled={!selected || !activeUser || actionPending}
                />
                <button type="submit" disabled={!selected || !discussionDraft.trim() || actionPending}>
                  Post note
                </button>
              </form>
              <div className="discussion-tabs" role="tablist" aria-label="Discussion views">
                {visibleDiscussionViews.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    role="tab"
                    aria-selected={activeDiscussionView === view.key}
                    className={activeDiscussionView === view.key ? "active" : ""}
                    onClick={() => setActiveDiscussionView(view.key)}
                  >
                    <span>{view.label}</span>
                    <small>{view.count}</small>
                  </button>
                ))}
              </div>
              {activeDiscussionPosts.length ? (
                <div className="discussion-list">
                  {activeDiscussionPosts.map((post) => (
                    <div className="discussion-entry" key={post.id}>
                      <small>
                        {discussionKindLabels[post.kind]} - {post.authorId}
                      </small>
                      <p>{post.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No {activeDiscussionPanel?.label.toLowerCase() ?? "discussion"} yet.</p>
              )}
            </article>
            <article>
              <h3>Challenge History</h3>
              {selected?.challenges?.length ? (
                selected.challenges.map((challenge) => (
                  <p key={challenge.id}>
                    {challenge.reasonCode}: {challenge.ruling}
                  </p>
                ))
              ) : (
                <p>No challenges yet.</p>
              )}
            </article>
            <article>
              <h3>Authority and Adoption</h3>
              <p>{authorityCopy(selected?.authorityLevel ?? selectedCommunity?.defaultAuthorityLevel ?? "Advisory")}</p>
            </article>
            <article>
              <h3>Archive</h3>
              <p>Body: {selected?.bodyHash ?? "No body hash yet."}</p>
              <p>Sponsor: {selected?.sponsorDisclosureHash ?? "No sponsor hash yet."}</p>
            </article>
            <article>
              <h3>Privacy Note</h3>
              <p>Ballots are encrypted before storage. The API returns aggregate artifacts only, not individual choices.</p>
            </article>
            <article>
              <h3>Result Artifact</h3>
              <pre>{result ? JSON.stringify(result, null, 2) : "No published result yet."}</pre>
            </article>
            <article>
              <h3>Final Archive</h3>
              <pre>{archive ? JSON.stringify(archive, null, 2) : "No archive yet."}</pre>
            </article>
          </div>
        </aside>
      </section>

      <section className="panel account-panel">
        <form className="inline-form" onSubmit={(event) => void runAction(() => createUser(event))}>
          <h2>Create Account</h2>
          <input
            aria-label="Username"
            placeholder="username"
            value={newUser.username}
            onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value.toLowerCase() }))}
            required
          />
          <input
            aria-label="Display name"
            placeholder="Display name"
            value={newUser.displayName}
            onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))}
            required
          />
          <button type="submit">Create local account</button>
        </form>
      </section>
    </main>
  );
}
