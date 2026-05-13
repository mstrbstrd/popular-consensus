"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BuiltInAnswerSchemas, type AnswerSchema, type BallotResponse } from "@pc/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";

type UserAccount = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  smartAccountAddress?: string | null;
  smartAccountKind?: string;
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
  topicIds?: string[];
  createdAt?: string;
  community?: Community | null;
  poll?: {
    id: string;
    status: string;
    result?: { turnout: number; resultArtifactHash: string; finalStatus?: string } | null;
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

type FeedMode = "home" | "open" | "review" | "results";

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
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
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
  if (!credential) throw new Error("Passkey smart-account deployment was cancelled.");
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
    () => new Map((discovery?.communities ?? []).map((community) => [community.id, community])),
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
          <p className="muted">Passkey or wallet account</p>
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
          <dt>Rep</dt>
          <dd>{user.reputation}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{role ?? "Member"}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{user.smartAccountAddress ? "AA" : "Local"}</dd>
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
  return (
    <button className={`post feed-post${active ? " active" : ""}`} onClick={() => onSelect(question)}>
      <span className="post-topline">
        <span className="post-community">p/{question.community?.slug ?? "community"}</span>
        <span>{formatDate(question.createdAt)}</span>
      </span>
      <strong>{question.title}</strong>
      <span className="post-summary">{question.methodologyLabel}</span>
      <span className="post-badges">
        <small>{formatStatus(question.status)}</small>
        <small>{question.poll ? `Poll ${formatStatus(question.poll.status)}` : "No poll"}</small>
        <small>{question.authorityLevel}</small>
        {(question.topicIds ?? []).slice(0, 2).map((topic) => (
          <small key={topic}>#{topic}</small>
        ))}
      </span>
      <span className="post-metrics">
        <small>{question.challenges.length} challenges</small>
        <small>{turnout} turnout</small>
        <small>v{question.version}</small>
      </span>
    </button>
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
    <section className="audit-panel" aria-label="Public audit">
      <div className="rail-heading">
        <h3>Public Audit</h3>
        <small>{loading ? "Loading" : replay?.status ?? "Pending"}</small>
      </div>
      {message ? <p className="audit-message">{message}</p> : null}
      <div className="audit-grid">
        <div>
          <span>Events</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>Commitments</span>
          <strong>{commitments.length}</strong>
        </div>
        <div>
          <span>Turnout</span>
          <strong>{record?.result?.turnout ?? 0}</strong>
        </div>
      </div>
      <dl className="audit-hashes">
        <div>
          <dt>Event Stream</dt>
          <dd>{shortHash(replay?.eventStreamHash)}</dd>
        </div>
        <div>
          <dt>Result Artifact</dt>
          <dd>{shortHash(record?.result?.resultArtifactHash)}</dd>
        </div>
        <div>
          <dt>Privacy Report</dt>
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
            <span>{formatStatus(event.eventType ?? "Protocol event")}</span>
            <strong>{shortHash(event.eventHash ?? event.newHash)}</strong>
          </div>
        ))}
        {!checks.length && !recentEvents.length ? (
          <div>
            <span>No public events yet</span>
            <strong>Awaiting action</strong>
          </div>
        ) : null}
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
        <p className="eyebrow">Smart Account</p>
        <h1>Log in</h1>
        <p className="muted">Use a passkey or Ethereum wallet controller for your Popular Consensus account.</p>
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
          nextMessage = `Account ready for ${payload.user.displayName}. Smart account deployed.`;
        } catch (deploymentError) {
          nextMessage = `Account ready for ${payload.user.displayName}. Smart-account deployment still needs retry: ${
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
        <p className="eyebrow">Create Identity</p>
        <h1>Start a protocol account</h1>
        <p className="muted">Your local profile can join communities, publish questions, and follow civic threads.</p>
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
            Create with passkey
          </button>
          <button className="wide-action secondary" disabled={pending} type="button" onClick={() => void createWalletAccount()}>
            Create with wallet
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
  const [pending, setPending] = useState(false);

  const activeRole = data.selectedCommunity?.activeUserRole ?? (data.selectedCommunity?.isMember ? "Member" : "Visitor");
  const selectedQuestion = useMemo(
    () => data.questions.find((question) => question.id === selectedQuestionId) ?? data.questions[0] ?? null,
    [data.questions, selectedQuestionId]
  );
  const activeAnswerSchema = useMemo(
    () => BuiltInAnswerSchemas.find((schema) => schema.answerSchemaId === selectedQuestion?.answerSchemaId) ?? BuiltInAnswerSchemas[0],
    [selectedQuestion?.answerSchemaId]
  );
  const composeCommunity =
    data.communities.find((community) => community.id === composeCommunityId) ??
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
        ? "Voting opens after registry acceptance."
        : `Voting is disabled while the poll is ${formatStatus(pollStatus)}.`
      : credential
      ? ""
      : "Issue a demo resident credential before submitting an encrypted ballot."
    : "This question does not have a poll yet.";
  const canPost = Boolean(
    data.activeUser &&
      composeCommunity &&
      (composeCommunity.visibility === "Public" || composeCommunity.isMember)
  );

  const filteredQuestions = useMemo(() => {
    if (feedMode === "open") return data.questions.filter((question) => question.poll?.status === "Open");
    if (feedMode === "review") {
      return data.questions.filter(
        (question) => question.poll?.status === "Configured" || ["Submitted", "Challenged", "Amendment", "Accepted"].includes(question.status)
      );
    }
    if (feedMode === "results") {
      return data.questions.filter(
        (question) => question.status === "Archived" || question.poll?.status === "ResultPublished" || Boolean(question.poll?.result)
      );
    }
    return data.questions;
  }, [data.questions, feedMode]);

  useEffect(() => {
    if (!composeCommunityId && data.communities.length) {
      setComposeCommunityId(data.communities.find((community) => community.id === "community-vancouver")?.id ?? data.communities[0].id);
    }
  }, [composeCommunityId, data.communities]);

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
        setAuditMessage(error instanceof Error ? error.message : "Public audit is unavailable for this post.");
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedQuestion?.id]);

  async function selectCommunity(communityId: string) {
    data.setSelectedCommunityId(communityId);
    await data.refresh(data.activeUserId, communityId);
  }

  async function followCommunity(community: Community) {
    if (!data.activeUser) return;
    setPending(true);
    try {
      await apiCall(`/communities/${community.id}/follow`, { method: "POST", body: JSON.stringify({ userId: data.activeUser.id }) });
      data.setMessage(`${data.activeUser.displayName} is following p/${community.slug}.`);
      await data.refresh(data.activeUser.id, data.selectedCommunityId);
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
        topicIds: ["community", composeCommunity.slug],
        geoScope: composeCommunity.name,
        methodologyLabel: `Verified ${composeCommunity.name} community response, self-selected sample`,
        credentialSchemaId: composeCommunity.credentialSchemaId
      };
      const created = await apiCall<{ question: Question; stakedPc: number }>("/questions", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setQuestionDraft(emptyQuestion);
      setSelectedQuestionId(created.question.id);
      data.setMessage(`Question posted with ${created.stakedPc} PC stake.`);
      await data.refresh(data.activeUser.id, composeCommunity.id);
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
  }

  async function challengeQuestion() {
    if (!selectedQuestion || !data.activeUser) return;
    const payload = await apiCall<{ stakedPc: string }>(`/questions/${selectedQuestion.id}/challenges`, {
      method: "POST",
      body: JSON.stringify({ challenger: data.activeUser.id })
    });
    data.setMessage(`Challenge opened with ${payload.stakedPc} PC stake.`);
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
            ? "The challenge is sustained from the social client review panel."
            : "The challenge is rejected from the social client review panel."
      })
    });
    data.setMessage(ruling === "Sustained" ? "Challenge sustained." : "Challenge rejected.");
    await refreshSelectedQuestion();
  }

  async function acceptQuestion() {
    if (!selectedQuestion || !data.activeUser) return;
    await apiCall(`/questions/${selectedQuestion.id}/accept`, {
      method: "POST",
      body: JSON.stringify({ curator: data.activeUser.id })
    });
    data.setMessage("Question accepted and poll opened.");
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
    data.setMessage("Demo resident credential issued for encrypted voting.");
  }

  async function vote(response: BallotResponse, label: string) {
    if (!selectedQuestion?.poll || !credential) return;
    await apiCall(`/polls/${selectedQuestion.poll.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ ...credential, response })
    });
    setResponseDraft(emptyResponseDraft);
    data.setMessage(`Encrypted ${label} ballot accepted.`);
    await refreshSelectedQuestion();
  }

  async function submitDraftResponse() {
    await vote(buildDraftResponse(activeAnswerSchema, responseDraft), activeAnswerSchema.label.toLowerCase());
  }

  async function closeAndTally() {
    if (!selectedQuestion?.poll) return;
    await apiCall(`/polls/${selectedQuestion.poll.id}/close`, { method: "POST", body: "{}" });
    await apiCall(`/polls/${selectedQuestion.poll.id}/tally`, { method: "POST", body: "{}" });
    data.setMessage("Poll closed and aggregate result artifact published.");
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
    data.setMessage(`Result challenge opened with ${payload.stakedPc} PC stake.`);
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
    data.setMessage(ruling === "Sustained" ? "Result challenge sustained." : "Result challenge rejected.");
    await refreshSelectedQuestion();
  }

  async function finalizeAndArchive() {
    if (!selectedQuestion?.poll || !data.activeUser) return;
    await apiCall(`/polls/${selectedQuestion.poll.id}/finalize`, { method: "POST", body: JSON.stringify({ curator: data.activeUser.id }) });
    await apiCall(`/questions/${selectedQuestion.id}/archive`, { method: "POST", body: JSON.stringify({ curator: data.activeUser.id }) });
    data.setMessage("Result finalized and public archive published.");
    await refreshSelectedQuestion();
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
                <strong>Home</strong>
                <small>All visible communities</small>
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
                      {community.memberCount} members · {discovered?.followerCount ?? 0} followers · {community.questionCount} posts
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
            <h2>Topics</h2>
            <small>{data.discovery?.topicFollows.length ?? 0} followed</small>
          </div>
          <div className="topic-list">
            {(data.discovery?.topics ?? []).slice(0, 6).map((topic) => (
              <div className="topic-pill" key={topic.topicId}>
                <strong>#{topic.topicId}</strong>
                <small>
                  {topic.questionCount} posts · {topic.followerCount} followers
                </small>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <div className="social-main">
        <section className="feed-hero">
          <div>
            <p className="eyebrow">Live Feed</p>
            <h1>Community Feed</h1>
            <p className="muted">Public and member-visible questions from the active account.</p>
          </div>
          <div className="network-stats">
            <span>{data.communities.length} communities</span>
            <span>{data.questions.length} posts</span>
            <span>{data.discovery?.communityFollows.length ?? 0} follows</span>
          </div>
        </section>

        <form className="panel compose social-composer" onSubmit={submitQuestion}>
          <div className="composer-head">
            <div className="avatar small">{initials(data.activeUser?.displayName ?? "PC")}</div>
            <div>
              <h2>Start a Consensus Post</h2>
              <p className="muted">Posting as {data.activeUser?.displayName ?? "local account"}</p>
            </div>
          </div>
          <label className="field-label">
            Community
            <select aria-label="Community" value={composeCommunity?.id ?? ""} onChange={(event) => setComposeCommunityId(event.target.value)}>
              {data.communities.map((community) => (
                <option key={community.id} value={community.id}>
                  p/{community.slug}
                </option>
              ))}
            </select>
          </label>
          <input
            aria-label="Question title"
            placeholder="Question title"
            value={questionDraft.title}
            onChange={(event) => setQuestionDraft((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <textarea
            aria-label="Question body"
            placeholder="Context, scope, and what a support response means"
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
            placeholder="Sponsor disclosure"
            value={questionDraft.sponsorDisclosure}
            onChange={(event) => setQuestionDraft((current) => ({ ...current, sponsorDisclosure: event.target.value }))}
          />
          <button className="wide-action" disabled={!canPost || pending} title={canPost ? undefined : "Join this private community before posting."}>
            Post question
          </button>
        </form>

        <section className="panel feed-list-panel">
          <div className="section-heading">
            <div>
              <h2>Feed</h2>
              <p className="muted">{data.loading ? "Loading feed" : `${filteredQuestions.length} visible posts`}</p>
            </div>
          </div>
          <div className="feed-tabs" role="tablist" aria-label="Feed filters">
            {[
              { key: "home", label: "Home" },
              { key: "open", label: "Voting" },
              { key: "review", label: "Review" },
              { key: "results", label: "Results" }
            ].map((mode) => (
              <button
                key={mode.key}
                className={feedMode === mode.key ? "active" : ""}
                onClick={() => setFeedMode(mode.key as FeedMode)}
                type="button"
              >
                {mode.label}
                <small>{mode.key === "home" ? data.questions.length : filteredQuestions.length}</small>
              </button>
            ))}
          </div>
          <div className="post-list">
            {filteredQuestions.length ? (
              filteredQuestions.map((question) => (
                <PostCard
                  key={question.id}
                  question={question}
                  active={selectedQuestion?.id === question.id}
                  onSelect={(nextQuestion) => setSelectedQuestionId(nextQuestion.id)}
                />
              ))
            ) : (
              <div className="empty-state">
                <strong>No posts in this view</strong>
                <p>Switch filters or post the first question.</p>
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
              <span>{formatStatus(selectedQuestion.status)}</span>
              <span>{selectedQuestion.poll ? `Poll ${formatStatus(selectedQuestion.poll.status)}` : "No poll"}</span>
              <span>{selectedQuestion.authorityLevel}</span>
            </div>
            <h2>{selectedQuestion.title}</h2>
            <p className="muted">{selectedQuestion.methodologyLabel}</p>
            <dl className="meta-grid">
              <div>
                <dt>Community</dt>
                <dd>p/{selectedQuestion.community?.slug ?? "community"}</dd>
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
                <span>Civic Actions</span>
                <small>{data.activeUser ? `Acting as ${data.activeUser.displayName}` : "Sign in to act"}</small>
              </summary>
              <div className="action-groups">
                <section className="action-group">
                  <div className="group-heading">
                    <h3>Registry Review</h3>
                    <p>Challenge wording, resolve review, or accept a ready question into voting.</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => void runCivicAction(challengeQuestion)} disabled={!canChallengeQuestion || pending}>
                      Open challenge
                    </button>
                    <button type="button" onClick={() => void runCivicAction(() => ruleChallenge("Rejected"))} disabled={!canRuleChallenge || pending}>
                      Reject challenge
                    </button>
                    <button type="button" onClick={() => void runCivicAction(() => ruleChallenge("Sustained"))} disabled={!canRuleChallenge || pending}>
                      Sustain challenge
                    </button>
                    <button type="button" onClick={() => void runCivicAction(acceptQuestion)} disabled={!canAcceptQuestion || pending}>
                      Accept and open
                    </button>
                  </div>
                  {pendingChallenge ? <small className="action-hint">Pending challenge: {pendingChallenge.reasonCode}</small> : null}
                </section>

                <section className="action-group">
                  <div className="group-heading">
                    <h3>Private Ballot</h3>
                    <p>{credential ? `Credential ready: ${credential.credentialId}` : "Issue a demo credential, then cast an encrypted ballot."}</p>
                  </div>
                  <div className="actions ballot-actions">
                    <button type="button" onClick={() => void runCivicAction(issueCredential)} disabled={!data.activeUser || pending}>
                      Issue credential
                    </button>
                    {renderBallotControls()}
                  </div>
                  {ballotDisabledReason ? <small className="action-hint">{ballotDisabledReason}</small> : null}
                </section>

                <section className="action-group">
                  <div className="group-heading">
                    <h3>Results</h3>
                    <p>Close the poll, publish aggregate artifacts, handle challenges, then archive.</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => void runCivicAction(closeAndTally)} disabled={!canCloseAndTally || pending}>
                      Close and tally
                    </button>
                    <button type="button" onClick={() => void runCivicAction(challengeResult)} disabled={!canChallengeResult || pending}>
                      Challenge result
                    </button>
                    <button type="button" onClick={() => void runCivicAction(() => ruleResultChallenge("Rejected"))} disabled={!canRuleResultChallenge || pending}>
                      Reject result challenge
                    </button>
                    <button type="button" onClick={() => void runCivicAction(finalizeAndArchive)} disabled={!canFinalizeAndArchive || pending}>
                      Finalize and archive
                    </button>
                  </div>
                  {pendingResultChallenge ? <small className="action-hint">Result challenge pending: {pendingResultChallenge.reasonCode}</small> : null}
                </section>
              </div>
            </details>
            <section className="thread-panel">
              <div className="rail-heading">
                <h3>Thread</h3>
                <small>{discussion.length} notes</small>
              </div>
              <form className="stacked-form" onSubmit={postDiscussion}>
                <textarea
                  aria-label="Discussion note"
                  placeholder="Add context, source notes, or a concern"
                  value={discussionDraft}
                  onChange={(event) => setDiscussionDraft(event.target.value)}
                />
                <button className="wide-action" disabled={!discussionDraft.trim()}>
                  Post note
                </button>
              </form>
              <div className="discussion-list">
                {discussion.length ? (
                  discussion.map((post) => (
                    <article className="discussion-entry" key={post.id}>
                      <small>{post.kind}</small>
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
            <strong>Select a post</strong>
            <p>The thread and protocol summary will open here.</p>
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
      <div className="account-hero">
        <ProfileSummary user={data.activeUser} role="Active" />
        <section className="panel account-session-panel">
          {data.activeUser ? (
            <div className="account-row">
              <strong>{data.activeUser.smartAccountKind ?? "Smart account"}</strong>
              <span>Active</span>
              <small>{data.activeUser.smartAccountAddress ?? "No smart account bound"}</small>
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
              <small>Posts</small>
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
              <h2>Create Community</h2>
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
            Create community
          </button>
          {data.message ? <p className="message">{data.message}</p> : null}
        </form>

        <section className="panel account-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Memberships</p>
              <h2>Communities</h2>
            </div>
          </div>
          <div className="post-list">
            {joinedCommunities.map((community) => (
              <article className="account-row" key={community.id}>
                <strong>p/{community.slug}</strong>
                <span>{community.activeUserRole ?? "Member"}</span>
                <small>
                  {community.memberCount} members · {community.questionCount} posts · {community.visibility}
                </small>
              </article>
            ))}
            {!joinedCommunities.length ? (
              <div className="empty-state">
                <strong>No memberships yet</strong>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel account-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Published</p>
              <h2>Your Questions</h2>
            </div>
          </div>
          <div className="post-list">
            {authoredQuestions.map((question) => (
              <article className="account-row" key={question.id}>
                <strong>{question.title}</strong>
                <span>{formatStatus(question.status)}</span>
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
              <p className="eyebrow">Owned</p>
              <h2>Stewardship</h2>
            </div>
          </div>
          <div className="post-list">
            {ownedCommunities.map((community) => (
              <article className="account-row" key={community.id}>
                <strong>p/{community.slug}</strong>
                <span>{community.defaultAuthorityLevel}</span>
                <small>{community.description}</small>
              </article>
            ))}
            {!ownedCommunities.length ? (
              <div className="empty-state">
                <strong>No owned communities yet</strong>
              </div>
            ) : null}
          </div>
        </section>
      </section>
      {data.error ? <p className="message warning-message">{data.error}</p> : null}
    </section>
  );
}
