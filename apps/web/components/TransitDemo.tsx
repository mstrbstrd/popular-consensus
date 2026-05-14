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
import {
  publicAuthorityLabel,
  publicDiscussionLabel,
  publicPollStatus,
  publicQuestionStatus,
  publicRoleLabel,
  siteCopy
} from "./copy";

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

type DiscoveryCommunity = {
  id: string;
  slug: string;
  name: string;
  visibility: "Public" | "Private";
  memberCount: number;
  questionCount: number;
  followerCount: number;
  followedByActiveUser: boolean;
};

type DiscoveryTopic = {
  topicId: string;
  questionCount: number;
  communityCount: number;
  followerCount: number;
  followedByActiveUser: boolean;
};

type DiscoveryIndex = {
  communities: DiscoveryCommunity[];
  topics: DiscoveryTopic[];
  communityFollows: Array<{ id: string; communityId: string; userId: string }>;
  topicFollows: Array<{ id: string; topicId: string; userId: string }>;
};

type QuestionAudience = "Public" | "Followers" | "Members";

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
  audience?: QuestionAudience;
  answerSchemaId: string;
  answerSchema?: AnswerSchema;
  topicIds?: string[];
  createdAt?: string;
  community?: Community | null;
  poll?: {
    id: string;
    status: string;
    result?: { turnout: number; resultArtifactHash: string; finalStatus?: string } | null;
    resultChallenges?: ResultChallenge[];
  } | null;
  challenges: Array<{ id: string; reasonCode: string; ruling: string; challenger: string }>;
};

type FeedMode = "home" | "open" | "review" | "results";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const emptyQuestion = {
  title: "",
  body: "",
  sponsorDisclosure: "",
  audience: "Public" as QuestionAudience,
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
  ProArgument: "For",
  ConArgument: "Against",
  ClarifyingQuestion: "Question",
  ModeratorNote: "Guide note"
};

