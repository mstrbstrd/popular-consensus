export const siteCopy = {
  brandSubtitle: "Wisdom of the crowd",
  nav: {
    home: "Home",
    feed: "Feed",
    account: "My Account",
    testing: "Testing Lab"
  },
  actions: {
    askCrowd: "Ask a question",
    seeQuestions: "Open feed",
    joinCrowd: "Create account"
  }
};

export function splitCamel(value?: string | null) {
  if (!value) return "";
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function publicRoleLabel(role?: string | null) {
  if (role === "Owner") return "Lead Kernel";
  if (role === "Moderator") return "Kernel";
  if (role === "Member") return "Member";
  if (role === "Visitor") return "Guest";
  return role ?? "Guest";
}

export function publicAuthorityLabel(authorityLevel?: string | null) {
  if (authorityLevel === "Advisory") return "Community signal";
  if (authorityLevel === "Recognized") return "Recognized next step";
  if (authorityLevel === "Binding") return "Binding decision";
  return authorityLevel ? splitCamel(authorityLevel) : "Community signal";
}

export function publicQuestionStatus(status?: string | null) {
  if (status === "Submitted") return "Being checked";
  if (status === "Challenged") return "Flagged for review";
  if (status === "Amendment") return "Being clarified";
  if (status === "Accepted") return "Ready for voting";
  if (status === "Rejected") return "Not moving forward";
  if (status === "Archived") return "Saved to record";
  if (status === "ResultPublished") return "Results posted";
  return status ? splitCamel(status) : "No question";
}

export function publicPollStatus(status?: string | null) {
  if (status === "Configured") return "Ready for check";
  if (status === "Open") return "Voting open";
  if (status === "Closed") return "Counting votes";
  if (status === "ResultPublished") return "Results posted";
  if (status === "NotCreated") return "No vote yet";
  return status ? splitCamel(status) : "No vote yet";
}

export function publicDiscussionLabel(kind?: string | null) {
  if (kind === "ModeratorNote") return "Guide note";
  if (kind === "ClarifyingQuestion") return "Question";
  if (kind === "ProArgument") return "For";
  if (kind === "ConArgument") return "Against";
  return kind ? splitCamel(kind) : "Comment";
}
