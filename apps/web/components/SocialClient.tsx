"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BuiltInAnswerSchemas, type AnswerSchema, type BallotResponse } from "@pc/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  publicAuthorityLabel,
  publicDiscussionLabel,
  publicPollStatus,
  publicQuestionStatus,
  publicRoleLabel,
  siteCopy,
  splitCamel
} from "./copy";

type UserAccount = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  profileCommunityId?: string | null;
  smartAccountAddress?: string | null;
  smartAccountKind?: string;
  reputation: number;
};

type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind?: "Group" | "Profile";
  profileUserId?: string | null;
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
  kind?: "Group" | "Profile";
  profileUserId?: string | null;
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
  profiles?: DiscoveryCommunity[];
  topics: DiscoveryTopic[];
  communityFollows: Array<{ id: string; communityId: string; userId: string }>;
  topicFollows: Array<{ id: string; topicId: string; userId: string }>;
};

type QuestionAudience = "Public" | "Followers" | "Members";

type Question = {
  id: string;
  title: string;
  status: string;
  version: number;
  bodyHash: string;
  sponsorDisclosureHash?: string | null;
  methodologyLabel: string;
  authorityLevel: string;
  audience?: QuestionAudience;
  proposer: string;
  answerSchemaId: string;
  topicIds?: string[];
  createdAt?: string;
  community?: Community | null;
  poll?: {
    id: string;
    status: string;
    result?: { id?: string; turnout: number; resultArtifactHash: string; finalStatus?: string } | null;
    resultChallenges?: Array<{ id: string; reasonCode: string; ruling: string; challenger: string }>;
  } | null;
  challenges: Array<{ id: string; reasonCode: string; ruling: string; challenger: string }>;
};

type DiscussionPost = {
  id: string;
  authorId: string;
  kind: string;
  body: string;
  createdAt: string;
};

type CivicRecord = {
  events?: Array<{ eventType?: string; eventHash?: string; newHash?: string; createdAt?: string }>;
  commitments?: Array<{ kind?: string; commitmentKind?: string; hash?: string; commitmentHash?: string }>;
  result?: {
    resultArtifactHash?: string;
    aggregateCountsHash?: string;
    privacyReportHash?: string;
    turnout?: number;
    finalStatus?: string;
    authorityLevel?: string;
  } | null;
  discussionCount?: number;
};

type ReplayCheck = {
  status: string;
  eventStreamHash?: string;
  checks?: Array<Record<string, unknown>>;
};

type DataUnionSummary = {
  activePolicy?: {
    id: string;
    title: string;
    status: string;
    minimumCohortSize: number;
    revenueSplit?: {
      communityTreasuryPercent: number;
      participantPoolPercent: number;
      operatorPoolPercent: number;
    };
  } | null;
  policies?: Array<{ id: string; title?: string; status: string }>;
  consents?: Array<{ id: string; userId?: string; status: string }>;
  products?: Array<{ id: string; title: string; status: string; cohortSize: number; pricePc: number }>;
  accessGrants?: Array<{ id: string; buyerId: string; status: string; paymentPc: number }>;
};

type AdoptionPolicy = {
  id: string;
  authorityLevel: "Advisory" | "Recognized" | "Binding";
  status: "Proposed" | "Active" | "Suspended" | "Retired";
  eligibleQuestionTypes?: string[];
  credentialSchemaIds?: string[];
};

type AdoptionSummary = {
  defaultAuthorityLevel: string;
  policies?: AdoptionPolicy[];
  activePolicies?: AdoptionPolicy[];
};

type FeedMode = "home" | "open" | "review" | "results";
type FeedScope = "for-you" | "global" | "following" | "profile" | "community";

type FeedItem = {
  id: string;
  itemType: "question" | "activity";
  activityType?: string;
  visibility: "full" | "redacted" | "shell";
  createdAt: string;
  actorId?: string;
  shellText?: string;
  lockedReason?: string | null;
  activityHash?: string;
  question?: Question | null;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const emptyQuestion = {
  title: "",
  body: "",
  sponsorDisclosure: "",
  answerSchemaId: "answer-binary-support-oppose",
  audience: "Public" as QuestionAudience
};

const emptyResponseDraft = {
  choices: [] as string[],
  ranking: {} as Record<string, number>,
  scaleValue: 0,
  allocations: {} as Record<string, number>,
  text: "",
  numericValue: 0
};

type AuthPayload = {
  user: UserAccount;
  session: {
    token: string;
    expiresAt: string;
    aaAccountAddress: string;
    controllerId: string | null;
  };
  passkeyDeployment?: PasskeyDeploymentChallenge | null;
};

type AaUserOperation = {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  accountGasLimits: string;
  preVerificationGas: string;
  gasFees: string;
  paymasterAndData: string;
  signature: string;
};

type WalletAuthChallenge = {
  challengeId: string;
  message: string;
  aaUserOperation?: {
    userOperation: AaUserOperation;
    userOpHash: string;
    signatureKind: "wallet-personal-sign";
    signingMessage: string;
  } | null;
};

type PasskeyDeploymentChallenge = {
  challengeId: string;
  publicKey: SerializedRequestOptions;
  aaUserOperation: {
    userOperation: AaUserOperation;
    userOpHash: string;
    signatureKind: "passkey-webauthn-p256";
    signingMessage: string;
    signingChallenge: string;
  };
};

type EthereumProvider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type SerializedCreationOptions = Omit<PublicKeyCredentialCreationOptions, "challenge" | "user"> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, "id"> & { id: string };
};

type SerializedRequestOptions = Omit<PublicKeyCredentialRequestOptions, "allowCredentials" | "challenge"> & {
  challenge: string;
  allowCredentials?: Array<Omit<PublicKeyCredentialDescriptor, "id"> & { id: string }>;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value?: string) {
  if (!value) return "Now";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatStatus(value: string) {
  return splitCamel(value);
}

function shortHash(value?: string | null) {
  if (!value) return "Not published";
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function checkLabel(check: Record<string, unknown>) {
  const raw = check.name ?? check.id ?? check.check ?? "Replay check";
  return String(raw).replace(/[-_]/g, " ");
}

function checkStatus(check: Record<string, unknown>) {
  if (typeof check.passed === "boolean") return check.passed ? "Passed" : "Needs review";
  if (typeof check.status === "string") return check.status;
  return "Recorded";
}

function buildDraftResponse(answerSchema: AnswerSchema, draft: typeof emptyResponseDraft): BallotResponse {
  if (answerSchema.responseShape === "MultipleChoice") return { type: "multiple_choice", choices: draft.choices };
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
  if (answerSchema.responseShape === "BudgetAllocation") return { type: "budget_allocation", allocations: draft.allocations };
  if (answerSchema.responseShape === "Numeric") return { type: "numeric", value: draft.numericValue };
  if (answerSchema.responseShape === "FreeText") return { type: "free_text", text: draft.text };
  return { type: "single_choice", choice: answerSchema.options[0]?.id ?? "abstain" };
}

async function apiCall<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === "undefined" ? "" : window.localStorage.getItem("pc.authToken") ?? "";
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function storeAuth(payload: AuthPayload) {
  window.localStorage.setItem("pc.authToken", payload.session.token);
  window.localStorage.setItem("pc.activeUserId", payload.user.id);
  window.localStorage.setItem("pc.smartAccountAddress", payload.session.aaAccountAddress);
}

function clearAuth() {
  window.localStorage.removeItem("pc.authToken");
  window.localStorage.removeItem("pc.smartAccountAddress");
}

async function signWalletUserOperation(ethereum: EthereumProvider, address: string, challenge: WalletAuthChallenge) {
  if (!challenge.aaUserOperation) return {};
  const aaUserOperationSignature = (await ethereum.request({
    method: "personal_sign",
    params: [challenge.aaUserOperation.signingMessage, address]
  })) as string;
  return {
    aaUserOperation: challenge.aaUserOperation.userOperation,
    aaUserOperationSignature
  };
}

async function completePasskeyDeployment(deployment?: PasskeyDeploymentChallenge | null) {
  if (!deployment) return null;
  const credential = (await navigator.credentials.get({
    publicKey: decodeRequestOptions(deployment.publicKey)
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Private voting account setup was cancelled.");
  return apiCall<{ ok: true }>("/auth/passkey/deploy/verify", {
    method: "POST",
    body: JSON.stringify({
      challengeId: deployment.challengeId,
      aaUserOperation: deployment.aaUserOperation.userOperation,
      credential: serializeAssertionCredential(credential)
    })
  });
}

function useSocialData(defaultCommunityId = "all") {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [activeUserId, setActiveUserId] = useState("");
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(defaultCommunityId);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh(nextUserId = activeUserId, nextCommunityId = selectedCommunityId) {
    setLoading(true);
    setError("");
    try {
      let sessionUser: UserAccount | null = null;
      if (window.localStorage.getItem("pc.authToken")) {
        try {
          const sessionData = await apiCall<{ user: UserAccount }>("/auth/session");
          sessionUser = sessionData.user;
        } catch {
          clearAuth();
        }
      }
      const effectiveUserId = sessionUser?.id ?? nextUserId ?? "";
      setUsers(sessionUser ? [sessionUser] : []);
      setActiveUserId(effectiveUserId);
      if (effectiveUserId) window.localStorage.setItem("pc.activeUserId", effectiveUserId);

      const communityParams = new URLSearchParams();
      if (effectiveUserId) communityParams.set("userId", effectiveUserId);
      const communitiesData = await apiCall<{ communities: Community[] }>(`/communities?${communityParams.toString()}`);
      const nextCommunities = communitiesData.communities ?? [];
      setCommunities(nextCommunities);

      const effectiveCommunityId =
        nextCommunityId === "all" || nextCommunities.some((community) => community.id === nextCommunityId)
          ? nextCommunityId
          : nextCommunities[0]?.id ?? "all";
      setSelectedCommunityId(effectiveCommunityId);

      const discoveryParams = new URLSearchParams();
      if (effectiveUserId) discoveryParams.set("userId", effectiveUserId);
      const discoveryData = await apiCall<DiscoveryIndex>(`/discovery?${discoveryParams.toString()}`);
      setDiscovery(discoveryData);

      const questionParams = new URLSearchParams();
      if (effectiveUserId) questionParams.set("userId", effectiveUserId);
      if (effectiveCommunityId !== "all") questionParams.set("communityId", effectiveCommunityId);
      const questionsData = await apiCall<{ questions: Question[] }>(`/questions?${questionParams.toString()}`);
      setQuestions(questionsData.questions ?? []);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load Popular Consensus");
      setQuestions([]);
      setDiscovery(null);
    } finally {
      setLoading(false);
    }
  }

  function setSessionUser(userId: string) {
    setActiveUserId(userId);
    window.localStorage.setItem("pc.activeUserId", userId);
    void refresh(userId, selectedCommunityId);
  }

  useEffect(() => {
    const storedUserId = window.localStorage.getItem("pc.activeUserId") ?? "";
    void refresh(storedUserId, defaultCommunityId);
  }, [defaultCommunityId]);

  const activeUser = useMemo(() => users.find((user) => user.id === activeUserId) ?? users[0] ?? null, [activeUserId, users]);
  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId]
  );
  const discoveryByCommunityId = useMemo(
    () => new Map([...(discovery?.communities ?? []), ...(discovery?.profiles ?? [])].map((community) => [community.id, community])),
    [discovery]
  );

  return {
    users,
    activeUser,
    activeUserId,
    communities,
    selectedCommunity,
    selectedCommunityId,
    questions,
    discovery,
    discoveryByCommunityId,
    loading,
    message,
    error,
    setMessage,
    setSelectedCommunityId,
    setSessionUser,
    refresh
  };
}

function ProfileSummary({ user, role }: { user: UserAccount | null; role?: string }) {
  if (!user) {
    return (
      <section className="panel social-profile">
        <div className="avatar">PC</div>
        <div>
          <h2>Sign in</h2>
          <p className="muted">Passkey or wallet access</p>
        </div>
        <Link className="button-link profile-login" href="/login">
          Log in
        </Link>
      </section>
    );
  }

  return (
    <section className="panel social-profile">
      <div className="avatar">{initials(user.displayName)}</div>
      <div>
        <h2>{user.displayName}</h2>
        <p className="muted">@{user.username}</p>
      </div>
      <dl className="profile-metrics compact">
        <div>
          <dt>Trust</dt>
          <dd>{user.reputation}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{publicRoleLabel(role ?? "Member")}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{user.smartAccountAddress ? "Private" : "Local"}</dd>
        </div>
      </dl>
      {user.smartAccountAddress ? <small className="account-address">{user.smartAccountAddress}</small> : null}
    </section>
  );
}

function bufferToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function decodeCreationOptions(publicKey: SerializedCreationOptions): PublicKeyCredentialCreationOptions {
  return {
    ...publicKey,
    challenge: base64UrlToBuffer(publicKey.challenge),
    user: { ...publicKey.user, id: base64UrlToBuffer(publicKey.user.id) }
  };
}

function decodeRequestOptions(publicKey: SerializedRequestOptions): PublicKeyCredentialRequestOptions {
  return {
    ...publicKey,
    challenge: base64UrlToBuffer(publicKey.challenge),
    allowCredentials: publicKey.allowCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id)
    }))
  };
}

function serializeRegistrationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject)
    }
  };
}

function serializeAssertionCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined
    }
  };
}

function ethereumProvider() {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

function PostCard({
  question,
  active,
  onSelect
}: {
  question: Question;
  active?: boolean;
  onSelect: (question: Question) => void;
}) {
  const turnout = question.poll?.result?.turnout ?? 0;
  const audience = question.audience === "Members" ? "Members" : question.audience === "Followers" ? "Followers" : "Everyone";
  return (
    <button className={`post feed-post${active ? " active" : ""}`} onClick={() => onSelect(question)}>
      <span className="post-topline">
        <span className="post-community">{question.community?.kind === "Profile" ? "@" : "p/"}{question.community?.slug?.replace(/^user-/, "") ?? "community"}</span>
        <span>{formatDate(question.createdAt)}</span>
      </span>
      <strong>{question.title}</strong>
      <span className="post-summary">{question.methodologyLabel}</span>
      <span className="post-badges">
        <small>{audience}</small>
        <small>{publicQuestionStatus(question.status)}</small>
        <small>{question.poll ? publicPollStatus(question.poll.status) : "No vote yet"}</small>
        <small>{publicAuthorityLabel(question.authorityLevel)}</small>
        {(question.topicIds ?? []).slice(0, 2).map((topic) => (
          <small key={topic}>#{topic}</small>
        ))}
      </span>
      <span className="post-metrics">
        <small>{question.challenges.length} flags</small>
        <small>{turnout} turnout</small>
        <small>v{question.version}</small>
      </span>
    </button>
  );
}

function FeedActivityCard({ item, onSelect }: { item: FeedItem; onSelect: (question: Question) => void }) {
  const label = item.activityType ? formatStatus(item.activityType) : "Activity";
  return (
    <article className={`post feed-post activity-post${item.visibility === "shell" ? " shell" : ""}`}>
      <span className="post-topline">
        <span className="post-community">{label}</span>
        <span>{formatDate(item.createdAt)}</span>
      </span>
      <strong>{item.shellText ?? "New community activity"}</strong>
      {item.lockedReason ? <span className="post-summary">{item.lockedReason}</span> : null}
      {item.question ? (
        <button className="mini-action" type="button" onClick={() => onSelect(item.question!)}>
          Open question
        </button>
      ) : null}
    </article>
  );
}

function CivicAuditPanel({
  record,
  replay,
  loading,
  message
}: {
  record: CivicRecord | null;
  replay: ReplayCheck | null;
  loading: boolean;
  message: string;
}) {
  const events = record?.events ?? [];
  const commitments = record?.commitments ?? [];
  const checks = replay?.checks ?? [];
  const recentEvents = events.slice(-4).reverse();

  return (
    <section className="audit-panel" aria-label="Proof everyone can check">
      <div className="rail-heading">
        <h3>Proof everyone can check</h3>
        <small>{loading ? "Loading" : replay?.status ?? "Waiting"}</small>
      </div>
      {message ? <p className="audit-message">{message}</p> : null}
      <div className="audit-grid">
        <div>
          <span>Steps</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>Locks</span>
          <strong>{commitments.length}</strong>
        </div>
        <div>
          <span>Turnout</span>
          <strong>{record?.result?.turnout ?? 0}</strong>
        </div>
      </div>
      <dl className="audit-hashes">
        <div>
          <dt>Step record</dt>
          <dd>{shortHash(replay?.eventStreamHash)}</dd>
        </div>
        <div>
          <dt>Public receipt</dt>
          <dd>{shortHash(record?.result?.resultArtifactHash)}</dd>
        </div>
        <div>
          <dt>Privacy note</dt>
          <dd>{shortHash(record?.result?.privacyReportHash)}</dd>
        </div>
      </dl>
      <div className="audit-list">
        {checks.slice(0, 3).map((check, index) => (
          <div key={`${checkLabel(check)}-${index}`}>
            <span>{checkLabel(check)}</span>
            <strong>{checkStatus(check)}</strong>
          </div>
        ))}
        {!checks.length && recentEvents.map((event, index) => (
          <div key={`${event.eventType ?? "event"}-${index}`}>
            <span>{formatStatus(event.eventType ?? "Proof step")}</span>
            <strong>{shortHash(event.eventHash ?? event.newHash)}</strong>
          </div>
        ))}
        {!checks.length && !recentEvents.length ? (
          <div>
            <span>No proof steps yet</span>
            <strong>Waiting</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DataUnionPanel({
  dataUnion,
  loading,
  message,
  actionPending,
  canSteward,
  canConsent,
  canPublishProduct,
  canGrantAccess,
  onProposePolicy,
  onActivatePolicy,
  onRecordConsent,
  onPublishProduct,
  onGrantAccess
}: {
  dataUnion: DataUnionSummary | null;
  loading: boolean;
  message: string;
  actionPending: boolean;
  canSteward: boolean;
  canConsent: boolean;
  canPublishProduct: boolean;
  canGrantAccess: boolean;
  onProposePolicy: () => void;
  onActivatePolicy: () => void;
  onRecordConsent: () => void;
  onPublishProduct: () => void;
  onGrantAccess: () => void;
}) {
  const activePolicy = dataUnion?.activePolicy ?? null;
  const proposedPolicy = (dataUnion?.policies ?? []).find((policy) => policy.status === "Proposed") ?? null;
  const activeConsents = (dataUnion?.consents ?? []).filter((consent) => consent.status === "Active").length;
  const publishedProducts = (dataUnion?.products ?? []).filter((product) => product.status === "Published");
  const activeGrants = (dataUnion?.accessGrants ?? []).filter((grant) => grant.status === "Active");
  const revenuePc = activeGrants.reduce((sum, grant) => sum + grant.paymentPc, 0);

  return (
    <section className="data-union-panel" aria-label="Data rewards">
      <div className="rail-heading">
        <h3>Data Rewards</h3>
        <small>{loading ? "Loading" : activePolicy ? activePolicy.status : "No sharing rules yet"}</small>
      </div>
      {message ? <p className="audit-message">{message}</p> : null}
      <p className="muted">
        {activePolicy
          ? activePolicy.title
          : "When a community agrees, anonymous results can become reports, with value routed back to the community and participants."}
      </p>
      <div className="data-union-grid">
        <div>
          <span>Opt-ins</span>
          <strong>{activeConsents}</strong>
        </div>
        <div>
          <span>Reports</span>
          <strong>{publishedProducts.length}</strong>
        </div>
        <div>
          <span>Rewards</span>
          <strong>{revenuePc} PC</strong>
        </div>
      </div>
      {activePolicy?.revenueSplit ? (
        <small className="action-hint">
          Split: {activePolicy.revenueSplit.communityTreasuryPercent}% treasury, {activePolicy.revenueSplit.participantPoolPercent}% participants,{" "}
          {activePolicy.revenueSplit.operatorPoolPercent}% operators.
        </small>
      ) : null}
      <div className="data-union-actions">
        <button type="button" onClick={onProposePolicy} disabled={!canSteward || Boolean(proposedPolicy) || Boolean(activePolicy) || actionPending}>
          Suggest sharing rules
        </button>
        <button type="button" onClick={onActivatePolicy} disabled={!canSteward || !proposedPolicy || actionPending}>
          Turn rules on
        </button>
        <button type="button" onClick={onRecordConsent} disabled={!canConsent || actionPending}>
          Opt in
        </button>
        <button type="button" onClick={onPublishProduct} disabled={!canPublishProduct || actionPending}>
          Publish report
        </button>
        <button type="button" onClick={onGrantAccess} disabled={!canGrantAccess || actionPending}>
          Give buyer access
        </button>
      </div>
      {publishedProducts.slice(0, 2).map((product) => (
        <div className="data-union-product" key={product.id}>
          <span>{product.title}</span>
          <strong>
            {product.cohortSize} people · {product.pricePc} PC
          </strong>
        </div>
      ))}
    </section>
  );
}

function AuthorityPolicyPanel({
  adoption,
  loading,
  message,
  actionPending,
  canSteward,
  onProposeRecognized,
  onActivatePolicy,
  onSuspendPolicy
}: {
  adoption: AdoptionSummary | null;
  loading: boolean;
  message: string;
  actionPending: boolean;
  canSteward: boolean;
  onProposeRecognized: () => void;
  onActivatePolicy: () => void;
  onSuspendPolicy: () => void;
}) {
  const policies = adoption?.policies ?? [];
  const activePolicy = adoption?.activePolicies?.[0] ?? null;
  const proposedPolicy = policies.find((policy) => policy.status === "Proposed") ?? null;

  return (
    <section className="authority-panel" aria-label="What happens next">
      <div className="rail-heading">
        <h3>What happens next</h3>
        <small>{loading ? "Loading" : publicAuthorityLabel(activePolicy?.authorityLevel ?? adoption?.defaultAuthorityLevel ?? "Advisory")}</small>
      </div>
      {message ? <p className="audit-message">{message}</p> : null}
      <p className="muted">
        {activePolicy
          ? `${publicAuthorityLabel(activePolicy.authorityLevel)} rule is on for future questions like this.`
          : "Most answers are community signals unless a community guide turns on a next-step rule."}
      </p>
      <div className="authority-grid">
        <div>
          <span>Rules</span>
          <strong>{policies.length}</strong>
        </div>
        <div>
          <span>On</span>
          <strong>{adoption?.activePolicies?.length ?? 0}</strong>
        </div>
        <div>
          <span>Default</span>
          <strong>{publicAuthorityLabel(adoption?.defaultAuthorityLevel ?? "Advisory")}</strong>
        </div>
      </div>
      <div className="data-union-actions">
        <button type="button" onClick={onProposeRecognized} disabled={!canSteward || Boolean(proposedPolicy) || actionPending}>
          Suggest next-step rule
        </button>
        <button type="button" onClick={onActivatePolicy} disabled={!canSteward || !proposedPolicy || actionPending}>
          Turn rule on
        </button>
        <button type="button" onClick={onSuspendPolicy} disabled={!canSteward || !activePolicy || actionPending}>
          Pause rule
        </button>
      </div>
    </section>
  );
}

export function LoginPageClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function loginWithPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (!window.PublicKeyCredential) throw new Error("This browser does not expose passkeys.");
      const options = await apiCall<{ challengeId: string; publicKey: SerializedRequestOptions }>(
        "/auth/passkey/login/options",
        { method: "POST", body: JSON.stringify({ username: username || undefined }) }
      );
      const credential = (await navigator.credentials.get({
        publicKey: decodeRequestOptions(options.publicKey)
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("Passkey login was cancelled.");
      const payload = await apiCall<AuthPayload>("/auth/passkey/login/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: options.challengeId, credential: serializeAssertionCredential(credential) })
      });
      storeAuth(payload);
      setMessage(`Logged in as ${payload.user.displayName}.`);
      router.push("/feed");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Passkey login failed");
    } finally {
      setPending(false);
    }
  }

  async function loginWithWallet() {
    setPending(true);
    setError("");
    try {
      const ethereum = ethereumProvider();
      if (!ethereum) throw new Error("No Ethereum wallet provider found.");
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No wallet account selected.");
      const challenge = await apiCall<WalletAuthChallenge>("/auth/wallet/challenge", {
        method: "POST",
        body: JSON.stringify({ address })
      });
      const signature = (await ethereum.request({ method: "personal_sign", params: [challenge.message, address] })) as string;
      const aaSignature = await signWalletUserOperation(ethereum, address, challenge);
      const payload = await apiCall<AuthPayload>("/auth/wallet/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.challengeId, address, signature, ...aaSignature })
      });
      storeAuth(payload);
      setMessage(`Logged in as ${payload.user.displayName}.`);
      router.push("/feed");
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Wallet login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <p className="eyebrow">Welcome back</p>
        <h1>Log in</h1>
        <p className="muted">Use a passkey or wallet to keep your votes private and your account easy to recover.</p>
      </div>
      <form className="panel auth-form" onSubmit={loginWithPasskey}>
        <label className="field-label">
          Username
          <input aria-label="Username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <button className="wide-action" disabled={pending} type="submit">
          Continue with passkey
        </button>
        <button className="wide-action secondary" disabled={pending} type="button" onClick={() => void loginWithWallet()}>
          Continue with wallet
        </button>
        {message ? <p className="message">{message}</p> : null}
        {error ? <p className="message warning-message">{error}</p> : null}
      </form>
    </section>
  );
}

export function SignupPageClient() {
  const router = useRouter();
  const [draft, setDraft] = useState({ username: "", displayName: "", bio: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function createPasskeyAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (!window.PublicKeyCredential) throw new Error("This browser does not expose passkeys.");
      const options = await apiCall<{ challengeId: string; publicKey: SerializedCreationOptions }>(
        "/auth/passkey/register/options",
        {
          method: "POST",
          body: JSON.stringify(draft)
        }
      );
      const credential = (await navigator.credentials.create({
        publicKey: decodeCreationOptions(options.publicKey)
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("Passkey creation was cancelled.");
      const payload = await apiCall<AuthPayload>("/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: options.challengeId, credential: serializeRegistrationCredential(credential) })
      });
      storeAuth(payload);
      let nextMessage = `Account ready for ${payload.user.displayName}.`;
      if (payload.passkeyDeployment) {
        try {
          await completePasskeyDeployment(payload.passkeyDeployment);
          nextMessage = `Account ready for ${payload.user.displayName}. Private voting account ready.`;
        } catch (deploymentError) {
          nextMessage = `Account ready for ${payload.user.displayName}. Private voting account still needs retry: ${
            deploymentError instanceof Error ? deploymentError.message : "deployment failed"
          }`;
        }
      }
      setMessage(nextMessage);
      setDraft({ username: "", displayName: "", bio: "" });
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : "Passkey account creation failed");
    } finally {
      setPending(false);
    }
  }

  async function createWalletAccount() {
    setPending(true);
    setError("");
    try {
      const ethereum = ethereumProvider();
      if (!ethereum) throw new Error("No Ethereum wallet provider found.");
      const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No wallet account selected.");
      const challenge = await apiCall<WalletAuthChallenge>("/auth/wallet/challenge", {
        method: "POST",
        body: JSON.stringify({ ...draft, address })
      });
      const signature = (await ethereum.request({ method: "personal_sign", params: [challenge.message, address] })) as string;
      const aaSignature = await signWalletUserOperation(ethereum, address, challenge);
      const payload = await apiCall<AuthPayload>("/auth/wallet/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.challengeId, address, signature, ...aaSignature })
      });
      storeAuth(payload);
      setMessage(`Account ready for ${payload.user.displayName}.`);
      setDraft({ username: "", displayName: "", bio: "" });
    } catch (walletError) {
      setError(walletError instanceof Error ? walletError.message : "Wallet account creation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <p className="eyebrow">{siteCopy.actions.joinCrowd}</p>
        <h1>Create your account</h1>
        <p className="muted">Join communities, ask questions, and help turn private votes into public answers.</p>
      </div>
      <form className="panel auth-form" onSubmit={createPasskeyAccount}>
        <label className="field-label">
          Username
          <input
            aria-label="Username"
            autoComplete="username"
            value={draft.username}
            onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
            required
          />
        </label>
        <label className="field-label">
          Display name
          <input
            aria-label="Display name"
            value={draft.displayName}
            onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
            required
          />
        </label>
        <label className="field-label">
          Bio
          <textarea
            aria-label="Bio"
            value={draft.bio}
            onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))}
          />
        </label>
        <div className="button-row">
          <button className="wide-action" disabled={pending} type="submit">
            Join with passkey
          </button>
          <button className="wide-action secondary" disabled={pending} type="button" onClick={() => void createWalletAccount()}>
            Join with wallet
          </button>
          <button className="wide-action secondary" type="button" onClick={() => router.push("/account")}>
            View account
          </button>
        </div>
        {message ? <p className="message">{message}</p> : null}
        {error ? <p className="message warning-message">{error}</p> : null}
      </form>
    </section>
  );
}

export function FeedPageClient() {
  const data = useSocialData("all");
  const [feedMode, setFeedMode] = useState<FeedMode>("home");
  const [feedScope, setFeedScope] = useState<FeedScope>("for-you");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedRefreshNonce, setFeedRefreshNonce] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [discussion, setDiscussion] = useState<DiscussionPost[]>([]);
  const [discussionDraft, setDiscussionDraft] = useState("");
  const [composeCommunityId, setComposeCommunityId] = useState("");
  const [questionDraft, setQuestionDraft] = useState(emptyQuestion);
  const [responseDraft, setResponseDraft] = useState(emptyResponseDraft);
  const [credential, setCredential] = useState<{ credentialId: string; credentialSecret: string } | null>(null);
  const [civicRecord, setCivicRecord] = useState<CivicRecord | null>(null);
  const [replayCheck, setReplayCheck] = useState<ReplayCheck | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditMessage, setAuditMessage] = useState("");
  const [dataUnion, setDataUnion] = useState<DataUnionSummary | null>(null);
  const [dataUnionLoading, setDataUnionLoading] = useState(false);
  const [dataUnionMessage, setDataUnionMessage] = useState("");
  const [adoption, setAdoption] = useState<AdoptionSummary | null>(null);
  const [adoptionLoading, setAdoptionLoading] = useState(false);
  const [adoptionMessage, setAdoptionMessage] = useState("");
  const [pending, setPending] = useState(false);

  const activeRole = data.selectedCommunity?.activeUserRole ?? (data.selectedCommunity?.isMember ? "Member" : "Visitor");
  const profileTarget = useMemo<Community | null>(() => {
    if (!data.activeUser?.profileCommunityId) return null;
    return {
      id: data.activeUser.profileCommunityId,
      slug: `user-${data.activeUser.username}`,
      name: `${data.activeUser.displayName}'s feed`,
      description: data.activeUser.bio || "Personal question feed.",
      kind: "Profile",
      profileUserId: data.activeUser.id,
      visibility: "Public",
      defaultAuthorityLevel: "Advisory",
      credentialSchemaId: data.communities[0]?.credentialSchemaId ?? "credential-vancouver-resident",
      memberCount: 1,
      questionCount: 0,
      isMember: true,
      activeUserRole: "Owner"
    };
  }, [data.activeUser, data.communities]);
  const composeTargets = useMemo(() => [profileTarget, ...data.communities].filter(Boolean) as Community[], [profileTarget, data.communities]);
  const feedQuestions = useMemo(() => feedItems.flatMap((item) => (item.question ? [item.question] : [])), [feedItems]);
  const selectedQuestion = useMemo(
    () => feedQuestions.find((question) => question.id === selectedQuestionId) ?? feedQuestions[0] ?? data.questions[0] ?? null,
    [data.questions, feedQuestions, selectedQuestionId]
  );
  const activeAnswerSchema = useMemo(
    () => BuiltInAnswerSchemas.find((schema) => schema.answerSchemaId === selectedQuestion?.answerSchemaId) ?? BuiltInAnswerSchemas[0],
    [selectedQuestion?.answerSchemaId]
  );
  const composeCommunity =
    composeTargets.find((community) => community.id === composeCommunityId) ??
    profileTarget ??
    data.communities.find((community) => community.id === "community-vancouver") ??
    data.communities[0] ??
    null;
  const selectedQuestionCommunity = selectedQuestion?.community ?? data.selectedCommunity;
  const pollStatus = selectedQuestion?.poll?.status ?? "Configured";
  const pendingChallenge = selectedQuestion?.challenges.find((challenge) => challenge.ruling === "Pending") ?? null;
  const pendingResultChallenge = selectedQuestion?.poll?.resultChallenges?.find((challenge) => challenge.ruling === "Pending") ?? null;
  const isPollOpen = pollStatus === "Open";
  const isActiveUserProposer = Boolean(selectedQuestion && data.activeUser?.id === selectedQuestion.proposer);
  const isActiveUserChallenger = Boolean(pendingChallenge && data.activeUser?.id === pendingChallenge.challenger);
  const canCurateSelectedQuestion = ["Owner", "Moderator"].includes(selectedQuestionCommunity?.activeUserRole ?? "");
  const canChallengeQuestion = Boolean(
    selectedQuestion && data.activeUser && !isActiveUserProposer && ["Submitted", "Challenged", "Accepted"].includes(selectedQuestion.status)
  );
  const canRuleChallenge = Boolean(
    pendingChallenge && data.activeUser && canCurateSelectedQuestion && !isActiveUserProposer && !isActiveUserChallenger
  );
  const canAcceptQuestion = Boolean(
    selectedQuestion?.poll &&
      data.activeUser &&
      canCurateSelectedQuestion &&
      !isActiveUserProposer &&
      pollStatus === "Configured" &&
      ["Submitted", "Accepted"].includes(selectedQuestion.status) &&
      !pendingChallenge
  );
  const canCloseAndTally = Boolean(selectedQuestion?.poll && isPollOpen);
  const canChallengeResult = Boolean(selectedQuestion?.poll?.result && data.activeUser && !pendingResultChallenge);
  const canRuleResultChallenge = Boolean(pendingResultChallenge && data.activeUser && canCurateSelectedQuestion);
  const canFinalizeAndArchive = Boolean(
    selectedQuestion?.poll?.result &&
      !pendingResultChallenge &&
      canCurateSelectedQuestion &&
      ["Published", "Corrected"].includes(selectedQuestion.poll.result.finalStatus ?? "Published")
  );
  const ballotDisabledReason = selectedQuestion?.poll
    ? !isPollOpen
      ? pollStatus === "Configured"
        ? "Voting opens after a community guide checks the question."
        : `Voting is disabled while this vote is ${publicPollStatus(pollStatus)}.`
      : credential
      ? ""
      : "Get a voting pass before submitting a private vote."
    : "This question does not have a poll yet.";
  const proposedDataUnionPolicy = (dataUnion?.policies ?? []).find((policy) => policy.status === "Proposed") ?? null;
  const activeDataUnionPolicy = dataUnion?.activePolicy ?? null;
  const userHasDataUnionConsent = Boolean(
    data.activeUser && (dataUnion?.consents ?? []).some((consent) => consent.status === "Active" && consent.userId === data.activeUser?.id)
  );
  const firstPublishedDataProduct = (dataUnion?.products ?? []).find((product) => product.status === "Published") ?? null;
  const proposedAdoptionPolicy = (adoption?.policies ?? []).find((policy) => policy.status === "Proposed") ?? null;
  const activeAdoptionPolicy = adoption?.activePolicies?.[0] ?? null;
  const selectedResultId = selectedQuestion?.poll?.result?.id;
  const canStewardDataUnion = Boolean(data.activeUser && selectedQuestionCommunity && canCurateSelectedQuestion);
  const canConsentToDataUnion = Boolean(data.activeUser && activeDataUnionPolicy && !userHasDataUnionConsent);
  const canPublishDataUnionProduct = Boolean(canStewardDataUnion && activeDataUnionPolicy && selectedResultId && !firstPublishedDataProduct);
  const canGrantDataUnionAccess = Boolean(canStewardDataUnion && firstPublishedDataProduct);
  const canPost = Boolean(
    data.activeUser &&
      composeCommunity &&
      (composeCommunity.kind === "Profile"
        ? composeCommunity.profileUserId === data.activeUser.id
        : composeCommunity.visibility === "Public" || composeCommunity.isMember) &&
      (questionDraft.audience !== "Members" || composeCommunity.isMember)
  );

  const filteredFeedItems = useMemo(() => {
    const matchesQuestion = (question: Question) => {
      if (feedMode === "open") return question.poll?.status === "Open";
      if (feedMode === "review") {
        return (
          question.poll?.status === "Configured" || ["Submitted", "Challenged", "Amendment", "Accepted"].includes(question.status)
        );
      }
      if (feedMode === "results") {
        return question.status === "Archived" || question.poll?.status === "ResultPublished" || Boolean(question.poll?.result);
      }
      return true;
    };
    return feedItems.filter((item) => feedMode === "home" || (item.question ? matchesQuestion(item.question) : false));
  }, [feedItems, feedMode]);

  useEffect(() => {
    if (!composeCommunityId && composeTargets.length) {
      setComposeCommunityId(profileTarget?.id ?? data.communities.find((community) => community.id === "community-vancouver")?.id ?? composeTargets[0].id);
    }
  }, [composeCommunityId, composeTargets, data.communities, profileTarget?.id]);

  useEffect(() => {
    if (composeCommunity?.kind === "Profile" && questionDraft.audience === "Members") {
      setQuestionDraft((current) => ({ ...current, audience: "Followers" }));
    }
  }, [composeCommunity?.kind, questionDraft.audience]);

  useEffect(() => {
    let active = true;
    async function loadFeed() {
      setFeedLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("mode", feedScope);
        if (data.activeUser?.id) params.set("userId", data.activeUser.id);
        if (feedScope === "profile") {
          if (!data.activeUser?.id) {
            setFeedItems([]);
            return;
          }
          params.set("profileUserId", data.activeUser.id);
        }
        if (feedScope === "community") {
          const communityId = data.selectedCommunityId !== "all" ? data.selectedCommunityId : data.communities[0]?.id;
          if (!communityId) {
            setFeedItems([]);
            return;
          }
          params.set("communityId", communityId);
        }
        const payload = await apiCall<{ items: FeedItem[] }>(`/feed?${params.toString()}`);
        if (!active) return;
        setFeedItems(payload.items ?? []);
      } catch (feedError) {
        if (!active) return;
        setFeedItems([]);
        data.setMessage(feedError instanceof Error ? feedError.message : "Feed failed to load");
      } finally {
        if (active) setFeedLoading(false);
      }
    }
    void loadFeed();
    return () => {
      active = false;
    };
  }, [feedScope, data.activeUser?.id, data.selectedCommunityId, data.communities, feedRefreshNonce]);

  useEffect(() => {
    if (selectedQuestionId && feedQuestions.some((question) => question.id === selectedQuestionId)) return;
    setSelectedQuestionId(feedQuestions[0]?.id ?? "");
  }, [feedQuestions, selectedQuestionId]);

  useEffect(() => {
    if (!selectedQuestion?.id) {
      setDiscussion([]);
      return;
    }
    const params = new URLSearchParams();
    if (data.activeUser?.id) params.set("userId", data.activeUser.id);
    void apiCall<{ discussion: DiscussionPost[] }>(`/questions/${selectedQuestion.id}/discussion?${params.toString()}`)
      .then((payload) => setDiscussion(payload.discussion ?? []))
      .catch(() => setDiscussion([]));
  }, [selectedQuestion?.id, data.activeUser?.id]);

  useEffect(() => {
    if (!selectedQuestion?.id) {
      setCivicRecord(null);
      setReplayCheck(null);
      setAuditMessage("");
      return;
    }
    let active = true;
    setAuditLoading(true);
    setAuditMessage("");
    Promise.all([
      apiCall<CivicRecord>(`/public/questions/${selectedQuestion.id}/civic-record`),
      apiCall<ReplayCheck>(`/public/questions/${selectedQuestion.id}/replay-check`)
    ])
      .then(([record, replay]) => {
        if (!active) return;
        setCivicRecord(record);
        setReplayCheck(replay);
      })
      .catch((error) => {
        if (!active) return;
        setCivicRecord(null);
        setReplayCheck(null);
        setAuditMessage(error instanceof Error ? error.message : "Proof records are unavailable for this question.");
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedQuestion?.id]);

  useEffect(() => {
    if (!selectedQuestionCommunity?.id) {
      setDataUnion(null);
      setDataUnionMessage("");
      return;
    }
    let active = true;
    setDataUnionLoading(true);
    setDataUnionMessage("");
    const params = new URLSearchParams();
    if (data.activeUser?.id) params.set("userId", data.activeUser.id);
    apiCall<DataUnionSummary>(`/communities/${selectedQuestionCommunity.id}/data-union?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setDataUnion(payload);
      })
      .catch((error) => {
        if (!active) return;
        setDataUnion(null);
        setDataUnionMessage(error instanceof Error ? error.message : "Data Rewards records are unavailable for this community.");
      })
      .finally(() => {
        if (active) setDataUnionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedQuestionCommunity?.id, data.activeUser?.id]);

  useEffect(() => {
    if (!selectedQuestionCommunity?.id) {
      setAdoption(null);
      setAdoptionMessage("");
      return;
    }
    let active = true;
    setAdoptionLoading(true);
    setAdoptionMessage("");
    const params = new URLSearchParams();
    if (data.activeUser?.id) params.set("userId", data.activeUser.id);
    apiCall<AdoptionSummary>(`/communities/${selectedQuestionCommunity.id}/adoption?${params.toString()}`)
      .then((payload) => {
        if (active) setAdoption(payload);
      })
      .catch((error) => {
        if (!active) return;
        setAdoption(null);
        setAdoptionMessage(error instanceof Error ? error.message : "Next-step rules are unavailable for this community.");
      })
      .finally(() => {
        if (active) setAdoptionLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedQuestionCommunity?.id, data.activeUser?.id]);

  async function loadDataUnion(communityId: string) {
    const params = new URLSearchParams();
    if (data.activeUser?.id) params.set("userId", data.activeUser.id);
    return apiCall<DataUnionSummary>(`/communities/${communityId}/data-union?${params.toString()}`);
  }

  async function refreshDataUnion() {
    if (!selectedQuestionCommunity?.id) return;
    setDataUnion(await loadDataUnion(selectedQuestionCommunity.id));
  }

  async function refreshAdoption() {
    if (!selectedQuestionCommunity?.id) return;
    const params = new URLSearchParams();
    if (data.activeUser?.id) params.set("userId", data.activeUser.id);
    setAdoption(await apiCall<AdoptionSummary>(`/communities/${selectedQuestionCommunity.id}/adoption?${params.toString()}`));
  }

  async function selectCommunity(communityId: string) {
    setFeedScope(communityId === "all" ? "for-you" : "community");
    data.setSelectedCommunityId(communityId);
    await data.refresh(data.activeUserId, communityId);
    setFeedRefreshNonce((value) => value + 1);
  }

  async function followCommunity(community: Community) {
    if (!data.activeUser) return;
    setPending(true);
    try {
      await apiCall(`/communities/${community.id}/follow`, { method: "POST", body: JSON.stringify({ userId: data.activeUser.id }) });
      data.setMessage(`${data.activeUser.displayName} is following ${community.kind === "Profile" ? "@" : "p/"}${community.slug.replace(/^user-/, "")}.`);
      await data.refresh(data.activeUser.id, data.selectedCommunityId);
      setFeedRefreshNonce((value) => value + 1);
    } catch (followError) {
      data.setMessage(followError instanceof Error ? followError.message : "Follow failed");
    } finally {
      setPending(false);
    }
  }

  async function followProfile(profile: DiscoveryCommunity) {
    if (!data.activeUser || !profile.profileUserId) return;
    setPending(true);
    try {
      await apiCall(`/users/${profile.profileUserId}/follow`, { method: "POST", body: JSON.stringify({ userId: data.activeUser.id }) });
      data.setMessage(`${data.activeUser.displayName} is following @${profile.slug.replace(/^user-/, "")}.`);
      await data.refresh(data.activeUser.id, data.selectedCommunityId);
      setFeedRefreshNonce((value) => value + 1);
    } catch (followError) {
      data.setMessage(followError instanceof Error ? followError.message : "Follow failed");
    } finally {
      setPending(false);
    }
  }

  async function joinCommunity(community: Community) {
    if (!data.activeUser) return;
    setPending(true);
    try {
      await apiCall(`/communities/${community.id}/join`, { method: "POST", body: JSON.stringify({ userId: data.activeUser.id }) });
      data.setMessage(`${data.activeUser.displayName} joined ${community.name}.`);
      await data.refresh(data.activeUser.id, community.id);
      setFeedRefreshNonce((value) => value + 1);
    } catch (joinError) {
      data.setMessage(joinError instanceof Error ? joinError.message : "Join failed");
    } finally {
      setPending(false);
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.activeUser || !composeCommunity) return;
    setPending(true);
    try {
      const payload = {
        ...questionDraft,
        proposer: data.activeUser.id,
        communityId: composeCommunity.id,
        topicIds: [composeCommunity.kind === "Profile" ? "profile" : "community", composeCommunity.slug.replace(/^user-/, "")],
        geoScope: composeCommunity.name,
        methodologyLabel:
          composeCommunity.kind === "Profile"
            ? `Answered by ${data.activeUser.displayName}'s audience who chose to take part`
            : `Answered by ${composeCommunity.name} members who chose to take part`,
        credentialSchemaId: composeCommunity.credentialSchemaId
      };
      const created = await apiCall<{ question: Question; stakedPc: number }>("/questions", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setQuestionDraft(emptyQuestion);
      setSelectedQuestionId(created.question.id);
      data.setMessage("Question asked and sent for checking.");
      await data.refresh(data.activeUser.id, composeCommunity.id);
      setFeedScope(composeCommunity.kind === "Profile" ? "profile" : "community");
      setFeedRefreshNonce((value) => value + 1);
    } catch (postError) {
      data.setMessage(postError instanceof Error ? postError.message : "Question post failed");
    } finally {
      setPending(false);
    }
  }

  async function postDiscussion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedQuestion || !data.activeUser || !discussionDraft.trim()) return;
    await apiCall(`/questions/${selectedQuestion.id}/discussion`, {
      method: "POST",
      body: JSON.stringify({ authorId: data.activeUser.id, kind: "Comment", body: discussionDraft })
    });
    setDiscussionDraft("");
    data.setMessage("Comment posted.");
    const params = new URLSearchParams();
    params.set("userId", data.activeUser.id);
    const payload = await apiCall<{ discussion: DiscussionPost[] }>(`/questions/${selectedQuestion.id}/discussion?${params.toString()}`);
    setDiscussion(payload.discussion ?? []);
    await data.refresh(data.activeUser.id, data.selectedCommunityId);
    setFeedRefreshNonce((value) => value + 1);
  }

  async function runCivicAction(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
    } catch (actionError) {
      data.setMessage(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  async function refreshSelectedQuestion() {
    await data.refresh(data.activeUser?.id ?? data.activeUserId, data.selectedCommunityId);
    setFeedRefreshNonce((value) => value + 1);
  }

  async function challengeQuestion() {
    if (!selectedQuestion || !data.activeUser) return;
    const payload = await apiCall<{ stakedPc: string }>(`/questions/${selectedQuestion.id}/challenges`, {
      method: "POST",
      body: JSON.stringify({ challenger: data.activeUser.id })
    });
      data.setMessage("Question flagged for review.");
    await refreshSelectedQuestion();
  }

  async function ruleChallenge(ruling: "Rejected" | "Sustained") {
    if (!selectedQuestion || !pendingChallenge || !data.activeUser) return;
    await apiCall(`/questions/${selectedQuestion.id}/challenges/${pendingChallenge.id}/ruling`, {
      method: "POST",
      body: JSON.stringify({
        ruling,
        juror: data.activeUser.id,
        resolution:
          ruling === "Sustained"
            ? "The flag is kept from the social client review panel."
            : "The flag is cleared from the social client review panel."
      })
    });
    data.setMessage(ruling === "Sustained" ? "Flag kept." : "Flag cleared.");
    await refreshSelectedQuestion();
  }

  async function acceptQuestion() {
    if (!selectedQuestion || !data.activeUser) return;
    await apiCall(`/questions/${selectedQuestion.id}/accept`, {
      method: "POST",
      body: JSON.stringify({ curator: data.activeUser.id })
    });
    data.setMessage("Question checked. Voting is open.");
    await refreshSelectedQuestion();
  }

  async function issueCredential() {
    if (!data.activeUser) return;
    const payload = await apiCall<{ credential: { credentialId: string; secret: string } }>("/credentials/demo-resident", {
      method: "POST",
      body: JSON.stringify({
        holderAlias: data.activeUser.id,
        schemaId: selectedQuestionCommunity?.credentialSchemaId ?? undefined
      })
    });
    setCredential({ credentialId: payload.credential.credentialId, credentialSecret: payload.credential.secret });
    data.setMessage("Voting pass issued.");
  }

  async function vote(response: BallotResponse, label: string) {
    if (!selectedQuestion?.poll || !credential) return;
    await apiCall(`/polls/${selectedQuestion.poll.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ ...credential, response })
    });
    setResponseDraft(emptyResponseDraft);
    data.setMessage(`Private ${label} vote accepted.`);
    await refreshSelectedQuestion();
  }

  async function submitDraftResponse() {
    await vote(buildDraftResponse(activeAnswerSchema, responseDraft), activeAnswerSchema.label.toLowerCase());
  }

  async function closeAndTally() {
    if (!selectedQuestion?.poll) return;
    await apiCall(`/polls/${selectedQuestion.poll.id}/close`, { method: "POST", body: "{}" });
    await apiCall(`/polls/${selectedQuestion.poll.id}/tally`, { method: "POST", body: "{}" });
    data.setMessage("Votes counted and public result receipt posted.");
    await refreshSelectedQuestion();
  }

  async function challengeResult() {
    if (!selectedQuestion?.poll || !data.activeUser) return;
    const payload = await apiCall<{ stakedPc: string }>(`/polls/${selectedQuestion.poll.id}/results/challenges`, {
      method: "POST",
      body: JSON.stringify({
        challenger: data.activeUser.id,
        reasonCode: "PrivacyThresholdViolation",
        evidence: "Review the published privacy report before finalization."
      })
    });
    data.setMessage("Result flagged for review.");
    await refreshSelectedQuestion();
  }

  async function ruleResultChallenge(ruling: "Rejected" | "Sustained") {
    if (!selectedQuestion?.poll || !pendingResultChallenge || !data.activeUser) return;
    await apiCall(`/polls/${selectedQuestion.poll.id}/results/challenges/${pendingResultChallenge.id}/ruling`, {
      method: "POST",
      body: JSON.stringify({
        ruling,
        juror: data.activeUser.id,
        resolution:
          ruling === "Sustained"
            ? "Privacy review sustained from the social client review panel."
            : "Privacy review rejected from the social client review panel."
      })
    });
    data.setMessage(ruling === "Sustained" ? "Result flag kept." : "Result flag cleared.");
    await refreshSelectedQuestion();
  }

  async function finalizeAndArchive() {
    if (!selectedQuestion?.poll || !data.activeUser) return;
    await apiCall(`/polls/${selectedQuestion.poll.id}/finalize`, { method: "POST", body: JSON.stringify({ curator: data.activeUser.id }) });
    await apiCall(`/questions/${selectedQuestion.id}/archive`, { method: "POST", body: JSON.stringify({ curator: data.activeUser.id }) });
    data.setMessage("Final result saved to the public record.");
    await refreshSelectedQuestion();
  }

  async function proposeDataUnionPolicy() {
    if (!selectedQuestionCommunity || !data.activeUser) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/data-union/policies`, {
      method: "POST",
      body: JSON.stringify({
        steward: data.activeUser.id,
        title: `${selectedQuestionCommunity.name} sharing rules`.slice(0, 140),
        purpose: "Allow opt-in, privacy-safe reports with clear community approval and reward routing.",
        minimumCohortSize: 1,
        revenueSplit: { communityTreasuryPercent: 70, participantPoolPercent: 20, operatorPoolPercent: 10 }
      })
    });
    data.setMessage("Sharing rules suggested.");
    await refreshDataUnion();
  }

  async function activateDataUnionPolicy() {
    if (!selectedQuestionCommunity || !data.activeUser || !proposedDataUnionPolicy) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/data-union/policies/${proposedDataUnionPolicy.id}/activate`, {
      method: "POST",
      body: JSON.stringify({
        steward: data.activeUser.id,
        activationRecord: "Community guide turned on the sharing rules from the social client."
      })
    });
    data.setMessage("Sharing rules turned on.");
    await refreshDataUnion();
  }

  async function recordDataUnionConsent() {
    if (!selectedQuestionCommunity || !data.activeUser || !activeDataUnionPolicy) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/data-union/consents`, {
      method: "POST",
      body: JSON.stringify({
        userId: data.activeUser.id,
        policyId: activeDataUnionPolicy.id,
        scope: "AggregateAnalytics",
        consentStatement: "I opt in to privacy-safe aggregate data products governed by this community policy."
      })
    });
    data.setMessage("Data Rewards opt-in recorded.");
    await refreshDataUnion();
  }

  async function publishDataUnionProduct() {
    if (!selectedQuestionCommunity || !data.activeUser || !activeDataUnionPolicy || !selectedQuestion || !selectedResultId) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/data-union/products`, {
      method: "POST",
      body: JSON.stringify({
        steward: data.activeUser.id,
        policyId: activeDataUnionPolicy.id,
        resultId: selectedResultId,
        productType: "AggregateResultDataset",
        title: `${selectedQuestion.title} aggregate signal`.slice(0, 140),
        description: "Anonymous result totals, method notes, and proof links for approved buyers.",
        methodology: "Derived only from the published public receipt and proof record.",
        pricePc: 1000
      })
    });
    data.setMessage("Data Rewards report published.");
    await refreshDataUnion();
  }

  async function grantDataUnionAccess() {
    if (!selectedQuestionCommunity || !data.activeUser || !firstPublishedDataProduct) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/data-union/products/${firstPublishedDataProduct.id}/access-grants`, {
      method: "POST",
      body: JSON.stringify({
        steward: data.activeUser.id,
        buyerId: "public-interest-research-lab",
        buyerType: "ResearchPartner",
        accessPurpose: "Analyze aggregate civic sentiment without respondent identification.",
        paymentPc: firstPublishedDataProduct.pricePc
      })
    });
    data.setMessage("Buyer access recorded.");
    await refreshDataUnion();
  }

  async function proposeRecognizedPolicy() {
    if (!selectedQuestionCommunity || !data.activeUser) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/adoption/proposals`, {
      method: "POST",
      body: JSON.stringify({
        steward: data.activeUser.id,
        authorityLevel: "Recognized",
        eligibleQuestionTypes: ["community", selectedQuestionCommunity.slug],
        credentialSchemaIds: [selectedQuestionCommunity.credentialSchemaId],
        quorumRule: "Community steward recognition for local MVP social-client policy.",
        approvalRule: "Community guide activation under transparent policy record."
      })
    });
    data.setMessage("Next-step rule suggested.");
    await refreshAdoption();
  }

  async function activateRecognizedPolicy() {
    if (!selectedQuestionCommunity || !data.activeUser || !proposedAdoptionPolicy) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/adoption/policies/${proposedAdoptionPolicy.id}/activate`, {
      method: "POST",
      body: JSON.stringify({
        steward: data.activeUser.id,
        adoptionRecord: "Community guide turned on a next-step rule from the social client."
      })
    });
    data.setMessage("Next-step rule turned on.");
    await refreshAdoption();
  }

  async function suspendRecognizedPolicy() {
    if (!selectedQuestionCommunity || !data.activeUser || !activeAdoptionPolicy) return;
    await apiCall(`/communities/${selectedQuestionCommunity.id}/adoption/policies/${activeAdoptionPolicy.id}/suspend`, {
      method: "POST",
      body: JSON.stringify({
        steward: data.activeUser.id,
        reason: "Community guide paused a next-step rule from the social client pending review."
      })
    });
    data.setMessage("Next-step rule paused.");
    await refreshAdoption();
  }

  function renderBallotControls() {
    const disabled = Boolean(ballotDisabledReason) || pending;
    if (!selectedQuestion?.poll) return null;
    if (activeAnswerSchema.responseShape === "SingleChoice") {
      return (
        <>
          {activeAnswerSchema.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => void runCivicAction(() => vote({ type: "single_choice", choice: option.id }, option.label.toLowerCase()))}
              disabled={disabled}
              title={ballotDisabledReason || undefined}
            >
              Vote {option.label.toLowerCase()}
            </button>
          ))}
          {activeAnswerSchema.allowsAbstain ? (
            <button
              type="button"
              onClick={() => void runCivicAction(() => vote({ type: "single_choice", choice: "abstain" }, "abstain"))}
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
              />
              {option.label}
            </label>
          ))}
          <button type="button" onClick={() => void runCivicAction(submitDraftResponse)} disabled={disabled}>
            Submit response
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
              type="button"
              onClick={() => void runCivicAction(() => vote({ type: "scale", value }, String(value)))}
              disabled={disabled}
              title={ballotDisabledReason || undefined}
            >
              {value}
            </button>
          ))}
        </>
      );
    }
    return (
      <div className="ballot-control compact">
        <small>{activeAnswerSchema.label}</small>
        <button type="button" onClick={() => void runCivicAction(submitDraftResponse)} disabled={disabled} title={ballotDisabledReason || undefined}>
          Submit default response
        </button>
      </div>
    );
  }

  return (
    <section className="social-page">
      <aside className="social-rail">
        <ProfileSummary user={data.activeUser} role={activeRole} />
        <section className="panel rail-panel">
          <div className="rail-heading">
            <h2>Communities</h2>
            <small>{data.discovery?.communityFollows.length ?? 0} followed</small>
          </div>
          <div className="community-list">
            <div className={`community-row${data.selectedCommunityId === "all" ? " active" : ""}`}>
              <button className="community-select" onClick={() => void selectCommunity("all")}>
                <strong>For You</strong>
                <small>Questions from people, topics, and communities you follow</small>
              </button>
            </div>
            {data.communities.map((community) => {
              const discovered = data.discoveryByCommunityId.get(community.id);
              const followed = Boolean(discovered?.followedByActiveUser);
              return (
                <div key={community.id} className={`community-row${data.selectedCommunityId === community.id ? " active" : ""}`}>
                  <button className="community-select" onClick={() => void selectCommunity(community.id)}>
                    <strong>p/{community.slug}</strong>
                    <small>
                      {community.memberCount} members · {discovered?.followerCount ?? 0} followers · {community.questionCount} questions
                    </small>
                  </button>
                  {community.visibility === "Private" && !community.isMember ? (
                    <button className="mini-action" disabled={pending} onClick={() => void joinCommunity(community)}>
                      Join
                    </button>
                  ) : (
                    <button className="mini-action" disabled={pending || followed} onClick={() => void followCommunity(community)}>
                      {followed ? "Following" : "Follow"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel rail-panel">
          <div className="rail-heading">
            <h2>People</h2>
            <small>{data.discovery?.profiles?.length ?? 0} profiles</small>
          </div>
          <div className="community-list">
            {(data.discovery?.profiles ?? [])
              .filter((profile) => profile.profileUserId !== data.activeUser?.id)
              .slice(0, 5)
              .map((profile) => (
                <div key={profile.id} className="community-row">
                  <button className="community-select" type="button" onClick={() => void followProfile(profile)}>
                    <strong>@{profile.slug.replace(/^user-/, "")}</strong>
                    <small>
                      {profile.followerCount} followers · {profile.questionCount} questions
                    </small>
                  </button>
                  <button className="mini-action" disabled={pending || profile.followedByActiveUser} onClick={() => void followProfile(profile)}>
                    {profile.followedByActiveUser ? "Following" : "Follow"}
                  </button>
                </div>
              ))}
          </div>
        </section>
        <section className="panel rail-panel">
          <div className="rail-heading">
            <h2>Topics</h2>
            <small>{data.discovery?.topicFollows.length ?? 0} followed</small>
          </div>
          <div className="topic-list">
            {(data.discovery?.topics ?? []).slice(0, 6).map((topic) => (
              <div className="topic-pill" key={topic.topicId}>
                <strong>#{topic.topicId}</strong>
                <small>
                  {topic.questionCount} questions · {topic.followerCount} followers
                </small>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <div className="social-main">
        <section className="feed-hero">
          <div>
            <p className="eyebrow">Community feed</p>
            <h1>{siteCopy.nav.feed}</h1>
            <p className="muted">Find questions from your communities, cast a private vote, and see the public answer.</p>
          </div>
          <div className="network-stats">
            <span>{data.communities.length} communities</span>
            <span>{feedItems.length} feed items</span>
            <span>{data.discovery?.communityFollows.length ?? 0} follows</span>
          </div>
        </section>

        <form className="panel compose social-composer" onSubmit={submitQuestion}>
          <div className="composer-head">
            <div className="avatar small">{initials(data.activeUser?.displayName ?? "PC")}</div>
            <div>
              <h2>{siteCopy.actions.askCrowd}</h2>
              <p className="muted">Asking as {data.activeUser?.displayName ?? "local account"}</p>
            </div>
          </div>
          <label className="field-label">
            Post to
            <select aria-label="Post destination" value={composeCommunity?.id ?? ""} onChange={(event) => setComposeCommunityId(event.target.value)}>
              {composeTargets.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.kind === "Profile" ? "My profile" : `p/${community.slug}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Who can see it?
            <select
              aria-label="Question audience"
              value={questionDraft.audience}
              onChange={(event) => setQuestionDraft((current) => ({ ...current, audience: event.target.value as QuestionAudience }))}
            >
              <option value="Public">Everyone</option>
              <option value="Followers">Followers</option>
              {composeCommunity?.kind !== "Profile" ? <option value="Members">Members</option> : null}
            </select>
          </label>
          <input
            aria-label="Question title"
            placeholder="What should this community decide or estimate?"
            value={questionDraft.title}
            onChange={(event) => setQuestionDraft((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <textarea
            aria-label="Question body"
            placeholder="Add context. Keep it simple."
            value={questionDraft.body}
            onChange={(event) => setQuestionDraft((current) => ({ ...current, body: event.target.value }))}
            required
          />
          <select
            aria-label="Question format"
            value={questionDraft.answerSchemaId}
            onChange={(event) => setQuestionDraft((current) => ({ ...current, answerSchemaId: event.target.value }))}
          >
            {BuiltInAnswerSchemas.map((schema) => (
              <option key={schema.answerSchemaId} value={schema.answerSchemaId}>
                {schema.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Sponsor disclosure"
            placeholder="Who is asking? (optional)"
            value={questionDraft.sponsorDisclosure}
            onChange={(event) => setQuestionDraft((current) => ({ ...current, sponsorDisclosure: event.target.value }))}
          />
          <button className="wide-action" disabled={!canPost || pending} title={canPost ? undefined : "Join this private community before asking."}>
            Ask question
          </button>
        </form>

        <section className="panel feed-list-panel">
          <div className="section-heading">
            <div>
              <h2>{feedScope === "profile" ? "My profile feed" : feedScope === "community" ? "Community feed" : feedScope === "global" ? "Global feed" : feedScope === "following" ? "Following" : "For You"}</h2>
              <p className="muted">{data.loading || feedLoading ? "Loading feed" : `${filteredFeedItems.length} visible items`}</p>
            </div>
          </div>
          <div className="feed-tabs" role="tablist" aria-label="Feed scopes">
            {[
              { key: "for-you", label: "For You" },
              { key: "global", label: "Global" },
              { key: "following", label: "Following" },
              { key: "profile", label: "My Profile" }
            ].map((scope) => (
              <button
                key={scope.key}
                className={feedScope === scope.key ? "active" : ""}
                onClick={() => setFeedScope(scope.key as FeedScope)}
                type="button"
              >
                {scope.label}
              </button>
            ))}
          </div>
          <div className="feed-tabs" role="tablist" aria-label="Feed filters">
            {[
              { key: "home", label: "All" },
              { key: "open", label: "Voting" },
              { key: "review", label: "Checking" },
              { key: "results", label: "Results" }
            ].map((mode) => (
              <button
                key={mode.key}
                className={feedMode === mode.key ? "active" : ""}
                onClick={() => setFeedMode(mode.key as FeedMode)}
                type="button"
              >
                {mode.label}
                <small>{mode.key === "home" ? feedItems.length : filteredFeedItems.length}</small>
              </button>
            ))}
          </div>
          <div className="post-list">
            {filteredFeedItems.length ? (
              filteredFeedItems.map((item) =>
                item.itemType === "question" && item.question ? (
                  <PostCard
                    key={item.id}
                    question={item.question}
                    active={selectedQuestion?.id === item.question.id}
                    onSelect={(nextQuestion) => setSelectedQuestionId(nextQuestion.id)}
                  />
                ) : (
                  <FeedActivityCard key={item.id} item={item} onSelect={(nextQuestion) => setSelectedQuestionId(nextQuestion.id)} />
                )
              )
            ) : (
              <div className="empty-state">
                <strong>No feed items in this view</strong>
                <p>Switch feeds or ask the first question.</p>
              </div>
            )}
          </div>
        </section>
        {data.message ? <p className="message">{data.message}</p> : null}
        {data.error ? <p className="message warning-message">{data.error}</p> : null}
      </div>

      <aside className="panel social-detail">
        {selectedQuestion ? (
          <>
            <div className="statusline">
              <span>{publicQuestionStatus(selectedQuestion.status)}</span>
              <span>{selectedQuestion.poll ? publicPollStatus(selectedQuestion.poll.status) : "No vote yet"}</span>
              <span>{publicAuthorityLabel(selectedQuestion.authorityLevel)}</span>
            </div>
            <h2>{selectedQuestion.title}</h2>
            <p className="muted">{selectedQuestion.methodologyLabel}</p>
            <dl className="meta-grid">
              <div>
                <dt>Community</dt>
                <dd>
                  {selectedQuestion.community?.kind === "Profile" ? "@" : "p/"}
                  {selectedQuestion.community?.slug?.replace(/^user-/, "") ?? "community"}
                </dd>
              </div>
              <div>
                <dt>Turnout</dt>
                <dd>{selectedQuestion.poll?.result?.turnout ?? 0}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{selectedQuestion.version}</dd>
              </div>
            </dl>
            <CivicAuditPanel record={civicRecord} replay={replayCheck} loading={auditLoading} message={auditMessage} />
            <details className="civic-actions-panel" open>
              <summary>
                <span>Actions</span>
                <small>{data.activeUser ? `Acting as ${data.activeUser.displayName}` : "Sign in to act"}</small>
              </summary>
              <div className="action-groups">
                <section className="action-group">
                  <div className="group-heading">
                    <h3>Question check</h3>
                    <p>Flag unclear wording, resolve flags, or open the question for voting.</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => void runCivicAction(challengeQuestion)} disabled={!canChallengeQuestion || pending}>
                      Flag question
                    </button>
                    <button type="button" onClick={() => void runCivicAction(() => ruleChallenge("Rejected"))} disabled={!canRuleChallenge || pending}>
                      Clear flag
                    </button>
                    <button type="button" onClick={() => void runCivicAction(() => ruleChallenge("Sustained"))} disabled={!canRuleChallenge || pending}>
                      Keep flag
                    </button>
                    <button type="button" onClick={() => void runCivicAction(acceptQuestion)} disabled={!canAcceptQuestion || pending}>
                      Open voting
                    </button>
                  </div>
                  {pendingChallenge ? <small className="action-hint">Open flag: {pendingChallenge.reasonCode}</small> : null}
                </section>

                <section className="action-group">
                  <div className="group-heading">
                    <h3>Voting pass</h3>
                    <p>{credential ? `Voting pass ready: ${credential.credentialId}` : "Get a voting pass, then cast one private vote."}</p>
                  </div>
                  <div className="actions ballot-actions">
                    <button type="button" onClick={() => void runCivicAction(issueCredential)} disabled={!data.activeUser || pending}>
                      Get voting pass
                    </button>
                    {renderBallotControls()}
                  </div>
                  {ballotDisabledReason ? <small className="action-hint">{ballotDisabledReason}</small> : null}
                </section>

                <section className="action-group">
                  <div className="group-heading">
                    <h3>Results</h3>
                    <p>Close voting, count private votes, publish the public receipt.</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => void runCivicAction(closeAndTally)} disabled={!canCloseAndTally || pending}>
                      Count votes
                    </button>
                    <button type="button" onClick={() => void runCivicAction(challengeResult)} disabled={!canChallengeResult || pending}>
                      Flag result
                    </button>
                    <button type="button" onClick={() => void runCivicAction(() => ruleResultChallenge("Rejected"))} disabled={!canRuleResultChallenge || pending}>
                      Clear result flag
                    </button>
                    <button type="button" onClick={() => void runCivicAction(finalizeAndArchive)} disabled={!canFinalizeAndArchive || pending}>
                      Save final result
                    </button>
                  </div>
                  {pendingResultChallenge ? <small className="action-hint">Result flag open: {pendingResultChallenge.reasonCode}</small> : null}
                </section>
              </div>
            </details>
            <DataUnionPanel
              dataUnion={dataUnion}
              loading={dataUnionLoading}
              message={dataUnionMessage}
              actionPending={pending}
              canSteward={canStewardDataUnion}
              canConsent={canConsentToDataUnion}
              canPublishProduct={canPublishDataUnionProduct}
              canGrantAccess={canGrantDataUnionAccess}
              onProposePolicy={() => void runCivicAction(proposeDataUnionPolicy)}
              onActivatePolicy={() => void runCivicAction(activateDataUnionPolicy)}
              onRecordConsent={() => void runCivicAction(recordDataUnionConsent)}
              onPublishProduct={() => void runCivicAction(publishDataUnionProduct)}
              onGrantAccess={() => void runCivicAction(grantDataUnionAccess)}
            />
            <AuthorityPolicyPanel
              adoption={adoption}
              loading={adoptionLoading}
              message={adoptionMessage}
              actionPending={pending}
              canSteward={canStewardDataUnion}
              onProposeRecognized={() => void runCivicAction(proposeRecognizedPolicy)}
              onActivatePolicy={() => void runCivicAction(activateRecognizedPolicy)}
              onSuspendPolicy={() => void runCivicAction(suspendRecognizedPolicy)}
            />
            <section className="thread-panel">
              <div className="rail-heading">
                <h3>Thread</h3>
                <small>{discussion.length} notes</small>
              </div>
              <form className="stacked-form" onSubmit={postDiscussion}>
                <textarea
                  aria-label="Discussion note"
                  placeholder="Add context, a source, or a concern"
                  value={discussionDraft}
                  onChange={(event) => setDiscussionDraft(event.target.value)}
                />
                <button className="wide-action" disabled={!discussionDraft.trim()}>
                  Post comment
                </button>
              </form>
              <div className="discussion-list">
                {discussion.length ? (
                  discussion.map((post) => (
                    <article className="discussion-entry" key={post.id}>
                      <small>{publicDiscussionLabel(post.kind)}</small>
                      <p>{post.body}</p>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <strong>No comments yet</strong>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="empty-state">
            <strong>Select a question</strong>
            <p>The conversation and results will open here.</p>
          </div>
        )}
      </aside>
    </section>
  );
}

export function AccountPageClient() {
  const data = useSocialData("all");
  const [communityDraft, setCommunityDraft] = useState({ name: "", description: "", visibility: "Public" as "Public" | "Private" });
  const [pending, setPending] = useState(false);

  const ownedCommunities = data.communities.filter((community) => community.activeUserRole === "Owner");
  const joinedCommunities = data.communities.filter((community) => community.isMember);
  const authoredQuestions = data.questions.filter((question) => question.proposer === data.activeUser?.id);

  async function createCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.activeUser) return;
    setPending(true);
    try {
      const payload = { ...communityDraft, creatorId: data.activeUser.id };
      const created = await apiCall<{ community: Community }>("/communities", { method: "POST", body: JSON.stringify(payload) });
      setCommunityDraft({ name: "", description: "", visibility: "Public" });
      data.setMessage(`${created.community.name} created.`);
      await data.refresh(data.activeUser.id, created.community.id);
    } catch (createError) {
      data.setMessage(createError instanceof Error ? createError.message : "Community creation failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="account-page">
      <section className="feed-hero account-title">
        <div>
          <p className="eyebrow">Popular Consensus</p>
          <h1>{siteCopy.nav.account}</h1>
          <p className="muted">Manage your profile, communities, and questions.</p>
        </div>
      </section>
      <div className="account-hero">
        <ProfileSummary user={data.activeUser} role={data.activeUser ? "Member" : undefined} />
        <section className="panel account-session-panel">
          {data.activeUser ? (
            <div className="account-row">
              <strong>{data.activeUser.smartAccountAddress ? "Private voting account" : "Local account"}</strong>
              <span>Ready</span>
              <small>{data.activeUser.smartAccountAddress ?? "Local account only"}</small>
            </div>
          ) : (
            <Link className="button-link" href="/login">
              Log in
            </Link>
          )}
          <div className="feed-stat-grid">
            <div>
              <small>Communities</small>
              <strong>{joinedCommunities.length}</strong>
            </div>
            <div>
              <small>Following</small>
              <strong>{data.discovery?.communityFollows.length ?? 0}</strong>
            </div>
            <div>
              <small>Questions</small>
              <strong>{authoredQuestions.length}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="account-grid">
        <form className="panel auth-form" onSubmit={createCommunity}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Community</p>
              <h2>Start a community</h2>
            </div>
          </div>
          <label className="field-label">
            Community name
            <input
              aria-label="Community name"
              value={communityDraft.name}
              onChange={(event) => setCommunityDraft((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label className="field-label">
            Description
            <textarea
              aria-label="Community description"
              value={communityDraft.description}
              onChange={(event) => setCommunityDraft((current) => ({ ...current, description: event.target.value }))}
              required
            />
          </label>
          <label className="field-label">
            Visibility
            <select
              aria-label="Community visibility"
              value={communityDraft.visibility}
              onChange={(event) =>
                setCommunityDraft((current) => ({ ...current, visibility: event.target.value as "Public" | "Private" }))
              }
            >
              <option>Public</option>
              <option>Private</option>
            </select>
          </label>
          <button className="wide-action" disabled={pending || !data.activeUser}>
            Start community
          </button>
          {!data.activeUser ? <small className="form-hint">Log in with a passkey or wallet before starting a community.</small> : null}
          {data.message ? <p className="message">{data.message}</p> : null}
        </form>

        <section className="panel account-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Communities I'm in</p>
              <h2>Communities I'm in</h2>
            </div>
          </div>
          <div className="post-list">
            {joinedCommunities.map((community) => (
              <article className="account-row" key={community.id}>
                <strong>p/{community.slug}</strong>
                <span>{publicRoleLabel(community.activeUserRole ?? "Member")}</span>
                <small>
                  {community.memberCount} members · {community.questionCount} questions · {community.visibility}
                </small>
              </article>
            ))}
            {!joinedCommunities.length ? (
              <div className="empty-state">
                <strong>No communities yet</strong>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel account-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Published</p>
              <h2>Questions I asked</h2>
            </div>
          </div>
          <div className="post-list">
            {authoredQuestions.map((question) => (
              <article className="account-row" key={question.id}>
                <strong>{question.title}</strong>
                <span>{publicQuestionStatus(question.status)}</span>
                <small>p/{question.community?.slug ?? "community"}</small>
              </article>
            ))}
            {!authoredQuestions.length ? (
              <div className="empty-state">
                <strong>No questions yet</strong>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel account-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Guiding</p>
              <h2>Communities I guide</h2>
            </div>
          </div>
          <div className="post-list">
            {ownedCommunities.map((community) => (
              <article className="account-row" key={community.id}>
                <strong>p/{community.slug}</strong>
                <span>{publicAuthorityLabel(community.defaultAuthorityLevel)}</span>
                <small>{community.description}</small>
              </article>
            ))}
            {!ownedCommunities.length ? (
              <div className="empty-state">
                <strong>No guided communities yet</strong>
              </div>
            ) : null}
          </div>
        </section>
      </section>
      {data.error ? <p className="message warning-message">{data.error}</p> : null}
    </section>
  );
}