const feedModes: Array<{ key: FeedMode; label: string }> = [
  { key: "home", label: "All" },
  { key: "open", label: "Voting" },
  { key: "review", label: "Checking" },
  { key: "results", label: "Results" }
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function compactHash(value?: string | null) {
  if (!value) return "Not published";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function buildDiscussionViews(posts: DiscussionPost[]): DiscussionView[] {
  return DiscussionViewDefinitions.map((view) => {
    const viewPosts = posts.filter((post) => post.kind === view.kind);
    return { key: view.key, kind: view.kind, label: publicDiscussionLabel(view.kind), count: viewPosts.length, posts: viewPosts };
  });
}

function authorityCopy(authorityLevel: string) {
  if (authorityLevel === "Binding") {
    return "This result is tied to a decision-maker that has promised to act on it.";
  }
  if (authorityLevel === "Recognized") {
    return "This community has named how the result should guide the next step.";
  }
  return "This is a community signal: it shows where the community is leaning, without forcing an outside decision.";
}

function lifecycleSummary(question: Question | null, pollStatus: string, pendingChallenge: Question["challenges"][number] | null) {
  if (!question) {
    return {
      label: "No question selected",
      body: "Choose a question to see its votes, proof, and result."
    };
  }
  if (pendingChallenge) {
    return {
      label: "Flag under review",
      body: "Someone flagged wording or eligibility. A community guide can clear it, keep it, or let the asker clarify."
    };
  }
  if (question.status === "Submitted" && pollStatus === "Configured") {
    return {
      label: "Question check",
      body: "The question is drafted and ready for a community guide to check before voting opens."
    };
  }
  if (pollStatus === "Open") {
    return {
      label: "Voting open",
      body: "Members can get a voting pass and cast one private vote."
    };
  }
  if (pollStatus === "ResultPublished") {
    return {
      label: "Results posted",
      body: "The app has published the count, turnout, privacy note, and public receipt."
    };
  }
  if (question.status === "Rejected") {
    return {
      label: "Not moving forward",
      body: "A flag was kept, so this question stays closed unless someone asks a clearer version."
    };
  }
  return {
    label: publicQuestionStatus(question.status),
    body: question.poll ? `Vote status: ${publicPollStatus(pollStatus)}.` : "No vote has been set up for this question."
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
  const [message, setMessage] = useState("Choose a community or ask a question.");
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
  const [discovery, setDiscovery] = useState<DiscoveryIndex | null>(null);
  const [feedMode, setFeedMode] = useState<FeedMode>("home");

  const activeUser = useMemo(() => users.find((user) => user.id === activeUserId) ?? users[0] ?? null, [users, activeUserId]);
  const selectedCommunity = useMemo(
    () => (selectedCommunityId === "all" ? null : communities.find((community) => community.id === selectedCommunityId) ?? communities[0] ?? null),
    [communities, selectedCommunityId]
  );
  const selected = useMemo(() => questions.find((question) => question.id === selectedId) ?? questions[0] ?? null, [questions, selectedId]);
  const discoveryCommunityById = useMemo(
    () => new Map((discovery?.communities ?? []).map((community) => [community.id, community])),
    [discovery]
  );
  const socialCommunities = useMemo(
    () =>
      communities.map((community) => {
        const discovered = discoveryCommunityById.get(community.id);
        return {
          ...community,
          followerCount: discovered?.followerCount ?? 0,
          followedByActiveUser: discovered?.followedByActiveUser ?? false
        };
      }),
    [communities, discoveryCommunityById]
  );
  const selectedDiscoveryCommunity = selectedCommunity ? discoveryCommunityById.get(selectedCommunity.id) ?? null : null;
  const trendingTopics = useMemo(
    () =>
      [...(discovery?.topics ?? [])]
        .sort((left, right) => right.followerCount + right.questionCount - (left.followerCount + left.questionCount))
        .slice(0, 6),
    [discovery]
  );
  const feedStats = useMemo(
    () => ({
      open: questions.filter((question) => question.poll?.status === "Open").length,
      review: questions.filter(
        (question) => question.poll?.status === "Configured" || ["Submitted", "Challenged", "Amendment", "Accepted"].includes(question.status)
      ).length,
      results: questions.filter(
        (question) => question.status === "Archived" || question.poll?.status === "ResultPublished" || Boolean(question.poll?.result)
      ).length,
      challenges: questions.reduce((total, question) => total + (question.challenges?.length ?? 0), 0)
    }),
    [questions]
  );
  const filteredQuestions = useMemo(() => {
    if (feedMode === "open") return questions.filter((question) => question.poll?.status === "Open");
    if (feedMode === "review") {
      return questions.filter(
        (question) => question.poll?.status === "Configured" || ["Submitted", "Challenged", "Amendment", "Accepted"].includes(question.status)
      );
    }
    if (feedMode === "results") {
      return questions.filter(
        (question) => question.status === "Archived" || question.poll?.status === "ResultPublished" || Boolean(question.poll?.result)
      );
    }
    return questions;
  }, [feedMode, questions]);
  const followedCommunityCount = discovery?.communityFollows?.length ?? 0;
  const followedTopicCount = discovery?.topicFollows?.length ?? 0;
  const activeRoleLabel = selectedCommunity?.activeUserRole ?? (selectedCommunity?.isMember ? "Member" : "Visitor");
  const activeAnswerSchema = useMemo(
    () => selected?.answerSchema ?? BuiltInAnswerSchemas.find((schema) => schema.answerSchemaId === selected?.answerSchemaId) ?? BuiltInAnswerSchemas[0],
    [selected]
  );
  const pollStatus = selected?.poll?.status ?? "NotCreated";
  const pollStatusLabel = selected?.poll ? publicPollStatus(pollStatus) : "No vote yet";
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
      ? "Choose an account before flagging a question."
      : activeUserIsProposer
      ? "The asker cannot flag their own question."
      : canChallengeQuestion
      ? ""
      : "Flags are only available before voting opens or after a flag is cleared."
    : "Select a question before flagging it.";
  const acceptDisabledReason = selected
    ? !activeUser
      ? "Choose an account before opening voting."
      : activeUserIsProposer
      ? "The asker cannot check their own question."
      : !canCurateSelectedCommunity
      ? "Only community guides can check questions."
      : !selected.poll
      ? "This question does not have voting set up."
      : pendingChallenge
      ? "Resolve the open flag before voting starts."
      : pollStatus !== "Configured"
      ? "Voting must be ready and still closed."
      : ["Submitted", "Accepted"].includes(selected.status)
      ? ""
      : "Only submitted or checked questions can open voting."
    : "Select a question before opening voting.";
  const amendDisabledReason = selected
    ? activeUser?.id !== selected.proposer
      ? "Only the original asker can clarify this question."
      : canAmendQuestion
      ? ""
      : "Clarifying is only available while a question is being checked."
    : "Select a question before clarifying it.";
  const rulingDisabledReason = pendingChallenge
    ? !activeUser
      ? "Choose an account before resolving a flag."
      : activeUserIsProposer
      ? "The asker cannot resolve their own flag."
      : activeUserIsChallenger
      ? "The person who flagged it cannot resolve the flag."
      : !canCurateSelectedCommunity
      ? "Only community guides can resolve flags."
      : ""
    : "Open or select a flag before resolving it.";
  const credentialDisabledReason = activeUser ? "" : "Choose an account before getting a voting pass.";
  const ballotDisabledReason = selected?.poll
    ? !isPollOpen
      ? pollStatus === "Configured"
        ? "Voting opens after a community guide checks the question."
        : pollStatus === "ResultPublished"
        ? "Voting is closed because results are posted."
        : `Voting is disabled while this vote is ${publicPollStatus(pollStatus)}.`
      : credential
      ? ""
      : "Get a voting pass before submitting a private vote."
    : "Open voting before casting a vote.";
  const closeDisabledReason = selected?.poll
    ? isPollOpen
      ? ""
      : "Counting votes is available only while voting is open."
    : "Open voting before counting.";
  const resultDisabledReason = selected?.poll
    ? canLoadResult
      ? ""
      : "A public receipt appears after votes are counted."
    : "No vote is attached to this question.";
  const proposeDisabledReason = activeUser
    ? selectedCommunity
      ? selectedCommunity.visibility === "Private" && !selectedCommunity.isMember
        ? "Join this private community before asking a question."
        : ""
      : "Choose one community, not the all-feed, before asking."
    : "Choose or create an account before asking.";
  const registryHint = pendingChallenge
    ? "Open flag must be resolved or clarified before voting starts."
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

  async function refreshDiscovery(userId: string) {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    const response = await fetch(`${apiBase}/discovery?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Discovery failed to load");
    setDiscovery(data);
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
      await refreshDiscovery(effectiveUserId).catch(() => setDiscovery(null));

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
        ? `${community.name} is private. Only active members can see and ask questions.`
        : `${community.name} questions loaded.`
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
      setMessage("Voting is open. Get a voting pass to cast one private vote.");
      return;
    }
    if (question.poll?.status === "ResultPublished") {
      setMessage("Results are posted. Load the result to inspect the public receipt.");
      return;
    }
    setMessage(
      question.poll?.status === "Configured"
        ? "Question is being checked. Resolve flags, then open voting."
        : question.poll
        ? `Vote status: ${publicPollStatus(question.poll.status)}.`
        : "No vote has been opened for this question."
    );
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = await call("/users", { method: "POST", body: JSON.stringify(newUser) });
    setNewUser({ username: "", displayName: "" });
    setActiveUserId(data.user.id);
    setMessage(`Test account created for ${data.user.displayName}.`);
    await refreshAll(selectedCommunityId, data.user.id);
  }

  async function createCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser) throw new Error("Create an account before starting a community");
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

  async function followCommunity(community: Community) {
    if (!activeUser) throw new Error("Create an account before following a community");
    await call(`/communities/${community.id}/follow`, { method: "POST", body: JSON.stringify({ userId: activeUser.id }) });
    setMessage(`${activeUser.displayName} is following p/${community.slug}.`);
    await refreshDiscovery(activeUser.id);
  }

  async function followTopic(topicId: string) {
    if (!activeUser) throw new Error("Create an account before following a topic");
    await call(`/topics/${topicId}/follow`, { method: "POST", body: JSON.stringify({ userId: activeUser.id }) });
    setMessage(`${activeUser.displayName} is following #${topicId}.`);
    await refreshDiscovery(activeUser.id);
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
        methodologyLabel: `Answered by ${selectedCommunity.name} members who chose to take part`,
        credentialSchemaId: selectedCommunity.credentialSchemaId
      })
    });
    setDraft(emptyQuestion);
    setSelectedId(data.question.id);
    setMessage(`Question asked with ${data.stakedPc} PC stake and sent for checking.`);
    await refreshAll(selectedCommunity.id, activeUser.id, data.question.id);
  }

  async function challengeQuestion() {
    if (!selected) return;
    const data = await call(`/questions/${selected.id}/challenges`, {
      method: "POST",
      body: JSON.stringify({ challenger: activeUser?.id ?? "demo-challenger" })
    });
    setMessage(`Question flagged with ${data.stakedPc} PC stake.`);
    await refreshAll(selectedCommunity?.id, activeUser?.id, selected.id);
  }

  async function acceptQuestion() {
    if (!selected || !activeUser) return;
    await call(`/questions/${selected.id}/accept`, {
      method: "POST",
      body: JSON.stringify({ curator: activeUser.id })
    });
    setMessage("Question checked. Voting is open.");
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
            ? "The flag is kept under the demo review rules."
            : ruling === "Rejected"
            ? "The flag is cleared under the demo review rules."
            : "The question is sent back for the asker to clarify."
      })
    });
    setMessage(
      ruling === "Sustained"
        ? "Flag kept. Question closed and proposal stake settled."
        : ruling === "Rejected"
        ? "Flag cleared. Question is ready for voting."
        : "Flag sent back. The asker can clarify and resubmit."
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
    setMessage("Question clarified and sent back for checking.");
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
    setMessage("Voting pass issued. Secret is held in browser state for this local demo.");
  }

  async function vote(response: BallotResponse, label: string) {
    if (!selected?.poll || !credential || !isPollOpen) return;
    await call(`/polls/${selected.poll.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ ...credential, response })
    });
    setMessage(`Private ${label} vote accepted. Try voting twice to see duplicate-vote protection.`);
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
    setMessage("Votes counted and public result receipt posted.");
    await refreshAll(selectedCommunity?.id, activeUser?.id, selected.id);
  }

  async function loadResult() {
    if (!selected?.poll) return;
    const params = new URLSearchParams();
    if (activeUser?.id) params.set("userId", activeUser.id);
    const data = await call(`/polls/${selected.poll.id}/results?${params.toString()}`);
    setResult(data.artifact);
    setMessage("Loaded public result receipt.");
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
    setMessage(`Result flagged with ${data.stakedPc} PC stake.`);
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
    setMessage(ruling === "Sustained" ? "Result flag kept and receipt corrected." : "Result flag cleared.");
    await refreshAll(selectedCommunity?.id, activeUser.id, selected.id);
  }

  async function finalizeAndArchive() {
    if (!selected?.poll || !activeUser) return;
    await call(`/polls/${selected.poll.id}/finalize`, { method: "POST", body: JSON.stringify({ curator: activeUser.id }) });
    const data = await call(`/questions/${selected.id}/archive`, { method: "POST", body: JSON.stringify({ curator: activeUser.id }) });
    setArchive(data.artifact);
    setMessage("Final result saved to the public record.");
    await refreshAll(selectedCommunity?.id, activeUser.id, selected.id);
  }

  async function loadArchive() {
    if (!selected || !activeUser) return;
    const params = new URLSearchParams();
    params.set("userId", activeUser.id);
    const data = await call(`/questions/${selected.id}/archive?${params.toString()}`);
    setArchive(data.artifact);
    setMessage("Loaded saved public record.");
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
    setMessage(`${discussionKindLabels[discussionDraftKind]} comment posted.`);
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
    setMessage(`${publicAuthorityLabel(data.policy.authorityLevel)} rule suggested.`);
    await refreshAdoption(selectedCommunity.id, activeUser.id);
  }

  async function activateAdoptionPolicy(policyId: string) {
    if (!selectedCommunity || !activeUser) return;
    await call(`/communities/${selectedCommunity.id}/adoption/policies/${policyId}/activate`, {
      method: "POST",
      body: JSON.stringify({ steward: activeUser.id, adoptionRecord: "Community steward activated the policy for local MVP." })
    });
    setMessage("Next-step rule turned on.");
    await refreshAdoption(selectedCommunity.id, activeUser.id);
  }

  async function suspendAdoptionPolicy(policyId: string) {
    if (!selectedCommunity || !activeUser) return;
    await call(`/communities/${selectedCommunity.id}/adoption/policies/${policyId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ steward: activeUser.id, reason: "Community steward paused this policy pending review." })
    });
    setMessage("Next-step rule paused.");
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
    <section className="shell testing-shell">
      <section className="topbar">
        <div className="brand-lockup">
          <Image className="brand-mark" src={logoMark} alt="" priority />
          <div>
            <p className="eyebrow">Popular Consensus</p>
            <h1>{siteCopy.nav.testing}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="network-stats" aria-label="Network stats">
            <span>{communities.length} communities</span>
            <span>{questions.length} questions</span>
            <span>{followedCommunityCount + followedTopicCount} follows</span>
          </div>
          <div className="account-switcher">
            <label htmlFor="active-user">Test as</label>
            <select id="active-user" value={activeUser?.id ?? ""} onChange={(event) => void runAction(() => switchUser(event.target.value))}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="social-grid">
        <aside className="panel sidebar">
          <section className="profile-card" aria-label="Active profile">
            <div className="avatar">{initials(activeUser?.displayName ?? "PC")}</div>
            <div>
              <h2>{activeUser?.displayName ?? "No account"}</h2>
              <p className="muted">@{activeUser?.username ?? "guest"}</p>
            </div>
            <dl className="profile-metrics">
              <div>
                <dt>Trust</dt>
                <dd>{activeUser?.reputation ?? 0}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{publicRoleLabel(activeRoleLabel)}</dd>
              </div>
              <div>
                <dt>Voting pass</dt>
                <dd>{credential ? "Ready" : "None"}</dd>
              </div>
            </dl>
          </section>

          <section className="sidebar-section">
            <div className="rail-heading">
              <h2>Communities</h2>
              <small>{followedCommunityCount} followed</small>
            </div>
            <div className="community-list">
              <div className={selectedCommunityId === "all" ? "community-row active" : "community-row"}>
                <button className="community-select" onClick={() => void runAction(selectAllFeed)}>
                  <span>All questions</span>
                  <small>Everything you can see</small>
                </button>
              </div>
              {socialCommunities.map((community) => {
                const followDisabled =
                  !activeUser ||
                  actionPending ||
                  community.followedByActiveUser ||
                  (community.visibility === "Private" && !community.isMember);
                return (
                  <div className={community.id === selectedCommunity?.id ? "community-row active" : "community-row"} key={community.id}>
                    <button className="community-select" onClick={() => void runAction(() => selectCommunity(community))}>
                      <span>p/{community.slug}</span>
                      <small>
                        {community.memberCount} members · {community.followerCount} followers · {community.questionCount} questions
                      </small>
                    </button>
                    <button
                      className="mini-action"
                      onClick={() => void runAction(() => followCommunity(community))}
                      disabled={followDisabled}
                      title={
                        community.followedByActiveUser
                          ? "Already following"
                          : community.visibility === "Private" && !community.isMember
                          ? "Join this private community before following."
                          : undefined
                      }
                    >
                      {community.followedByActiveUser ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {selectedCommunity ? (
            <div className="sidebar-actions">
              {!selectedCommunity.isMember ? (
                <button className="wide-action" onClick={() => void runAction(() => joinCommunity(selectedCommunity))} disabled={actionPending}>
                  Join {selectedCommunity.visibility.toLowerCase()} community
                </button>
              ) : null}
              <button
                className="wide-action secondary"
                onClick={() => void runAction(() => followCommunity(selectedCommunity))}
                disabled={
                  !activeUser ||
                  actionPending ||
                  Boolean(selectedDiscoveryCommunity?.followedByActiveUser) ||
                  (selectedCommunity.visibility === "Private" && !selectedCommunity.isMember)
                }
              >
                {selectedDiscoveryCommunity?.followedByActiveUser ? "Following community" : "Follow community"}
              </button>
            </div>
          ) : null}

          <section className="sidebar-section">
            <div className="rail-heading">
              <h2>Topics</h2>
              <small>{followedTopicCount} followed</small>
            </div>
            <div className="topic-list">
              {trendingTopics.length ? (
                trendingTopics.map((topic) => (
                  <button
                    className={topic.followedByActiveUser ? "topic-pill active" : "topic-pill"}
                    key={topic.topicId}
                    onClick={() => void runAction(() => followTopic(topic.topicId))}
                    disabled={!activeUser || actionPending || topic.followedByActiveUser}
                  >
                    <span>#{topic.topicId}</span>
                    <small>
                      {topic.questionCount} questions · {topic.followerCount} followers
                    </small>
                    <span className="topic-action">{topic.followedByActiveUser ? "Following" : "Follow topic"}</span>
                  </button>
                ))
              ) : (
                <p className="muted">Topics appear as communities create questions.</p>
              )}
            </div>
          </section>

          <form className="stacked-form mini-form" onSubmit={(event) => void runAction(() => createCommunity(event))}>
            <h3>Start a community</h3>
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
              Start community
            </button>
          </form>
        </aside>

        <section className="feed">
          <section className="panel community-hero">
            <div className="community-copy">
              <p className="eyebrow">{selectedCommunity ? `p/${selectedCommunity.slug}` : "All questions"}</p>
              <h2>{selectedCommunity?.name ?? "All questions"}</h2>
              <p>{selectedCommunity?.description ?? "A combined feed of public questions and private questions from communities you have joined."}</p>
            </div>
            <div className="community-snapshot">
              <div className="feed-stat-grid">
                <div>
                  <strong>{selectedCommunity?.memberCount ?? communities.reduce((total, community) => total + community.memberCount, 0)}</strong>
                  <small>members</small>
                </div>
                <div>
                  <strong>{selectedDiscoveryCommunity?.followerCount ?? followedCommunityCount}</strong>
                  <small>followers</small>
                </div>
                <div>
                  <strong>{feedStats.open}</strong>
                  <small>open votes</small>
                </div>
              </div>
              <div className="statusline">
                <span className={activeCommunityIsPrivate ? "poll-closed" : "poll-open"}>{selectedCommunity?.visibility ?? "Mixed"}</span>
                <span>{publicAuthorityLabel(selectedCommunity?.defaultAuthorityLevel ?? "Advisory")}</span>
                <span className={selectedCommunity?.isMember ? "poll-open" : "poll-closed"}>
                  {selectedCommunity ? (selectedCommunity.isMember ? "Member" : "Not joined") : "Visible"}
                </span>
              </div>
            </div>
          </section>

          <form className="panel compose" onSubmit={(event) => void runAction(() => createQuestion(event))}>
            <div className="composer-head">
              <div className="avatar small">{initials(activeUser?.displayName ?? "PC")}</div>
              <div>
                <h2>{siteCopy.actions.askCrowd}</h2>
                <p className="muted">{selectedCommunity ? `Asking in p/${selectedCommunity.slug}` : "Choose a community to ask"}</p>
              </div>
              <span className="badge-soft">{publicAuthorityLabel(selectedCommunity?.defaultAuthorityLevel ?? "Advisory")}</span>
            </div>
            <label className="field-label">
              Who can see it?
              <select
                aria-label="Question audience"
                value={draft.audience}
                onChange={(event) => setDraft((current) => ({ ...current, audience: event.target.value as QuestionAudience }))}
              >
                <option value="Public">Everyone</option>
                <option value="Followers">Followers</option>
                <option value="Members">Members</option>
              </select>
            </label>
            <input
              aria-label="Question title"
              placeholder="What should this community decide or estimate?"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <textarea
              aria-label="Question body"
              placeholder="Add context. Keep it simple."
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
              placeholder="Who is asking?"
              value={draft.sponsorDisclosure}
              onChange={(event) => setDraft((current) => ({ ...current, sponsorDisclosure: event.target.value }))}
              required
            />
            <button type="submit" disabled={!canProposeQuestion || actionPending} title={proposeDisabledReason || undefined}>
              {selectedCommunity ? "Ask question" : "Choose a community to ask"}
            </button>
            {!canProposeQuestion ? <small className="form-hint">{proposeDisabledReason}</small> : null}
          </form>

          <section className="panel">
            <div className="section-heading">
              <div>
                  <h2>Question list</h2>
                <p className="muted">
                  {selectedCommunity ? `${selectedCommunity.questionCount} questions in p/${selectedCommunity.slug}` : "Everything this test account can see"}
                </p>
              </div>
              <span className="badge-soft">{feedLoading ? "Loading" : `${questions.length} visible questions`}</span>
            </div>
            <div className="feed-tabs" role="tablist" aria-label="Feed filters">
              {feedModes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  role="tab"
                  aria-selected={feedMode === mode.key}
                  className={feedMode === mode.key ? "active" : ""}
                  onClick={() => setFeedMode(mode.key)}
                >
                  {mode.label}
                  <small>
                    {mode.key === "open"
                      ? feedStats.open
                      : mode.key === "review"
                      ? feedStats.review
                      : mode.key === "results"
                      ? feedStats.results
                      : questions.length}
                  </small>
                </button>
              ))}
            </div>
            <div className="post-list">
              {feedLoading ? (
                <div className="empty-state">
                  <strong>Loading question feed</strong>
                  <p>Fetching the latest visible questions for this account.</p>
                </div>
              ) : feedError ? (
                <div className="empty-state warning">
                  <strong>{feedError}</strong>
                  <p>Private community questions stay hidden until this account joins.</p>
                </div>
              ) : filteredQuestions.length ? (
                filteredQuestions.map((question) => (
                  <button
                    className={question.id === selected?.id ? "post feed-post active" : "post feed-post"}
                    key={question.id}
                    onClick={() => selectQuestion(question)}
                  >
                    <span className="post-topline">
                      <span className="post-community">p/{question.community?.slug ?? selectedCommunity?.slug ?? "general"}</span>
                      <span>{question.createdAt ? new Date(question.createdAt).toLocaleDateString() : "Local demo"}</span>
                    </span>
                    <strong>{question.title}</strong>
                    <span className="post-summary">{question.methodologyLabel}</span>
                    <span className="post-badges">
                      <small>{publicQuestionStatus(question.status)}</small>
                      <small>{question.poll ? publicPollStatus(question.poll.status) : "No vote yet"}</small>
                      <small>{publicAuthorityLabel(question.authorityLevel)}</small>
                      {(question.topicIds ?? []).slice(0, 2).map((topicId) => (
                        <small key={topicId}>#{topicId}</small>
                      ))}
                    </span>
                    <span className="post-metrics">
                      <small>by {question.proposer}</small>
                      <small>{question.audience === "Members" ? "Members" : question.audience === "Followers" ? "Followers" : "Everyone"}</small>
                      <small>{question.answerSchema?.label ?? question.answerSchemaId}</small>
                      <small>{question.challenges?.length ?? 0} flags</small>
                      <small>{question.poll?.result?.turnout ?? 0} turnout</small>
                      {question.id === selected?.id ? <small>{discussion.length} notes</small> : null}
                    </span>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <strong>No questions in this view</strong>
                  <p>
                    {questions.length
                      ? "Try another feed filter."
                      : selectedCommunity
                      ? selectedCommunity.visibility === "Private" && !selectedCommunity.isMember
                        ? "Join this private community to view its questions."
                        : "Ask the first question for this community."
                      : "Join private communities or choose a public community to ask a question."}
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="panel detail">
          <div className="statusline">
            <span>{selected ? publicQuestionStatus(selected.status) : "No question"}</span>
            <span className={isPollOpen ? "poll-open" : "poll-closed"}>{pollStatusLabel}</span>
            <span>{publicAuthorityLabel(selected?.authorityLevel ?? "Advisory")}</span>
            <span>v{selected?.version ?? 1}</span>
          </div>
          <h2>{selected?.title ?? "Select a question"}</h2>
          <p>{selected?.methodologyLabel ?? "Community answer from people who chose to take part"}</p>
          {selected ? <p className="schema-line">{activeAnswerSchema.label}</p> : null}

          <section className="workflow-summary">
            <p className="eyebrow">Current step</p>
            <h3>{lifecycle.label}</h3>
            <p>{lifecycle.body}</p>
            <dl className="meta-grid">
              <div>
                <dt>Signal</dt>
                <dd>{publicAuthorityLabel(selected?.authorityLevel ?? "Advisory")}</dd>
              </div>
              <div>
                <dt>Voting pass</dt>
                <dd>{selected?.community?.credentialSchemaId ?? selectedCommunity?.credentialSchemaId ?? "credential-vancouver-resident"}</dd>
              </div>
              <div>
                <dt>Flags</dt>
                <dd>{selected?.challenges?.length ?? 0} total</dd>
              </div>
            </dl>
          </section>

          <section className="thread-panel">
            <div className="section-heading">
              <div>
                <h3>Thread</h3>
                <p className="muted">{selected ? `${discussion.length} comments and context from the community.` : "Select a question to open its thread."}</p>
              </div>
              <span className="badge-soft">{activeDiscussionPanel?.label ?? "Comments"}</span>
            </div>
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
                placeholder="Add context, a source, or a concern"
                value={discussionDraft}
                onChange={(event) => setDiscussionDraft(event.target.value)}
                disabled={!selected || !activeUser || actionPending}
              />
              <button type="submit" disabled={!selected || !discussionDraft.trim() || actionPending}>
                Post comment
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
              <p className="muted">No {activeDiscussionPanel?.label.toLowerCase() ?? "discussion"} yet.</p>
            )}
          </section>

          <details className="protocol-drawer" open>
            <summary>
              <span>Testing Lab Controls</span>
              <small>Question, vote, result, and next-step actions</small>
            </summary>
          <div className="action-groups">
            <section className="action-group">
              <div className="group-heading">
                <h3>Question check</h3>
                <p>Flag wording, resolve open flags, clarify as asker, then open voting.</p>
              </div>
              <div className="actions">
                <button
                  onClick={() => void runAction(challengeQuestion)}
                  disabled={!canChallengeQuestion || actionPending}
                  title={challengeDisabledReason || undefined}
                >
                  Flag question
                </button>
                <button
                  onClick={() => void runAction(() => ruleChallenge("Rejected"))}
                  disabled={!canRuleChallenge || actionPending}
                  title={rulingDisabledReason || undefined}
                >
                  Clear flag
                </button>
                <button
                  onClick={() => void runAction(() => ruleChallenge("Sustained"))}
                  disabled={!canRuleChallenge || actionPending}
                  title={rulingDisabledReason || undefined}
                >
                  Keep flag
                </button>
                <button onClick={() => void runAction(amendQuestion)} disabled={!canAmendQuestion || actionPending} title={amendDisabledReason || undefined}>
                  Clarify question
                </button>
                <button onClick={() => void runAction(acceptQuestion)} disabled={!canAcceptQuestion || actionPending} title={acceptDisabledReason || undefined}>
                  Open voting
                </button>
              </div>
              {registryHint ? <small className="action-hint">{registryHint}</small> : null}
            </section>

            <section className="action-group">
              <div className="group-heading">
                <h3>Voting pass and private vote</h3>
                <p>{credential ? `Voting pass ready: ${credential.credentialId}` : "Get a demo voting pass before casting a private vote."}</p>
              </div>
              <div className="actions ballot-actions">
                <button onClick={() => void runAction(issueCredential)} disabled={!activeUser || actionPending} title={credentialDisabledReason || undefined}>
                  Get voting pass
                </button>
                {renderBallotControls()}
              </div>
              {ballotDisabledReason ? <small className="action-hint">{ballotDisabledReason}</small> : null}
            </section>

            <section className="action-group">
              <div className="group-heading">
                <h3>Results</h3>
                <p>Close voting, count private votes, then inspect the public receipt.</p>
              </div>
              <div className="actions">
                <button onClick={() => void runAction(closeAndTally)} disabled={!isPollOpen || actionPending} title={closeDisabledReason || undefined}>
                  Count votes
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
                <h3>Proof check</h3>
                <p>Flag the public receipt, resolve the review, then save the final record.</p>
              </div>
              <div className="actions">
                <button
                  onClick={() => void runAction(challengeResult)}
                  disabled={!selected?.poll?.result || Boolean(pendingResultChallenge) || actionPending}
                  title={!selected?.poll?.result ? "Publish a result before flagging it." : undefined}
                >
                  Flag result
                </button>
                <button
                  onClick={() => void runAction(() => ruleResultChallenge("Rejected"))}
                  disabled={!pendingResultChallenge || !canCurateSelectedCommunity || actionPending}
                >
                  Clear result flag
                </button>
                <button
                  onClick={() => void runAction(() => ruleResultChallenge("Sustained"))}
                  disabled={!pendingResultChallenge || !canCurateSelectedCommunity || actionPending}
                >
                  Keep result flag
                </button>
                <button onClick={() => void runAction(finalizeAndArchive)} disabled={!canFinalizeResult || actionPending}>
                  Save final result
                </button>
                <button onClick={() => void runAction(loadArchive)} disabled={selected?.status !== "Archived" || actionPending}>
                  Load saved record
                </button>
              </div>
              {pendingResultChallenge ? <small className="action-hint">Result flag open: {pendingResultChallenge.reasonCode}</small> : null}
            </section>

            {selectedCommunity ? (
              <section className="action-group">
                <div className="group-heading">
                  <h3>What happens next</h3>
                  <p>Record whether this answer is only a community signal or should guide a real next step.</p>
                </div>
                <div className="ballot-control">
                  <select
                    aria-label="Next-step rule"
                    value={adoptionDraft.authorityLevel}
                    onChange={(event) =>
                      setAdoptionDraft((current) => ({ ...current, authorityLevel: event.target.value as "Recognized" | "Binding" }))
                    }
                  >
                    <option value="Recognized">Recognized next step</option>
                    <option value="Binding">Binding decision</option>
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
                    Suggest rule
                  </button>
                </div>
                <div className="post-list compact-list">
                  {adoptionPolicies.map((policy) => (
                    <div className="post" key={policy.id}>
                      <strong>
                        {publicAuthorityLabel(policy.authorityLevel)} · {policy.status}
                      </strong>
                      <small>{policy.credentialSchemaIds.join(", ")}</small>
                      <div className="actions">
                        <button
                          onClick={() => void runAction(() => activateAdoptionPolicy(policy.id))}
                          disabled={policy.status !== "Proposed" || !canCurateSelectedCommunity || actionPending}
                        >
                          Turn on
                        </button>
                        <button
                          onClick={() => void runAction(() => suspendAdoptionPolicy(policy.id))}
                          disabled={policy.status !== "Active" || !canCurateSelectedCommunity || actionPending}
                        >
                          Pause
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          </details>

          <div className="message" role="status">
            {actionPending ? "Working..." : message}
          </div>

          <div className="detail-stack">
            <article>
              <h3>Flag history</h3>
              {selected?.challenges?.length ? (
                selected.challenges.map((challenge) => (
                  <p key={challenge.id}>
                    {challenge.reasonCode}: {challenge.ruling}
                  </p>
                ))
              ) : (
                <p>No flags yet.</p>
              )}
            </article>
            <article>
              <h3>What happens next</h3>
              <p>{authorityCopy(selected?.authorityLevel ?? selectedCommunity?.defaultAuthorityLevel ?? "Advisory")}</p>
            </article>
            <article>
              <h3>Archive</h3>
              <p>Body: {compactHash(selected?.bodyHash)}</p>
              <p>Sponsor: {compactHash(selected?.sponsorDisclosureHash)}</p>
            </article>
            <article>
              <h3>Privacy Note</h3>
              <p>Votes are private before storage. The API returns aggregate receipts only, not individual choices.</p>
            </article>
            <article>
              <h3>Public receipt</h3>
              <pre>{result ? JSON.stringify(result, null, 2) : "No published result yet."}</pre>
            </article>
            <article>
              <h3>Saved public record</h3>
              <pre>{archive ? JSON.stringify(archive, null, 2) : "No archive yet."}</pre>
            </article>
          </div>
        </aside>
      </section>

      <section className="panel account-panel">
        <form className="inline-form" onSubmit={(event) => void runAction(() => createUser(event))}>
          <h2>Create test account</h2>
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
          <button type="submit">Create test account</button>
        </form>
      </section>
    </section>
  );
}
